import { useCallback, useState } from 'react';
import { useAws } from './useAws';
import { useGraphQLRequest } from './useGraphQLRequest';

export interface ItemImage {
  id: string;
  item_id: string;
  image_url: string;
  image_type: string;
  alt_text?: string;
  caption?: string;
  display_order: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateItemImageData {
  item_id: string;
  image_url: string;
  image_type: string;
  alt_text?: string;
  caption?: string;
  display_order: number;
  uploaded_by: string;
}

export interface PresignedUrlRequest {
  bucketName: string;
  originalFileName: string;
  contentType?: string;
  expiresIn?: number;
  prefix?: string;
  metadata?: Record<string, string>;
}

export interface PresignedUrlResponse {
  success: boolean;
  data?: {
    url: string;
    fields: Record<string, string>;
    expiresAt: Date;
    key: string;
  };
  error?: string;
}

const GET_ITEM_IMAGES = `
  query GetItemImages($itemId: uuid!) {
    item_images(
      where: { item_id: { _eq: $itemId } }
      order_by: { display_order: asc }
    ) {
      id
      item_id
      image_url
      image_type
      alt_text
      caption
      display_order
      uploaded_by
      created_at
      updated_at
    }
  }
`;

const CREATE_ITEM_IMAGE = `
  mutation CreateItemImage($imageData: item_images_insert_input!) {
    insert_item_images_one(object: $imageData) {
      id
      item_id
      image_url
      image_type
      alt_text
      caption
      display_order
      uploaded_by
      created_at
      updated_at
    }
  }
`;

const DELETE_ITEM_IMAGE = `
  mutation DeleteItemImage($id: uuid!) {
    delete_item_images_by_pk(id: $id) {
      id
    }
  }
`;

export const useItemImages = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { generateImageUploadUrl } = useAws();

  const { execute: executeGetImages } = useGraphQLRequest(GET_ITEM_IMAGES);
  const { execute: executeCreateImage } = useGraphQLRequest(CREATE_ITEM_IMAGE);
  const { execute: executeDeleteImage } = useGraphQLRequest(DELETE_ITEM_IMAGE);

  const fetchItemImages = useCallback(
    async (itemId: string): Promise<ItemImage[]> => {
      try {
        const result = await executeGetImages({ itemId });
        return result.item_images || [];
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch item images'
        );
        throw err;
      }
    },
    [executeGetImages]
  );

  const getPresignedUrl = useCallback(
    async (request: PresignedUrlRequest): Promise<PresignedUrlResponse> => {
      try {
        const response = await generateImageUploadUrl({
          bucketName: request.bucketName,
          originalFileName: request.originalFileName,
          contentType: request.contentType,
          expiresIn: request.expiresIn,
          prefix: request.prefix,
          metadata: request.metadata,
        });

        if (!response) {
          throw new Error('Failed to generate presigned URL');
        }

        return response;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to get presigned URL'
        );
        throw err;
      }
    },
    [generateImageUploadUrl]
  );

  const uploadImageToS3 = useCallback(
    async (presignedUrl: string, file: File): Promise<void> => {
      try {
        const response = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to upload image: ${response.statusText}`);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to upload image to S3'
        );
        throw err;
      }
    },
    []
  );

  const createItemImage = useCallback(
    async (imageData: CreateItemImageData): Promise<ItemImage> => {
      try {
        const result = await executeCreateImage({ imageData });
        return result.insert_item_images_one;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to create item image'
        );
        throw err;
      }
    },
    [executeCreateImage]
  );

  const deleteItemImage = useCallback(
    async (imageId: string): Promise<void> => {
      try {
        await executeDeleteImage({ id: imageId });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to delete item image'
        );
        throw err;
      }
    },
    [executeDeleteImage]
  );

  const uploadItemImage = useCallback(
    async (
      itemId: string,
      file: File,
      userId: string,
      bucketName: string,
      altText?: string,
      caption?: string
    ): Promise<ItemImage> => {
      setLoading(true);
      setError(null);

      try {
        // Get presigned URL
        const presignedResponse = await getPresignedUrl({
          bucketName,
          originalFileName: file.name,
          contentType: file.type,
          prefix: `items/${itemId}/images`,
        });

        if (!presignedResponse.success || !presignedResponse.data) {
          throw new Error(
            presignedResponse.error || 'Failed to get presigned URL'
          );
        }

        // Upload to S3
        await uploadImageToS3(presignedResponse.data.url, file);

        // Get the final S3 URL
        const s3Url = `https://${bucketName}.s3.amazonaws.com/${presignedResponse.data.key}`;

        // Get current images to determine display order
        const currentImages = await fetchItemImages(itemId);
        const nextDisplayOrder = currentImages.length + 1;

        // Create item image record
        const imageData: CreateItemImageData = {
          item_id: itemId,
          image_url: s3Url,
          image_type: file.type,
          alt_text: altText,
          caption: caption,
          display_order: nextDisplayOrder,
          uploaded_by: userId,
        };

        const newImage = await createItemImage(imageData);
        return newImage;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to upload item image'
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getPresignedUrl, uploadImageToS3, fetchItemImages, createItemImage]
  );

  return {
    loading,
    error,
    fetchItemImages,
    uploadItemImage,
    deleteItemImage,
    getPresignedUrl,
  };
};
