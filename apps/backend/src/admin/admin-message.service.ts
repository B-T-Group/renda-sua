import { Injectable } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Injectable()
export class AdminMessageService {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async validateEntityType(entityType: string): Promise<boolean> {
    try {
      const query = `
        query GetEntityType($id: String!) {
          entity_types_by_pk(id: $id) {
            id
            comment
          }
        }
      `;

      const result = await this.hasuraUserService.executeQuery(query, {
        id: entityType,
      });

      return !!result.entity_types_by_pk;
    } catch (error) {
      console.error('Error validating entity type:', error);
      return false;
    }
  }

  async createMessage(
    userId: string,
    entityType: string,
    entityId: string,
    message: string
  ): Promise<string> {
    const mutation = `
      mutation CreateAdminMessage($user_id: uuid!, $entity_type: entity_types_enum!, $entity_id: uuid!, $message: String!) {
        insert_user_messages_one(object: {
          user_id: $user_id,
          entity_type: $entity_type,
          entity_id: $entity_id,
          message: $message
        }) {
          id
          user_id
          entity_type
          entity_id
          message
          created_at
        }
      }
    `;

    const result = await this.hasuraUserService.executeMutation(mutation, {
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      message: message,
    });

    if (!result.insert_user_messages_one) {
      throw new Error('Failed to create message');
    }

    return result.insert_user_messages_one.id;
  }
}
