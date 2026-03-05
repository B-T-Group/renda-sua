import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
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

  @Get('me/has-id-document')
  @ApiOperation({
    summary: 'Check if current user (agent) has an ID document',
    description:
      'Returns whether the authenticated agent has at least one upload of type id_card, passport, or driver_license.',
  })
  @ApiResponse({
    status: 200,
    description: 'Success',
    schema: { type: 'object', properties: { hasIdDocument: { type: 'boolean' } } },
  })
  async getMeHasIdDocument(): Promise<{ hasIdDocument: boolean }> {
    const user = await this.hasuraUserService.getUser();
    if (user.user_type_id !== 'agent') {
      return { hasIdDocument: false };
    }
    return this.uploadService.hasIdDocument(user.id);
  }

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

  @Patch(':id/approve')
  async approveUpload(@Param('id') uploadId: string) {
    try {
      const user = await this.hasuraUserService.getUser();

      // Check if user is a business admin
      const isAdmin = await this.permissionService.isBusinessAdmin(user.id);
      if (!isAdmin) {
        throw new HttpException(
          {
            success: false,
            error: 'Access denied. Only business admins can approve documents.',
          },
          HttpStatus.FORBIDDEN
        );
      }

      // Business logic delegated to upload service
      await this.uploadService.approveUpload(uploadId);

      return {
        success: true,
        message: 'Document approved successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to approve document',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a document (superuser)',
    description:
      'Sets the upload note to the rejection message and is_approved to false. The note is visible to the user.',
  })
  @ApiParam({ name: 'id', description: 'Upload ID' })
  @ApiBody({
    schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
  })
  @ApiResponse({ status: 200, description: 'Document rejected successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async rejectUpload(
    @Param('id') uploadId: string,
    @Body('message') message: string
  ) {
    try {
      const user = await this.hasuraUserService.getUser();
      const isAdmin = await this.permissionService.isBusinessAdmin(user.id);
      if (!isAdmin) {
        throw new HttpException(
          {
            success: false,
            error: 'Access denied. Only business admins can reject documents.',
          },
          HttpStatus.FORBIDDEN
        );
      }
      if (!message || typeof message !== 'string' || !message.trim()) {
        throw new HttpException(
          {
            success: false,
            error: 'Rejection message is required',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      await this.uploadService.rejectUpload(uploadId, message.trim());
      return {
        success: true,
        message: 'Document rejected successfully',
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to reject document',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
