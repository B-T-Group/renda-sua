import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AwsService } from '../aws/aws.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface UploadData {
  file_name: string;
  content_type: string;
  file_size: number;
  document_type_id: number;
  note?: string;
}

export interface PresignedUrlResponse {
  url: string;
  expiresAt: Date;
}

export interface UploadRecord {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  note?: string;
  is_approved: boolean;
  created_at: string;
}

@Injectable()
export class UploadService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly awsService: AwsService
  ) {}

  /**
   * Generate a presigned URL for viewing/downloading a user upload
   * @param uploadId Upload record ID
   * @returns Promise<{ upload_record: UploadRecord; presigned_url: string; expires_at: Date }>
   */
  async generateViewUrl(uploadId: string): Promise<{
    upload_record: UploadRecord;
    presigned_url: string;
    expires_at: Date;
  }> {
    // Get the upload record from the database
    const getUploadQuery = `
      query GetUserUpload($uploadId: uuid!) {
        user_uploads_by_pk(id: $uploadId) {
          id
          user_id
          document_type_id
          note
          content_type
          key
          file_name
          file_size
          is_approved
          created_at
          updated_at
        }
      }
    `;

    const uploadResult = await this.hasuraUserService.executeQuery(
      getUploadQuery,
      { uploadId }
    );

    if (!uploadResult.user_uploads_by_pk) {
      throw new HttpException(
        {
          success: false,
          error: 'Upload record not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const uploadRecord = uploadResult.user_uploads_by_pk;

    // Generate presigned URL for viewing/downloading
    const presignedUrlResponse =
      await this.awsService.generatePresignedDownloadUrl({
        bucketName: 'rendasua-user-uploads',
        key: uploadRecord.key,
        expiresIn: 3600, // 1 hour
      });

    return {
      upload_record: {
        id: uploadRecord.id,
        file_name: uploadRecord.file_name,
        content_type: uploadRecord.content_type,
        file_size: uploadRecord.file_size,
        note: uploadRecord.note,
        is_approved: uploadRecord.is_approved,
        created_at: uploadRecord.created_at,
      },
      presigned_url: presignedUrlResponse.url,
      expires_at: presignedUrlResponse.expiresAt,
    };
  }

  /**
   * Generate a presigned URL for uploading a new file
   * @param uploadData Upload data including file details
   * @returns Promise<{ upload_record: any; presigned_url: string; expires_at: Date }>
   */
  async generateUploadUrl(uploadData: UploadData): Promise<{
    upload_record: any;
    presigned_url: string;
    expires_at: Date;
  }> {
    const user = await this.hasuraUserService.getUser();

    // Validate required fields
    if (
      !uploadData.file_name ||
      !uploadData.content_type ||
      !uploadData.file_size ||
      !uploadData.document_type_id
    ) {
      throw new Error(
        'Missing required fields: file_name, content_type, file_size, document_type_id'
      );
    }

    // Validate file size (e.g., max 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (uploadData.file_size > maxFileSize) {
      throw new Error('File size exceeds maximum allowed size of 10MB');
    }

    // Generate S3 key using the specified format: {user_type}/{user_id}/document_type_id/file_name
    const key = `${user.user_type_id}/${user.id}/${uploadData.document_type_id}/${uploadData.file_name}`;

    // Generate presigned URL for S3 upload
    const presignedUrlResponse =
      await this.awsService.generatePresignedUploadUrl({
        bucketName: 'rendasua-user-uploads',
        key: key,
        contentType: uploadData.content_type,
        expiresIn: 3600, // 1 hour
        metadata: {
          'user-id': user.id,
          'user-type': user.user_type_id,
          'document-type-id': uploadData.document_type_id.toString(),
          'file-size': uploadData.file_size.toString(),
          'uploaded-at': new Date().toISOString(),
        },
      });

    // Save record in user_uploads table
    const insertMutation = `
      mutation InsertUserUpload($user_id: uuid!, $document_type_id: Int!, $note: String, $content_type: String!, $key: String!, $file_name: String!, $file_size: bigint!) {
        insert_user_uploads_one(object: {
          user_id: $user_id,
          document_type_id: $document_type_id,
          note: $note,
          content_type: $content_type,
          key: $key,
          file_name: $file_name,
          file_size: $file_size,
          is_approved: false
        }) {
          id
          user_id
          document_type_id
          note
          content_type
          key
          file_name
          file_size
          is_approved
          created_at
          updated_at
        }
      }
    `;

    const uploadRecord = await this.hasuraSystemService.executeMutation(
      insertMutation,
      {
        user_id: user.id,
        document_type_id: uploadData.document_type_id,
        note: uploadData.note || null,
        content_type: uploadData.content_type,
        key: key,
        file_name: uploadData.file_name,
        file_size: uploadData.file_size,
      }
    );

    return {
      upload_record: uploadRecord.insert_user_uploads_one,
      presigned_url: presignedUrlResponse.url,
      expires_at: presignedUrlResponse.expiresAt,
    };
  }

  /**
   * Delete a user upload record and the associated S3 object
   * @param uploadId Upload record ID
   * @returns Promise<void>
   */
  async deleteUpload(uploadId: string): Promise<void> {
    // First, get the upload record to get the S3 key
    const getUploadQuery = `
      query GetUserUpload($uploadId: uuid!) {
        user_uploads_by_pk(id: $uploadId) {
          id
          key
          file_name
        }
      }
    `;

    const uploadResult = await this.hasuraUserService.executeQuery(
      getUploadQuery,
      { uploadId }
    );

    if (!uploadResult.user_uploads_by_pk) {
      throw new HttpException(
        {
          success: false,
          error: 'Upload record not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const uploadRecord = uploadResult.user_uploads_by_pk;

    try {
      // Delete the S3 object first
      await this.awsService.deleteObject('rendasua-user-uploads', uploadRecord.key);

      // Then delete the database record
      const deleteMutation = `
        mutation DeleteUserUpload($uploadId: uuid!) {
          delete_user_uploads_by_pk(id: $uploadId) {
            id
          }
        }
      `;

      const result = await this.hasuraSystemService.executeMutation(
        deleteMutation,
        { uploadId }
      );

      if (!result.delete_user_uploads_by_pk) {
        throw new HttpException(
          {
            success: false,
            error: 'Failed to delete upload record from database',
          },
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error: any) {
      // If S3 deletion fails, still try to delete the database record
      // This prevents orphaned database records
      console.error('Failed to delete S3 object:', error);
      
      const deleteMutation = `
        mutation DeleteUserUpload($uploadId: uuid!) {
          delete_user_uploads_by_pk(id: $uploadId) {
            id
          }
        }
      `;

      await this.hasuraSystemService.executeMutation(
        deleteMutation,
        { uploadId }
      );

      throw new HttpException(
        {
          success: false,
          error: 'Upload deleted from database but S3 object deletion failed',
        },
        HttpStatus.PARTIAL_CONTENT
      );
    }
  }

  /**
   * Update upload record note
   * @param uploadId Upload record ID
   * @param note New note text
   * @returns Promise<any> Updated upload record
   */
  async updateUploadNote(uploadId: string, note: string): Promise<any> {
    const updateMutation = `
      mutation UpdateUserUploadNote($uploadId: uuid!, $note: String!) {
        update_user_uploads_by_pk(pk_columns: {id: $uploadId}, _set: {note: $note}) {
          id
          note
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(
      updateMutation,
      { uploadId, note }
    );

    if (!result.update_user_uploads_by_pk) {
      throw new HttpException(
        {
          success: false,
          error: 'Upload record not found or could not be updated',
        },
        HttpStatus.NOT_FOUND
      );
    }

    return result.update_user_uploads_by_pk;
  }
}
