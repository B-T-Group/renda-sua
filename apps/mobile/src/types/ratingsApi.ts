/** POST /ratings — aligné backend `CreateRatingDto`. */

export type RatingTypeApi =
  | 'client_to_agent'
  | 'client_to_item'
  | 'agent_to_client'
  | 'client_to_rental_item'
  | 'client_to_rental_business';
export type RatedEntityTypeApi =
  | 'agent'
  | 'client'
  | 'item'
  | 'rental_item'
  | 'business';

export interface CreateRatingBody {
  orderId?: string;
  rentalBookingId?: string;
  ratingType: RatingTypeApi;
  ratedEntityType: RatedEntityTypeApi;
  ratedEntityId: string;
  rating: number;
  comment?: string;
  isPublic?: boolean;
}

export interface CreateRatingResponse {
  success: boolean;
  message?: string;
  rating?: unknown;
}

/** GET /ratings/order/:orderId/eligibility */
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

export interface OrderRatingEligibilityResponse {
  success: boolean;
  message?: string;
  eligibility: OrderRatingEligibility | null;
}

/** GET /ratings/aggregate/:entityType/:entityId */
export interface RatingAggregateApi {
  entity_type: string;
  entity_id: string;
  total_ratings: number;
  average_rating: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  last_rating_at?: string | null;
}

export interface RatingAggregateResponse {
  success: boolean;
  message?: string;
  aggregate: RatingAggregateApi | null;
}

/** GET /ratings/entity/:entityType/:entityId */
export interface EntityRatingApi {
  id: string;
  order_id?: string | null;
  rating_type: RatingTypeApi;
  rated_entity_type: RatedEntityTypeApi;
  rated_entity_id: string;
  rating: number;
  comment?: string | null;
  is_public: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface EntityRatingsResponse {
  success: boolean;
  message?: string;
  ratings: EntityRatingApi[];
}
