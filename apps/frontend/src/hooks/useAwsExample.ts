// Example usage of the useAws hook

import { GeneratePresignedUrlRequest, useAws } from './useAws';

// Example 1: Basic image upload
export const useImageUploadExample = () => {
  const { generateImageUploadUrl, loading, error } = useAws();

  const uploadImage = async (file: File, bucketName: string) => {
    const request: GeneratePresignedUrlRequest = {
      bucketName,
      originalFileName: file.name,
      contentType: file.type,
      expiresIn: 3600, // 1 hour
      prefix: 'images',
    };

    const response = await generateImageUploadUrl(request);

    if (response?.data) {
      // Use the presigned URL to upload directly to S3
      const formData = new FormData();
      Object.entries(response.data.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);

      const uploadResponse = await fetch(response.data.url, {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        return `https://${bucketName}.s3.amazonaws.com/${response.data.key}`;
      }
    }

    return null;
  };

  return { uploadImage, loading, error };
};

// Example 2: Document upload
export const useDocumentUploadExample = () => {
  const { generateDocumentUploadUrl, loading, error } = useAws();

  const uploadDocument = async (file: File, bucketName: string) => {
    const request: GeneratePresignedUrlRequest = {
      bucketName,
      originalFileName: file.name,
      contentType: file.type,
      expiresIn: 7200, // 2 hours for documents
      prefix: 'documents',
      metadata: {
        'document-type': 'user-upload',
        'uploaded-at': new Date().toISOString(),
      },
    };

    const response = await generateDocumentUploadUrl(request);

    if (response?.data) {
      // Upload logic similar to image upload
      const formData = new FormData();
      Object.entries(response.data.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);

      const uploadResponse = await fetch(response.data.url, {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        return `https://${bucketName}.s3.amazonaws.com/${response.data.key}`;
      }
    }

    return null;
  };

  return { uploadDocument, loading, error };
};

// Example 3: Generic file upload
export const useGenericUploadExample = () => {
  const { generatePresignedUrl, loading, error } = useAws();

  const uploadFile = async (
    file: File,
    bucketName: string,
    prefix: string = 'uploads'
  ) => {
    const request: GeneratePresignedUrlRequest = {
      bucketName,
      originalFileName: file.name,
      contentType: file.type,
      expiresIn: 3600,
      prefix,
      metadata: {
        'file-size': file.size.toString(),
        'uploaded-by': 'user',
      },
    };

    const response = await generatePresignedUrl(request);

    if (response?.data) {
      const formData = new FormData();
      Object.entries(response.data.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);

      const uploadResponse = await fetch(response.data.url, {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        return `https://${bucketName}.s3.amazonaws.com/${response.data.key}`;
      }
    }

    return null;
  };

  return { uploadFile, loading, error };
};

// Example 4: Generate key only
export const useKeyGenerationExample = () => {
  const { generateKey, loading, error } = useAws();

  const createUniqueKey = async (fileName: string, prefix?: string) => {
    const response = await generateKey(fileName, prefix);
    return response?.key || null;
  };

  return { createUniqueKey, loading, error };
};
