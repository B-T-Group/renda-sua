import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Injectable()
export class PermissionService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  /**
   * Check if user can view a specific user upload
   * @param userId Current user ID
   * @param uploadId Upload record ID
   * @returns Promise<boolean> True if user can view the upload
   */
  async canViewUserUpload(userId: string, uploadId: string): Promise<boolean> {
    try {
      // Superuser (business admin) can view any upload – use system query to bypass RLS
      const isAdmin = await this.isBusinessAdmin(userId);
      if (isAdmin) {
        const systemUploadResult =
          await this.hasuraSystemService.executeQuery(
            `query GetUserUpload($uploadId: uuid!) {
              user_uploads_by_pk(id: $uploadId) { id }
            }`,
            { uploadId }
          );
        if (systemUploadResult?.user_uploads_by_pk) {
          return true;
        }
      }

      // Get the upload record to check ownership (subject to RLS)
      const getUploadQuery = `
        query GetUserUpload($uploadId: uuid!) {
          user_uploads_by_pk(id: $uploadId) {
            id
            user_id
          }
        }
      `;

      const uploadResult = await this.hasuraUserService.executeQuery(
        getUploadQuery,
        { uploadId }
      );

      if (!uploadResult.user_uploads_by_pk) {
        return false; // Upload doesn't exist or not visible to user
      }

      const uploadRecord = uploadResult.user_uploads_by_pk;

      // Check if user owns the upload
      if (uploadRecord.user_id === userId) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking upload view permission:', error);
      return false;
    }
  }

  /**
   * Check if user can edit a specific user upload
   * @param userId Current user ID
   * @param uploadId Upload record ID
   * @returns Promise<boolean> True if user can edit the upload
   */
  async canEditUserUpload(userId: string, uploadId: string): Promise<boolean> {
    try {
      // Get the upload record to check ownership
      const getUploadQuery = `
        query GetUserUpload($uploadId: uuid!) {
          user_uploads_by_pk(id: $uploadId) {
            id
            user_id
            is_approved
          }
        }
      `;

      const uploadResult = await this.hasuraUserService.executeQuery(
        getUploadQuery,
        { uploadId }
      );

      if (!uploadResult.user_uploads_by_pk) {
        return false;
      }

      const uploadRecord = uploadResult.user_uploads_by_pk;

      // Only owners can edit their uploads
      return uploadRecord.user_id === userId;
    } catch (error) {
      console.error('Error checking upload edit permission:', error);
      return false;
    }
  }

  /**
   * Check if user can delete a specific user upload
   * @param userId Current user ID
   * @param uploadId Upload record ID
   * @returns Promise<boolean> True if user can delete the upload
   */
  async canDeleteUserUpload(
    userId: string,
    uploadId: string
  ): Promise<boolean> {
    try {
      // Get the upload record to check ownership
      const getUploadQuery = `
        query GetUserUpload($uploadId: uuid!) {
          user_uploads_by_pk(id: $uploadId) {
            id
            user_id
            is_approved
          }
        }
      `;

      const uploadResult = await this.hasuraUserService.executeQuery(
        getUploadQuery,
        { uploadId }
      );

      if (!uploadResult.user_uploads_by_pk) {
        return false;
      }

      const uploadRecord = uploadResult.user_uploads_by_pk;

      // Only owners can delete their uploads
      return uploadRecord.user_id === userId;
    } catch (error) {
      console.error('Error checking upload delete permission:', error);
      return false;
    }
  }

  /**
   * Check if user is a business with admin privileges
   * @param userId User ID to check
   * @returns Promise<boolean> True if user is a business admin
   */
  async isBusinessAdmin(userId: string): Promise<boolean> {
    try {
      const businessQuery = `
        query GetBusinessAdminStatus($userId: uuid!) {
          businesses(where: {user_id: {_eq: $userId}}) {
            id
            is_admin
          }
        }
      `;

      const businessResult = await this.hasuraUserService.executeQuery(
        businessQuery,
        { userId }
      );

      return businessResult.businesses?.[0]?.is_admin === true;
    } catch (error) {
      console.error('Error checking business admin status:', error);
      return false;
    }
  }

  /**
   * Check if user can access business data
   * @param userId Current user ID
   * @param businessId Business ID to check access for
   * @returns Promise<boolean> True if user can access the business data
   */
  async canAccessBusinessData(
    userId: string,
    businessId: string
  ): Promise<boolean> {
    try {
      const currentUser = await this.hasuraUserService.getUser();

      // Business owners can access their own data
      if (currentUser.business) {
        const businessQuery = `
          query GetBusinessOwnership($userId: uuid!, $businessId: uuid!) {
            businesses(where: {user_id: {_eq: $userId}, id: {_eq: $businessId}}) {
              id
            }
          }
        `;

        const businessResult = await this.hasuraUserService.executeQuery(
          businessQuery,
          { userId, businessId }
        );

        if (businessResult.businesses?.length > 0) {
          return true;
        }

        const isAdmin = await this.isBusinessAdmin(userId);
        return isAdmin;
      }

      return false;
    } catch (error) {
      console.error('Error checking business data access:', error);
      return false;
    }
  }

  /**
   * Check if user can manage other users (admin only)
   * @param userId Current user ID
   * @returns Promise<boolean> True if user can manage other users
   */
  async canManageUsers(userId: string): Promise<boolean> {
    try {
      const currentUser = await this.hasuraUserService.getUser();

      if (currentUser.business) {
        return await this.isBusinessAdmin(userId);
      }

      return false;
    } catch (error) {
      console.error('Error checking user management permission:', error);
      return false;
    }
  }

  /**
   * Check if user can view uploads from other users (business admins)
   * @param userId User ID
   * @returns Promise<boolean>
   */
  async canViewOtherUserUploads(userId: string): Promise<boolean> {
    const isAdmin = await this.isBusinessAdmin(userId);
    return isAdmin;
  }
}
