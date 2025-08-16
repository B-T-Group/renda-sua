import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { AwsService } from './aws.service';

export interface GeneratePresignedUrlRequest {
  bucketName: string;
  key?: string;
  originalFileName?: string;
  contentType?: string;
  expiresIn?: number;
  prefix?: string;
  metadata?: Record<string, string>;
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

@Controller('aws')
export class AwsController {
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
