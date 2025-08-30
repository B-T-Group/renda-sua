import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';
import { CreateRatingDto, RatingType } from './dto/create-rating.dto';

export interface Rating {
  id: string;
  order_id: string;
  rating_type: string;
  rater_user_id: string;
  rated_entity_type: string;
  rated_entity_id: string;
  rating: number;
  comment?: string;
  is_public: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface RatingAggregate {
  id: string;
  entity_type: string;
  entity_id: string;
  total_ratings: number;
  average_rating: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  last_rating_at?: string;
  updated_at: string;
}

@Injectable()
export class RatingsService {
  private readonly graphqlClient: GraphQLClient;

  constructor(private readonly configService: ConfigService) {
    this.graphqlClient = new GraphQLClient(
      this.configService.get<string>('HASURA_GRAPHQL_ENDPOINT') || '',
      {
        headers: {
          'x-hasura-admin-secret':
            this.configService.get<string>('HASURA_ADMIN_SECRET') || '',
        },
      }
    );
  }

  async createRating(
    createRatingDto: CreateRatingDto,
    userId: string
  ): Promise<Rating> {
    // Validate that the order exists and is completed
    const order = await this.getOrder(createRatingDto.orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.current_status !== 'complete') {
      throw new BadRequestException('Can only rate completed orders');
    }

    // Validate that the user is involved in the order
    const userProfile = await this.getUserProfile(userId);
    if (!userProfile) {
      throw new NotFoundException('User profile not found');
    }

    // Check if user has permission to rate based on order involvement
    const canRate = await this.validateOrderInvolvement(
      order,
      userProfile,
      createRatingDto.ratingType
    );
    if (!canRate) {
      throw new ForbiddenException('You are not authorized to rate this order');
    }

    // Check if user already rated this order for this type
    const existingRating = await this.getExistingRating(
      createRatingDto.orderId,
      createRatingDto.ratingType,
      userId
    );
    if (existingRating) {
      throw new BadRequestException(
        'You have already rated this order for this type'
      );
    }

    // Validate the rated entity exists
    const entityExists = await this.validateRatedEntity(
      createRatingDto.ratedEntityType,
      createRatingDto.ratedEntityId
    );
    if (!entityExists) {
      throw new NotFoundException('Rated entity not found');
    }

    // Create the rating
    const mutation = `
      mutation CreateRating($rating: ratings_insert_input!) {
        insert_ratings_one(object: $rating) {
          id
          order_id
          rating_type
          rater_user_id
          rated_entity_type
          rated_entity_id
          rating
          comment
          is_public
          is_verified
          created_at
          updated_at
        }
      }
    `;

    const variables = {
      rating: {
        order_id: createRatingDto.orderId,
        rating_type: createRatingDto.ratingType,
        rater_user_id: userId,
        rated_entity_type: createRatingDto.ratedEntityType,
        rated_entity_id: createRatingDto.ratedEntityId,
        rating: createRatingDto.rating,
        comment: createRatingDto.comment,
        is_public: createRatingDto.isPublic ?? true,
        is_verified: true, // Since we only allow ratings for completed orders
      },
    };

    try {
      const response = await this.graphqlClient.request(mutation, variables);
      return response.insert_ratings_one;
    } catch (error) {
      console.error('Error creating rating:', error);
      throw new BadRequestException('Failed to create rating');
    }
  }

  async getRatingAggregate(
    entityType: string,
    entityId: string
  ): Promise<RatingAggregate | null> {
    const query = `
      query GetRatingAggregate($entityType: String!, $entityId: uuid!) {
        rating_aggregates(where: {entity_type: {_eq: $entityType}, entity_id: {_eq: $entityId}}) {
          id
          entity_type
          entity_id
          total_ratings
          average_rating
          rating_1_count
          rating_2_count
          rating_3_count
          rating_4_count
          rating_5_count
          last_rating_at
          updated_at
        }
      }
    `;

    try {
      const response = await this.graphqlClient.request(query, {
        entityType,
        entityId,
      });
      return response.rating_aggregates[0] || null;
    } catch (error) {
      console.error('Error fetching rating aggregate:', error);
      return null;
    }
  }

