import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  PlatformPermissions,
  PlatformRoles,
} from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';
import { isActivePersona } from '../users/persona.util';

@Injectable()
export class PermissionService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly rbacService: RbacService
  ) {}

  /**
   * Check if user can view a specific user upload
   * @param userId Current user ID
   * @param uploadId Upload record ID
   * @returns Promise<boolean> True if user can view the upload
   */
  async canViewUserUpload(userId: string, uploadId: string): Promise<boolean> {
    try {
      // Platform document ops can view any upload
      const canViewAll = await this.rbacService.hasPermission(
        userId,
        PlatformPermissions.OPS_USER_DOCUMENTS
      );
      if (canViewAll) {
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
   * Platform superuser (RBAC role `superuser`).
   */
  async isBusinessAdmin(userId: string): Promise<boolean> {
    try {
      return await this.rbacService.hasRole(userId, PlatformRoles.SUPERUSER);
    } catch (error) {
      console.error('Error checking business admin status:', error);
      return false;
    }
  }

  async hasPlatformPermission(
    userId: string,
    permissionKey: string
  ): Promise<boolean> {
    return this.rbacService.hasPermission(userId, permissionKey);
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
      if (isActivePersona(currentUser, 'business')) {
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

        return await this.rbacService.hasPermission(
          userId,
          PlatformPermissions.MANAGE_BUSINESSES
        );
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
      return await this.rbacService.hasAnyPermission(userId, [
        PlatformPermissions.MANAGE_AGENTS,
        PlatformPermissions.MANAGE_CLIENTS,
        PlatformPermissions.MANAGE_BUSINESSES,
        PlatformPermissions.RBAC_MANAGE,
      ]);
    } catch (error) {
      console.error('Error checking user management permission:', error);
      return false;
    }
  }

  /**
   * Check if user can view uploads from other users
   */
  async canViewOtherUserUploads(userId: string): Promise<boolean> {
    return this.rbacService.hasPermission(
      userId,
      PlatformPermissions.OPS_USER_DOCUMENTS
    );
  }
}
