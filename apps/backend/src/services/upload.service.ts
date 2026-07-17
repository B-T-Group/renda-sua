import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { AwsService } from '../aws/aws.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveActivePersona } from '../users/persona.util';
import { PlatformPermissions } from '../rbac/platform-permissions';

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

const ID_DOCUMENT_TYPE_NAMES = ['id_card', 'passport', 'driver_license'];

/**
 * System-generated document types that never go through admin review and are
 * therefore inserted as approved. Client apps hide the approval status for
 * these types.
 */
export const AUTO_APPROVED_DOCUMENT_TYPE_NAMES = [
  'order_receipt',
  'rendasua_contract_agreement',
  'rendasua_training_completion',
];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly awsService: AwsService,
    private readonly permissionService: PermissionService,
    private readonly notificationsService: NotificationsService
  ) {}

  /**
   * Returns whether the user has at least one upload with document type
   * id_card, passport, or driver_license. Used for agent ID verification.
   */
  async listUserUploads(userId: string) {
    const query = `
      query MyUploads($userId: uuid!) {
        user_uploads(
          where: { user_id: { _eq: $userId } }
          order_by: { created_at: desc }
        ) {
          id
          document_type_id
          note
          content_type
          file_name
          file_size
          is_approved
          created_at
          document_type { id name description }
        }
      }
    `;
    const result = await this.hasuraUserService.executeQuery(query, { userId });
    return result.user_uploads ?? [];
  }

  async hasIdDocument(userId: string): Promise<{
    hasIdDocument: boolean;
    idDocumentStatus: 'missing' | 'pending' | 'rejected' | 'approved';
  }> {
    const query = `
      query AgentHasIdDocument($userId: uuid!, $documentTypeNames: [String!]) {
        user_uploads(
          where: {
            user_id: { _eq: $userId }
            document_type: { name: { _in: $documentTypeNames } }
          }
          order_by: { created_at: desc }
        ) {
          id
          is_approved
          note
        }
      }
    `;
    const result = await this.hasuraUserService.executeQuery(query, {
      userId,
      documentTypeNames: ID_DOCUMENT_TYPE_NAMES,
    });
    const uploads =
      (result?.user_uploads as
        | { id: string; is_approved: boolean; note?: string | null }[]
        | undefined) ?? [];
    if (!uploads.length) {
      return { hasIdDocument: false, idDocumentStatus: 'missing' };
    }
    if (uploads.some((u) => u.is_approved)) {
      return { hasIdDocument: true, idDocumentStatus: 'approved' };
    }
    const latest = uploads[0];
    if (latest?.note?.trim()) {
      return { hasIdDocument: true, idDocumentStatus: 'rejected' };
    }
    return { hasIdDocument: true, idDocumentStatus: 'pending' };
  }

  async listDocumentTypes(excludeNames: string[] = []) {
    const query = `
      query DocumentTypes {
        document_types(order_by: { name: asc }) {
          id
          name
          description
        }
      }
    `;
    const result = await this.hasuraUserService.executeQuery(query, {});
    const types = (result.document_types as { id: number; name: string; description: string }[]) ?? [];
    if (!excludeNames.length) return types;
    return types.filter((dt) => !excludeNames.includes(dt.name));
  }

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

    const user = await this.hasuraUserService.getUser();
    const useSystemService =
      await this.permissionService.hasPlatformPermission(
        user.id,
        PlatformPermissions.OPS_USER_DOCUMENTS
      );

    const uploadResult = useSystemService
      ? await this.hasuraSystemService.executeQuery(getUploadQuery, {
          uploadId,
        })
      : await this.hasuraUserService.executeQuery(getUploadQuery, {
          uploadId,
        });

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
   * @param targetUser When set, the upload is stored for this user instead of
   *   the request user (system-generated documents such as order receipts,
   *   which may be triggered by another party, e.g. a business confirming
   *   pickup).
   * @returns Promise<{ upload_record: any; presigned_url: string; expires_at: Date }>
   */
  async generateUploadUrl(
    uploadData: UploadData,
    targetUser?: { userId: string; persona: string }
  ): Promise<{
    upload_record: any;
    presigned_url: string;
    expires_at: Date;
  }> {
    let ownerId: string;
    let persona: string;
    let requestUser: Awaited<
      ReturnType<HasuraUserService['getUser']>
    > | null = null;
    if (targetUser) {
      ownerId = targetUser.userId;
      persona = targetUser.persona;
    } else {
      requestUser = await this.hasuraUserService.getUser();
      ownerId = requestUser.id;
      persona = resolveActivePersona(
        requestUser,
        this.hasuraUserService.getActivePersonaHeader()
      );
    }

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

    // Approval is decided server-side by document type; callers cannot set it.
    const documentTypeName = await this.getDocumentTypeName(
      uploadData.document_type_id
    );
    const isApproved = documentTypeName
      ? AUTO_APPROVED_DOCUMENT_TYPE_NAMES.includes(documentTypeName)
      : false;

    const key = `${persona}/${ownerId}/${uploadData.document_type_id}/${uploadData.file_name}`;

    // Generate presigned URL for S3 upload
    const presignedUrlResponse =
      await this.awsService.generatePresignedUploadUrl({
        bucketName: 'rendasua-user-uploads',
        key: key,
        contentType: uploadData.content_type,
        expiresIn: 3600, // 1 hour
        metadata: {
          'user-id': ownerId,
          'user-type': persona,
          'document-type-id': uploadData.document_type_id.toString(),
          'file-size': uploadData.file_size.toString(),
          'uploaded-at': new Date().toISOString(),
        },
      });

    // Save record in user_uploads table
    const insertMutation = `
      mutation InsertUserUpload(
        $user_id: uuid!,
        $document_type_id: Int!,
        $note: String,
        $content_type: String!,
        $key: String!,
        $file_name: String!,
        $file_size: bigint!,
        $is_approved: Boolean!
      ) {
        insert_user_uploads_one(object: {
          user_id: $user_id,
          document_type_id: $document_type_id,
          note: $note,
          content_type: $content_type,
          key: $key,
          file_name: $file_name,
          file_size: $file_size,
          is_approved: $is_approved
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
        user_id: ownerId,
        document_type_id: uploadData.document_type_id,
        note: uploadData.note || null,
        content_type: uploadData.content_type,
        key: key,
        file_name: uploadData.file_name,
        file_size: uploadData.file_size,
        is_approved: isApproved,
      }
    );

    const inserted = uploadRecord.insert_user_uploads_one as
      | { id: string }
      | undefined;
    if (inserted?.id && requestUser && persona === 'business') {
      void this.notifyBusinessIdUploadIfNeeded(
        requestUser,
        uploadData.document_type_id,
        inserted.id
      );
    }

    return {
      upload_record: uploadRecord.insert_user_uploads_one,
      presigned_url: presignedUrlResponse.url,
      expires_at: presignedUrlResponse.expiresAt,
    };
  }

  private async notifyBusinessIdUploadIfNeeded(
    user: {
      id: string;
      business?: { name?: string | null } | null;
    },
    documentTypeId: number,
    uploadId: string
  ): Promise<void> {
    try {
      const documentType = await this.getDocumentTypeName(documentTypeId);
      if (!documentType || !ID_DOCUMENT_TYPE_NAMES.includes(documentType)) {
        return;
      }
      await this.notificationsService.notifySuperusersIdDocumentUploaded({
        businessUserId: user.id,
        businessName: user.business?.name?.trim() || 'Business',
        documentType,
        uploadId,
      });
    } catch (error: any) {
      this.logger.error(
        `notifyBusinessIdUploadIfNeeded: ${error?.message ?? String(error)}`
      );
    }
  }

  private async getDocumentTypeName(
    documentTypeId: number
  ): Promise<string | null> {
    const query = `
      query DocumentTypeById($id: Int!) {
        document_types_by_pk(id: $id) { name }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      id: documentTypeId,
    });
    return (result.document_types_by_pk?.name as string | undefined) ?? null;
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

  /**
   * Approve a user upload record
   * @param uploadId Upload record ID
   * @returns Promise<void>
   */
  async approveUpload(uploadId: string): Promise<void> {
    // Clear note so a mistaken reject can be fully undone (reject stores reason in note).
    const approveMutation = `
      mutation ApproveUserUpload($uploadId: uuid!) {
        update_user_uploads_by_pk(
          pk_columns: { id: $uploadId }
          _set: { is_approved: true, note: null }
        ) {
          id
          is_approved
          note
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(
      approveMutation,
      { uploadId }
    );

    if (!result.update_user_uploads_by_pk) {
      throw new HttpException(
        {
          success: false,
          error: 'Upload record not found or could not be approved',
        },
        HttpStatus.NOT_FOUND
      );
    }

    // If this is an ID-type document for an agent, set agent is_verified = true
    const fetchUploadQuery = `
      query GetUploadWithType($uploadId: uuid!) {
        user_uploads_by_pk(id: $uploadId) {
          user_id
          document_type {
            name
          }
        }
      }
    `;
    const uploadData = await this.hasuraSystemService.executeQuery(
      fetchUploadQuery,
      { uploadId }
    );
    const upload = uploadData?.user_uploads_by_pk as
      | { user_id: string; document_type: { name: string } | null }
      | undefined;
    if (
      upload?.document_type?.name &&
      ID_DOCUMENT_TYPE_NAMES.includes(upload.document_type.name)
    ) {
      const agentByUserQuery = `
        query GetAgentByUserId($userId: uuid!) {
          agents(where: { user_id: { _eq: $userId } }, limit: 1) {
            id
          }
        }
      `;
      const agentResult = await this.hasuraSystemService.executeQuery(
        agentByUserQuery,
        { userId: upload.user_id }
      );
      const agent = (agentResult?.agents as { id: string }[] | undefined)?.[0];
      if (agent) {
        const updateAgentMutation = `
          mutation SetAgentVerified($agentId: uuid!) {
            update_agents_by_pk(
              pk_columns: { id: $agentId }
              _set: { is_verified: true }
            ) {
              id
              is_verified
            }
          }
        `;
        await this.hasuraSystemService.executeMutation(updateAgentMutation, {
          agentId: agent.id,
        });
      }

      void this.notifyBusinessIdApprovedIfNeeded(
        upload.user_id,
        upload.document_type.name
      );
    }
  }

  private async notifyBusinessIdApprovedIfNeeded(
    userId: string,
    documentType: string
  ): Promise<void> {
    try {
      const businessQuery = `
        query BusinessByUserId($userId: uuid!) {
          businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
            id
          }
        }
      `;
      const businessResult = await this.hasuraSystemService.executeQuery(
        businessQuery,
        { userId }
      );
      const business = (
        businessResult?.businesses as { id: string }[] | undefined
      )?.[0];
      if (!business) return;
      await this.notificationsService.sendBusinessIdDocumentApprovedEmail({
        businessUserId: userId,
        documentType,
      });
    } catch (error: any) {
      this.logger.error(
        `notifyBusinessIdApprovedIfNeeded: ${error?.message ?? String(error)}`
      );
    }
  }

  /**
   * Reject a user upload (superuser): set note to rejection message and is_approved to false.
   * The note is visible to the user.
   */
  async rejectUpload(uploadId: string, message: string): Promise<void> {
    const rejectMutation = `
      mutation RejectUserUpload($uploadId: uuid!, $note: String!) {
        update_user_uploads_by_pk(
          pk_columns: { id: $uploadId }
          _set: { note: $note, is_approved: false }
        ) {
          id
          note
          is_approved
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(
      rejectMutation,
      { uploadId, note: message }
    );

    if (!result.update_user_uploads_by_pk) {
      throw new HttpException(
        {
          success: false,
          error: 'Upload record not found or could not be rejected',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const fetchUploadQuery = `
      query GetUploadWithType($uploadId: uuid!) {
        user_uploads_by_pk(id: $uploadId) {
          user_id
          document_type {
            name
          }
        }
      }
    `;
    const uploadData = await this.hasuraSystemService.executeQuery(
      fetchUploadQuery,
      { uploadId }
    );
    const upload = uploadData?.user_uploads_by_pk as
      | { user_id: string; document_type: { name: string } | null }
      | undefined;
    if (
      upload?.document_type?.name &&
      ID_DOCUMENT_TYPE_NAMES.includes(upload.document_type.name)
    ) {
      void this.notifyBusinessIdRejectedIfNeeded(
        upload.user_id,
        upload.document_type.name,
        message
      );
    }
  }

  private async notifyBusinessIdRejectedIfNeeded(
    userId: string,
    documentType: string,
    reason: string
  ): Promise<void> {
    try {
      const businessQuery = `
        query BusinessByUserId($userId: uuid!) {
          businesses(where: { user_id: { _eq: $userId } }, limit: 1) {
            id
          }
        }
      `;
      const businessResult = await this.hasuraSystemService.executeQuery(
        businessQuery,
        { userId }
      );
      const business = (
        businessResult?.businesses as { id: string }[] | undefined
      )?.[0];
      if (!business) return;
      await this.notificationsService.sendBusinessIdDocumentRejectedEmail({
        businessUserId: userId,
        documentType,
        reason,
      });
    } catch (error: any) {
      this.logger.error(
        `notifyBusinessIdRejectedIfNeeded: ${error?.message ?? String(error)}`
      );
    }
  }
}
