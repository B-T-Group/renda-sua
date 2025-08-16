import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { UploadService } from '../services/upload.service';

export interface UploadData {
  file_name: string;
  content_type: string;
  file_size: number;
  note?: string;
  document_type_id: number;
}

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly permissionService: PermissionService,
    private readonly uploadService: UploadService
  ) {}

  @Post('get_upload_url')
  async getUploadUrl(@Body() uploadData: UploadData) {
    try {
      // Business logic delegated to upload service
      const result = await this.uploadService.generateUploadUrl(uploadData);

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate upload URL',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':id/view')
  async getUserUploadPresignedUrl(@Param('id') uploadId: string) {
    try {
      const user = await this.hasuraUserService.getUser();

      // Permission check using permission service
      const canAccess = await this.permissionService.canViewUserUpload(
        user.id,
        uploadId
      );
      if (!canAccess) {
        throw new HttpException(
          {
            success: false,
            error: 'Access denied. You can only view your own uploads.',
          },
          HttpStatus.FORBIDDEN
        );
      }

      // Business logic delegated to upload service
      const result = await this.uploadService.generateViewUrl(uploadId);

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to generate view URL',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':id')
  async deleteUpload(@Param('id') uploadId: string) {
    try {
      const user = await this.hasuraUserService.getUser();

      // Permission check using permission service
      const canDelete = await this.permissionService.canDeleteUserUpload(
        user.id,
        uploadId
      );
      if (!canDelete) {
        throw new HttpException(
          {
            success: false,
            error: 'Access denied. You can only delete your own uploads.',
          },
          HttpStatus.FORBIDDEN
        );
      }

      // Business logic delegated to upload service
      await this.uploadService.deleteUpload(uploadId);

      return {
        success: true,
        message: 'Upload deleted successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to delete upload',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
