import axios from 'axios';
import type {
  GeneratePresignedUrlRequest,
  GeneratePresignedUrlResponse,
} from '../../../hooks/useAws';

export async function presignUploadLibraryImage(
  file: File,
  bucketName: string,
  prefix: string,
  generateImageUploadUrl: (
    req: GeneratePresignedUrlRequest
  ) => Promise<GeneratePresignedUrlResponse | null>,
  errorLabel: string
): Promise<{
  image_url: string;
  s3_key: string;
  file_size: number;
  format: string;
}> {
  const presigned = await generateImageUploadUrl({
    bucketName,
    originalFileName: file.name,
    contentType: file.type,
    prefix,
  });
  if (!presigned?.success || !presigned.data) {
    throw new Error(errorLabel);
  }
  await axios.put(presigned.data.url, file, {
    headers: { 'Content-Type': file.type },
  });
  const imageUrl = `https://${bucketName}.s3.amazonaws.com/${presigned.data.key}`;
  return {
    image_url: imageUrl,
    s3_key: presigned.data.key,
    file_size: file.size,
    format: file.type,
  };
}