  async getRatingsForEntity(
    entityType: string,
    entityId: string,
    limit = 10,
    offset = 0
  ): Promise<Rating[]> {
    const query = `
      query GetRatingsForEntity($entityType: String!, $entityId: uuid!, $limit: Int!, $offset: Int!) {
        ratings(
          where: {rated_entity_type: {_eq: $entityType}, rated_entity_id: {_eq: $entityId}, is_public: {_eq: true}}
          order_by: {created_at: desc}
          limit: $limit
          offset: $offset
        ) {
          id
          order_id
          rating_type
          rater_user_id
          rated_entity_type
          rated_entity_id
          rating
          comment
          is_public
          is_verified
          created_at
          updated_at
        }
      }
    `;

    try {
      const response = await this.graphqlClient.request(query, {
        entityType,
        entityId,
        limit,
        offset,
      });
      return response.ratings;
    } catch (error) {
      console.error('Error fetching ratings:', error);
      return [];
    }
  }

  private async getOrder(orderId: string): Promise<any> {
    const query = `
      query GetOrder($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          client_id
          business_id
          assigned_agent_id
          current_status
          created_at
        }
      }
    `;

    try {
      const response = await this.graphqlClient.request(query, { orderId });
      return response.orders_by_pk;
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    const query = `
      query GetUserProfile($userId: uuid!) {
        users_by_pk(id: $userId) {
          id
          user_type_id
          first_name
          last_name
          client {
            id
          }
          agent {
            id
          }
          business {
            id
          }
        }
      }
    `;

    try {
      const response = await this.graphqlClient.request(query, { userId });
      return response.users_by_pk;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  private async validateOrderInvolvement(
    order: any,
    userProfile: any,
    ratingType: RatingType
  ): Promise<boolean> {
    switch (ratingType) {
      case RatingType.CLIENT_TO_AGENT:
        return (
          userProfile.user_type_id === 'client' &&
          order.client_id === userProfile.client?.id
        );

      case RatingType.CLIENT_TO_ITEM:
        return (
          userProfile.user_type_id === 'client' &&
          order.client_id === userProfile.client?.id
        );

      case RatingType.AGENT_TO_CLIENT:
        return (
          userProfile.user_type_id === 'agent' &&
          order.assigned_agent_id === userProfile.agent?.id
        );

      default:
        return false;
    }
  }

  private async getExistingRating(
    orderId: string,
    ratingType: string,
    userId: string
  ): Promise<Rating | null> {
    const query = `
      query GetExistingRating($orderId: uuid!, $ratingType: rating_type_enum!, $userId: uuid!) {
        ratings(where: {order_id: {_eq: $orderId}, rating_type: {_eq: $ratingType}, rater_user_id: {_eq: $userId}}) {
          id
          order_id
          rating_type
          rater_user_id
          rated_entity_type
          rated_entity_id
          rating
          comment
          is_public
          is_verified
          created_at
          updated_at
        }
      }
    `;

    try {
      const response = await this.graphqlClient.request(query, {
        orderId,
        ratingType,
        userId,
      });
      return response.ratings[0] || null;
    } catch (error) {
      console.error('Error checking existing rating:', error);
      return null;
    }
  }

  private async validateRatedEntity(
    entityType: string,
    entityId: string
  ): Promise<boolean> {
    let query: string;

    switch (entityType) {
      case 'agent':
        query = `
          query ValidateAgent($entityId: uuid!) {
            agents_by_pk(id: $entityId) {
              id
            }
          }
        `;
        break;

      case 'client':
        query = `
          query ValidateClient($entityId: uuid!) {
            clients_by_pk(id: $entityId) {
              id
            }
          }
        `;
        break;

      case 'item':
        query = `
          query ValidateItem($entityId: uuid!) {
            items_by_pk(id: $entityId) {
              id
            }
          }
        `;
        break;

      default:
        return false;
    }

    try {
      const response = await this.graphqlClient.request(query, { entityId });
      const entityKey = Object.keys(response)[0];
      return !!response[entityKey];
    } catch (error) {
      console.error('Error validating rated entity:', error);
      return false;
    }
  }
}
