import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AwsService } from './aws.service';

export interface GeneratePresignedUrlRequest {
  bucketName: string;
  key?: string;
  originalFileName?: string;
  contentType?: string;
  expiresIn?: number;
  prefix?: string;
  metadata?: Record<string, string>;
  fileSize?: number; // File size in bytes
}

export interface GeneratePresignedUrlResponse {
  success: boolean;
  data?: {
    url: string;
    expiresAt: Date;
    key: string;
  };
  error?: string;
}

export interface GenerateDownloadUrlRequest {
  bucketName: string;
  key: string;
  expiresIn?: number;
}

export interface GenerateDownloadUrlResponse {
  success: boolean;
  data?: {
    url: string;
    expiresAt: Date;
    key: string;
  };
  error?: string;
}

@ApiTags('aws')
@Controller('aws')
export class AwsController {
  // Maximum file size for images: 10MB (matches AI Vision service limit)
  private static readonly MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
  // Maximum file size for documents: 50MB
  private static readonly MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;

  constructor(private readonly awsService: AwsService) {}

  @Post('presigned-url')
  async generatePresignedUrl(
    @Body() request: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse> {
    try {
      const {
        bucketName,
        key: providedKey,
        originalFileName,
        contentType = 'application/octet-stream',
        expiresIn = 3600,
        prefix = 'uploads',
        metadata = {},
      } = request;

      // Validate required parameters
      if (!bucketName) {
        throw new HttpException(
          {
            success: false,
            error: 'Bucket name is required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Generate key if not provided
      let key = providedKey;
      if (!key && originalFileName) {
        key = this.awsService.generateUniqueKey(originalFileName, prefix);
      } else if (!key) {
        throw new HttpException(
          {
            success: false,
            error: 'Either key or originalFileName must be provided',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Generate presigned URL
      const result = await this.awsService.generatePresignedUploadUrl({
        bucketName,
        key,
        contentType,
        expiresIn,
        metadata,
      });

      return {
        success: true,
        data: {
          ...result,
          key,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate presigned URL',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('presigned-url/image')
  @ApiOperation({
    summary: 'Generate presigned URL for image upload',
    description: 'Generates a presigned S3 URL for uploading images. Maximum file size: 10MB.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        bucketName: { type: 'string', description: 'S3 bucket name' },
        originalFileName: { type: 'string', description: 'Original file name' },
        contentType: { type: 'string', default: 'image/jpeg' },
        fileSize: { 
          type: 'number', 
          description: 'File size in bytes (max 10MB for images)',
          maximum: 10485760 
        },
        expiresIn: { type: 'number', default: 3600, description: 'URL expiration in seconds' },
        prefix: { type: 'string', default: 'images' },
      },
      required: ['bucketName', 'originalFileName'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Presigned URL generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - missing required fields or file too large',
  })
  async generateImageUploadUrl(
    @Body() request: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse> {
    try {
      const {
        bucketName,
        key: providedKey,
        originalFileName,
        contentType = 'image/jpeg',
        expiresIn = 3600,
        prefix = 'images',
        fileSize,
      } = request;

      // Validate required parameters
      if (!bucketName) {
        throw new HttpException(
          {
            success: false,
            error: 'Bucket name is required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate file size
      if (fileSize !== undefined && fileSize > AwsController.MAX_IMAGE_SIZE_BYTES) {
        const maxSizeMB = AwsController.MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
        const providedSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        throw new HttpException(
          {
            success: false,
            error: `Image size (${providedSizeMB}MB) exceeds the maximum allowed size of ${maxSizeMB}MB. Please compress or resize your image.`,
            maxSizeBytes: AwsController.MAX_IMAGE_SIZE_BYTES,
            providedSizeBytes: fileSize,
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Generate key if not provided
      let key = providedKey;
      if (!key && originalFileName) {
        key = this.awsService.generateUniqueKey(originalFileName, prefix);
      } else if (!key) {
        throw new HttpException(
          {
            success: false,
            error: 'Either key or originalFileName must be provided',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Generate presigned URL for image
      const result = await this.awsService.generateImageUploadUrl(
        bucketName,
        key,
        contentType,
        expiresIn
      );

      return {
        success: true,
        data: {
          ...result,
          key,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate image upload URL',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('presigned-url/document')
  async generateDocumentUploadUrl(
    @Body() request: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse> {
    try {
      const {
        bucketName,
        key: providedKey,
        originalFileName,
        contentType = 'application/pdf',
        expiresIn = 3600,
        prefix = 'documents',
        fileSize,
      } = request;

      // Validate required parameters
      if (!bucketName) {
        throw new HttpException(
          {
            success: false,
            error: 'Bucket name is required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate file size
      if (fileSize !== undefined && fileSize > AwsController.MAX_DOCUMENT_SIZE_BYTES) {
        const maxSizeMB = AwsController.MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024);
        const providedSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        throw new HttpException(
          {
            success: false,
            error: `Document size (${providedSizeMB}MB) exceeds the maximum allowed size of ${maxSizeMB}MB.`,
            maxSizeBytes: AwsController.MAX_DOCUMENT_SIZE_BYTES,
            providedSizeBytes: fileSize,
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Generate key if not provided
      let key = providedKey;
      if (!key && originalFileName) {
        key = this.awsService.generateUniqueKey(originalFileName, prefix);
      } else if (!key) {
        throw new HttpException(
          {
            success: false,
            error: 'Either key or originalFileName must be provided',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Generate presigned URL for document
      const result = await this.awsService.generateDocumentUploadUrl(
        bucketName,
        key,
        contentType,
        expiresIn
      );

      return {
        success: true,
        data: {
          ...result,
          key,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate document upload URL',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('download-url')
  async generateDownloadUrl(
    @Body() request: GenerateDownloadUrlRequest
  ): Promise<GenerateDownloadUrlResponse> {
    try {
      const { bucketName, key, expiresIn = 3600 } = request;

      // Validate required parameters
      if (!bucketName) {
        throw new HttpException(
          {
            success: false,
            error: 'Bucket name is required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      if (!key) {
        throw new HttpException(
          {
            success: false,
            error: 'Key is required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      // Generate presigned download URL
      const result = await this.awsService.generatePresignedDownloadUrl({
        bucketName,
        key,
        expiresIn,
      });

      return {
        success: true,
        data: {
          ...result,
          key,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate download URL',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('generate-key')
  async generateKey(
    @Query('originalFileName') originalFileName: string,
    @Query('prefix') prefix?: string
  ): Promise<{ success: boolean; key: string; error?: string }> {
    try {
      if (!originalFileName) {
        throw new HttpException(
          {
            success: false,
            error: 'originalFileName is required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const key = this.awsService.generateUniqueKey(originalFileName, prefix);

      return {
        success: true,
        key,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate key',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
