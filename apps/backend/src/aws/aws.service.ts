import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

export interface PresignedUrlOptions {
  bucketName: string;
  key: string;
  contentType?: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  metadata?: Record<string, string>;
}

export interface PresignedUrlResponse {
  url: string;
  expiresAt: Date;
}

@Injectable()
export class AwsService {
  private s3Client: S3Client;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    this.s3Client = new S3Client({
      region: awsConfig?.region || 'ca-central-1',
      credentials: {
        accessKeyId: awsConfig?.accessKeyId || '',
        secretAccessKey: awsConfig?.secretAccessKey || '',
      },
    });
  }

  /**
   * Generate a presigned URL for S3 upload
   * @param options Configuration options for the presigned URL
   * @returns Promise<PresignedUrlResponse> Object containing the presigned URL and metadata
   */
  async generatePresignedUploadUrl(
    options: PresignedUrlOptions
  ): Promise<PresignedUrlResponse> {
    const {
      bucketName,
      key,
      contentType = 'application/octet-stream',
      expiresIn = 3600,
      metadata = {},
    } = options;

    // Validate required parameters
    if (!bucketName) {
      throw new Error('Bucket name is required');
    }
    if (!key) {
      throw new Error('Object key is required');
    }

    // Create the PutObject command
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
    });

    try {
      // Generate the presigned URL
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      return {
        url,
        expiresAt,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to generate presigned URL: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a presigned URL for a specific file type
   * @param bucketName S3 bucket name
   * @param key Object key (filename)
   * @param contentType MIME type of the file
   * @param expiresIn Expiration time in seconds
   * @returns Promise<PresignedUrlResponse>
   */
  async generateImageUploadUrl(
    bucketName: string,
    key: string,
    contentType: string = 'image/jpeg',
    expiresIn: number = 3600
  ): Promise<PresignedUrlResponse> {
    return this.generatePresignedUploadUrl({
      bucketName,
      key,
      contentType,
      expiresIn,
      metadata: {
        'upload-type': 'image',
        'uploaded-at': new Date().toISOString(),
      },
    });
  }

  /**
   * Generate a presigned URL for document upload
   * @param bucketName S3 bucket name
   * @param key Object key (filename)
   * @param contentType MIME type of the document
   * @param expiresIn Expiration time in seconds
   * @returns Promise<PresignedUrlResponse>
   */
  async generateDocumentUploadUrl(
    bucketName: string,
    key: string,
    contentType: string = 'application/pdf',
    expiresIn: number = 3600
  ): Promise<PresignedUrlResponse> {
    return this.generatePresignedUploadUrl({
      bucketName,
      key,
      contentType,
      expiresIn,
      metadata: {
        'upload-type': 'document',
        'uploaded-at': new Date().toISOString(),
      },
    });
  }

  /**
   * Generate a unique key for file upload
   * @param originalName Original filename
   * @param prefix Optional prefix for the key
   * @returns string Unique key for S3
   */
  generateUniqueKey(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.split('.').pop() || '';
    const baseName = originalName.replace(/\.[^/.]+$/, '');

    const key = `${
      prefix || 'uploads'
    }/${timestamp}-${randomString}-${baseName}.${extension}`;
    return key.replace(/[^a-zA-Z0-9\-_./]/g, '-');
  }

  /**
   * Get the S3 client instance (for advanced usage)
   * @returns S3Client
   */
  getS3Client(): S3Client {
    return this.s3Client;
  }

  /**
   * Generate a presigned URL for S3 download/viewing
   * @param options Configuration options for the presigned URL
   * @returns Promise<PresignedUrlResponse> Object containing the presigned URL and metadata
   */
  async generatePresignedDownloadUrl(
    options: PresignedUrlOptions
  ): Promise<PresignedUrlResponse> {
    const {
      bucketName,
      key,
      expiresIn = 3600,
    } = options;

    // Validate required parameters
    if (!bucketName) {
      throw new Error('Bucket name is required');
    }
    if (!key) {
      throw new Error('Object key is required');
    }

    // Create the GetObject command
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    try {
      // Generate the presigned URL
      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      });

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      return {
        url,
        expiresAt,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to generate presigned download URL: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Delete an object from S3
   * @param bucketName S3 bucket name
   * @param key Object key to delete
   * @returns Promise<void>
   */
  async deleteObject(bucketName: string, key: string): Promise<void> {
    // Validate required parameters
    if (!bucketName) {
      throw new Error('Bucket name is required');
    }
    if (!key) {
      throw new Error('Object key is required');
    }

    // Create the DeleteObject command
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    try {
      // Delete the object
      await this.s3Client.send(command);
    } catch (error: any) {
      throw new Error(
        `Failed to delete object from S3: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Get the default S3 bucket name from configuration
   * @returns string | undefined
   */
  getDefaultBucketName(): string | undefined {
    const awsConfig = this.configService.get('aws');
    return awsConfig?.s3BucketName;
  }
}
