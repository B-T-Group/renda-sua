import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Configuration } from '../config/configuration';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateRatingDto, RatingType } from './dto/create-rating.dto';

// User Profile Types
interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  client?: { id: string };
  agent?: { id: string };
  business?: { id: string };
}

// Order Types
interface OrderData {
  id: string;
  order_number: string;
  client_id: string;
  business_id: string;
  assigned_agent_id?: string;
  current_status: string;
  created_at: string;
  completed_at?: string | null;
  order_items?: Array<{ item_id: string; item_name: string }>;
}

export interface OrderRatingEligibilityItem {
  id: string;
  name: string;
  rated: boolean;
}

export interface OrderRatingEligibility {
  canRateAgent: boolean;
  canRateItem: boolean;
  canRateClient: boolean;
  /** When client_to_item ratings unlock; null until the order is completed. */
  itemRatingUnlocksAt: string | null;
  agentId: string | null;
  clientId: string | null;
  items: OrderRatingEligibilityItem[];
}

export interface Rating {
  id: string;
  order_id?: string | null;
  rental_booking_id?: string | null;
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
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<Configuration>
  ) {}

  private getItemRatingDelayDays(): number {
    return (
      this.configService.get<Configuration['rating']>('rating')
        ?.itemRatingDelayDays ?? 7
    );
  }

  /** When client_to_item ratings unlock for the order; null until completed. */
  getItemRatingUnlocksAt(completedAt?: string | null): Date | null {
    if (!completedAt) return null;
    const completed = new Date(completedAt).getTime();
    if (Number.isNaN(completed)) return null;
    return new Date(
      completed + this.getItemRatingDelayDays() * 24 * 60 * 60 * 1000
    );
  }

  async createRating(
    createRatingDto: CreateRatingDto,
    userId: string
  ): Promise<Rating> {
    if (createRatingDto.rentalBookingId) {
      return this.createRentalBookingRating(createRatingDto, userId);
    }
    if (!createRatingDto.orderId) {
      throw new BadRequestException('orderId or rentalBookingId is required');
    }
    return this.createOrderRating(createRatingDto, userId);
  }

  private async createOrderRating(
    createRatingDto: CreateRatingDto,
    userId: string
  ): Promise<Rating> {
    const orderId = createRatingDto.orderId!;
    // Validate that the order exists and is completed
    const order = await this.getOrder(orderId);
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

    if (createRatingDto.ratingType === RatingType.CLIENT_TO_ITEM) {
      this.assertClientToItemAllowed(order, createRatingDto);
    }

    // Check if user already rated this order for this type
    // (client_to_item is deduped per line item, other types per order)
    const existingRating = await this.getExistingRating(
      orderId,
      createRatingDto.ratingType,
      userProfile.id,
      createRatingDto.ratingType === RatingType.CLIENT_TO_ITEM
        ? createRatingDto.ratedEntityId
        : undefined
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
          rental_booking_id
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
        order_id: orderId,
        rating_type: createRatingDto.ratingType,
        rater_user_id: userProfile.id,
        rated_entity_type: createRatingDto.ratedEntityType,
        rated_entity_id: createRatingDto.ratedEntityId,
        rating: createRatingDto.rating,
        comment: createRatingDto.comment,
        is_public: createRatingDto.isPublic ?? true,
        is_verified: true, // Since we only allow ratings for completed orders
      },
    };

    try {
      const response = await this.hasuraSystemService.executeMutation(
        mutation,
        variables
      );
      const rating = response.insert_ratings_one as Rating;
      void this.notifyRatedEntityRecipient(
        createRatingDto,
        order,
        userProfile,
        rating
      );
      return rating;
    } catch (error: any) {
      console.error('Error creating rating:', error);
      throw new BadRequestException('Failed to create rating');
    }
  }

  /** Item ratings unlock only after the configured delay and must target an order line item. */
  private assertClientToItemAllowed(
    order: OrderData,
    dto: CreateRatingDto
  ): void {
    const itemIds = (order.order_items ?? []).map((i) => i.item_id);
    if (!itemIds.includes(dto.ratedEntityId)) {
      throw new BadRequestException('Item is not part of this order');
    }
    const unlocksAt = this.getItemRatingUnlocksAt(order.completed_at);
    if (!unlocksAt || unlocksAt.getTime() > Date.now()) {
      throw new BadRequestException(
        `Item ratings unlock ${this.getItemRatingDelayDays()} days after the order is completed`
      );
    }
  }

  private async createRentalBookingRating(
    createRatingDto: CreateRatingDto,
    userId: string
  ): Promise<Rating> {
    const bookingId = createRatingDto.rentalBookingId!;
    const booking = await this.getRentalBooking(bookingId);
    if (!booking) {
      throw new NotFoundException('Rental booking not found');
    }
    if (booking.status !== 'completed') {
      throw new BadRequestException('Can only rate completed rental bookings');
    }

    const userProfile = await this.getUserProfile(userId);
    if (!userProfile?.client?.id) {
      throw new ForbiddenException('Only clients can rate rentals');
    }
    if (userProfile.client.id !== booking.client_id) {
      throw new ForbiddenException('You are not authorized to rate this booking');
    }

    const allowedTypes = [
      RatingType.CLIENT_TO_RENTAL_ITEM,
      RatingType.CLIENT_TO_RENTAL_BUSINESS,
    ];
    if (!allowedTypes.includes(createRatingDto.ratingType)) {
      throw new BadRequestException('Invalid rating type for rental booking');
    }

    const existing = await this.getExistingRentalRating(
      bookingId,
      createRatingDto.ratingType,
      userProfile.id
    );
    if (existing) {
      throw new BadRequestException(
        'You have already rated this rental for this type'
      );
    }

    const entityExists = await this.validateRatedEntity(
      createRatingDto.ratedEntityType,
      createRatingDto.ratedEntityId
    );
    if (!entityExists) {
      throw new NotFoundException('Rated entity not found');
    }

    const mutation = `
      mutation CreateRentalRating($rating: ratings_insert_input!) {
        insert_ratings_one(object: $rating) {
          id
          order_id
          rental_booking_id
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

    const response = await this.hasuraSystemService.executeMutation(mutation, {
      rating: {
        rental_booking_id: bookingId,
        rating_type: createRatingDto.ratingType,
        rater_user_id: userProfile.id,
        rated_entity_type: createRatingDto.ratedEntityType,
        rated_entity_id: createRatingDto.ratedEntityId,
        rating: createRatingDto.rating,
        comment: createRatingDto.comment,
        is_public: createRatingDto.isPublic ?? true,
        is_verified: true,
      },
    });
    return response.insert_ratings_one as Rating;
  }

  async getRatingsForRentalBooking(bookingId: string): Promise<Rating[]> {
    const query = `
      query RatingsForRentalBooking($bookingId: uuid!) {
        ratings(where: { rental_booking_id: { _eq: $bookingId } }) {
          id
          order_id
          rental_booking_id
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
    const response = await this.hasuraSystemService.executeQuery(query, {
      bookingId,
    });
    return (response.ratings as Rating[]) ?? [];
  }

  private async getRentalBooking(bookingId: string): Promise<{
    id: string;
    client_id: string;
    business_id: string;
    status: string;
    rental_location_listing?: {
      rental_item_id?: string;
      rental_item?: { id: string } | null;
    } | null;
  } | null> {
    const query = `
      query RentalBookingForRating($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id
          client_id
          business_id
          status
          rental_location_listing {
            rental_item_id
            rental_item { id }
          }
        }
      }
    `;
    const response = await this.hasuraSystemService.executeQuery(query, {
      id: bookingId,
    });
    return response.rental_bookings_by_pk ?? null;
  }

  private async getExistingRentalRating(
    rentalBookingId: string,
    ratingType: RatingType,
    raterUserId: string
  ): Promise<Rating | null> {
    const query = `
      query ExistingRentalRating(
        $rentalBookingId: uuid!
        $ratingType: rating_type_enum!
        $raterUserId: uuid!
      ) {
        ratings(
          where: {
            rental_booking_id: { _eq: $rentalBookingId }
            rating_type: { _eq: $ratingType }
            rater_user_id: { _eq: $raterUserId }
          }
          limit: 1
        ) {
          id
        }
      }
    `;
    const response = await this.hasuraSystemService.executeQuery(query, {
      rentalBookingId,
      ratingType,
      raterUserId,
    });
    return (response.ratings as Rating[])?.[0] ?? null;
  }

  private async notifyRatedEntityRecipient(
    dto: CreateRatingDto,
    order: OrderData,
    rater: UserProfile,
    rating: Rating
  ): Promise<void> {
    try {
      const recipientUserId = await this.resolveRatedEntityRecipientUserId(
        dto.ratedEntityType,
        dto.ratedEntityId
      );
      if (!recipientUserId) return;

      const raterName = `${rater.first_name ?? ''} ${rater.last_name ?? ''}`.trim();
      const recipient = await this.getUserPreferredLanguage(recipientUserId);

      await this.notificationsService.sendRatingReceivedPush({
        recipientUserId,
        raterUserId: rating.rater_user_id,
        orderId: dto.orderId ?? order.id,
        orderNumber: order.order_number,
        ratingType: dto.ratingType,
        ratedEntityType: dto.ratedEntityType,
        rating: dto.rating,
        raterName: raterName || undefined,
        preferredLanguage: recipient,
      });
    } catch (error: any) {
      this.logger.warn(
        `Rating push failed for order ${order.order_number}: ${
          error?.message ?? String(error)
        }`
      );
    }
  }

  private async resolveRatedEntityRecipientUserId(
    entityType: string,
    entityId: string
  ): Promise<string | null> {
    const query = this.buildRecipientLookupQuery(entityType);
    if (!query) return null;

    const response = await this.hasuraSystemService.executeQuery(query, {
      entityId,
    });
    return this.extractRecipientUserId(entityType, response);
  }

  private buildRecipientLookupQuery(entityType: string): string | null {
    switch (entityType) {
      case 'agent':
        return `
          query RatedAgentRecipient($entityId: uuid!) {
            agents_by_pk(id: $entityId) { user_id }
          }
        `;
      case 'client':
        return `
          query RatedClientRecipient($entityId: uuid!) {
            clients_by_pk(id: $entityId) { user_id }
          }
        `;
      case 'item':
        return `
          query RatedItemRecipient($entityId: uuid!) {
            items_by_pk(id: $entityId) {
              business { user_id }
            }
          }
        `;
      case 'rental_item':
        return `
          query RatedRentalItemRecipient($entityId: uuid!) {
            rental_items_by_pk(id: $entityId) {
              business { user_id }
            }
          }
        `;
      case 'business':
        return `
          query RatedBusinessRecipient($entityId: uuid!) {
            businesses_by_pk(id: $entityId) { user_id }
          }
        `;
      default:
        return null;
    }
  }

  private extractRecipientUserId(
    entityType: string,
    response: Record<string, any>
  ): string | null {
    if (entityType === 'agent') {
      return response.agents_by_pk?.user_id ?? null;
    }
    if (entityType === 'client') {
      return response.clients_by_pk?.user_id ?? null;
    }
    if (entityType === 'item') {
      return response.items_by_pk?.business?.user_id ?? null;
    }
    if (entityType === 'rental_item') {
      return response.rental_items_by_pk?.business?.user_id ?? null;
    }
    if (entityType === 'business') {
      return response.businesses_by_pk?.user_id ?? null;
    }
    return null;
  }

  private async getUserPreferredLanguage(
    userId: string
  ): Promise<string | null> {
    const query = `
      query RatingRecipientLanguage($userId: uuid!) {
        users_by_pk(id: $userId) { preferred_language }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        userId,
      });
      return response.users_by_pk?.preferred_language ?? null;
    } catch (error: any) {
      this.logger.warn(
        `Could not load preferred language for ${userId}: ${
          error?.message ?? String(error)
        }`
      );
      return null;
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
      const response = await this.hasuraSystemService.executeQuery(query, {
        entityType,
        entityId,
      });
      return response.rating_aggregates[0] || null;
    } catch (error: any) {
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
      const response = await this.hasuraSystemService.executeQuery(query, {
        entityType,
        entityId,
        limit,
        offset,
      });
      return response.ratings;
    } catch (error: any) {
      console.error('Error fetching ratings:', error);
      return [];
    }
  }

  async getRatingsForOrder(orderId: string): Promise<Rating[]> {
    const query = `
      query GetRatingsForOrder($orderId: uuid!) {
        ratings(
          where: {order_id: {_eq: $orderId}}
          order_by: {created_at: desc}
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
      const response = await this.hasuraSystemService.executeQuery(query, {
        orderId,
      });
      return response.ratings;
    } catch (error: any) {
      console.error('Error fetching order ratings:', error);
      return [];
    }
  }

  /** Per-user rating eligibility for an order (drives Rate CTAs on web/mobile). */
  async getOrderRatingEligibility(
    orderId: string,
    userId: string
  ): Promise<OrderRatingEligibility> {
    const [order, userProfile, ratings] = await Promise.all([
      this.getOrder(orderId),
      this.getUserProfile(userId),
      this.getRatingsForOrder(orderId),
    ]);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (!userProfile) {
      throw new NotFoundException('User profile not found');
    }
    return this.buildEligibility(order, userProfile, ratings);
  }

  private buildEligibility(
    order: OrderData,
    userProfile: UserProfile,
    ratings: Rating[]
  ): OrderRatingEligibility {
    const isComplete = order.current_status === 'complete';
    const isClientRater =
      !!userProfile.client && order.client_id === userProfile.client.id;
    const isAgentRater =
      !!userProfile.agent && order.assigned_agent_id === userProfile.agent.id;
    const myRatings = ratings.filter(
      (r) => r.rater_user_id === userProfile.id
    );
    const hasRated = (type: string) =>
      myRatings.some((r) => r.rating_type === type);

    const ratedItemIds = new Set(
      myRatings
        .filter((r) => r.rating_type === 'client_to_item')
        .map((r) => r.rated_entity_id)
    );
    const items = this.dedupeOrderItems(order).map((item) => ({
      id: item.item_id,
      name: item.item_name,
      rated: ratedItemIds.has(item.item_id),
    }));

    const unlocksAt = this.getItemRatingUnlocksAt(order.completed_at);
    const itemRatingUnlocked = !!unlocksAt && unlocksAt.getTime() <= Date.now();

    return {
      canRateAgent:
        isComplete &&
        isClientRater &&
        !!order.assigned_agent_id &&
        !hasRated('client_to_agent'),
      canRateItem:
        isComplete &&
        isClientRater &&
        itemRatingUnlocked &&
        items.some((i) => !i.rated),
      canRateClient:
        isComplete && isAgentRater && !hasRated('agent_to_client'),
      itemRatingUnlocksAt: unlocksAt ? unlocksAt.toISOString() : null,
      agentId: order.assigned_agent_id ?? null,
      clientId: order.client_id ?? null,
      items,
    };
  }

  private dedupeOrderItems(
    order: OrderData
  ): Array<{ item_id: string; item_name: string }> {
    const seen = new Map<string, { item_id: string; item_name: string }>();
    for (const item of order.order_items ?? []) {
      if (!seen.has(item.item_id)) seen.set(item.item_id, item);
    }
    return Array.from(seen.values());
  }

  private async getOrder(orderId: string): Promise<OrderData | null> {
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
          completed_at
          order_items {
            item_id
            item_name
          }
        }
      }
    `;

    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        orderId,
      });
      return response.orders_by_pk;
    } catch (error: any) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    const query = `
      query GetUserProfile($userId: uuid!) {
        users_by_pk(id: $userId) {
          id
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
      const response = await this.hasuraSystemService.executeQuery(query, {
        userId,
      });
      return response.users_by_pk ?? null;
    } catch (error: any) {
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
          !!userProfile.client &&
          order.client_id === userProfile.client.id
        );

      case RatingType.CLIENT_TO_ITEM:
        return (
          !!userProfile.client &&
          order.client_id === userProfile.client.id
        );

      case RatingType.AGENT_TO_CLIENT:
        return (
          !!userProfile.agent &&
          order.assigned_agent_id === userProfile.agent.id
        );

      default:
        return false;
    }
  }

  private async getExistingRating(
    orderId: string,
    ratingType: string,
    userId: string,
    ratedEntityId?: string
  ): Promise<Rating | null> {
    const entityFilter = ratedEntityId
      ? ', rated_entity_id: {_eq: $ratedEntityId}'
      : '';
    const entityVar = ratedEntityId ? ', $ratedEntityId: uuid!' : '';
    const query = `
      query GetExistingRating($orderId: uuid!, $ratingType: rating_type_enum!, $userId: uuid!${entityVar}) {
        ratings(where: {order_id: {_eq: $orderId}, rating_type: {_eq: $ratingType}, rater_user_id: {_eq: $userId}${entityFilter}}) {
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
      const response = await this.hasuraSystemService.executeQuery(query, {
        orderId,
        ratingType,
        userId,
        ...(ratedEntityId ? { ratedEntityId } : {}),
      });
      return response.ratings[0] || null;
    } catch (error: any) {
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

      case 'rental_item':
        query = `
          query ValidateRentalItem($entityId: uuid!) {
            rental_items_by_pk(id: $entityId) {
              id
            }
          }
        `;
        break;

      case 'business':
        query = `
          query ValidateBusiness($entityId: uuid!) {
            businesses_by_pk(id: $entityId) {
              id
            }
          }
        `;
        break;

      default:
        return false;
    }

    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        entityId,
      });
      const entityKey = Object.keys(response)[0];
      return !!response[entityKey];
    } catch (error: any) {
      console.error('Error validating rated entity:', error);
      return false;
    }
  }
}
