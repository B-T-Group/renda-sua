export interface FoodAvailabilitySlot {
  day_of_week: number;
  /** HH:mm or HH:mm:ss. Earlier than start_time means the window runs past midnight. */
  start_time: string;
  end_time: string;
}

/** Availability block returned with cooked-food storefront rows. */
export interface FoodAvailability {
  has_schedule: boolean;
  is_open_now: boolean;
  is_marked_unavailable_today: boolean;
  is_available_now: boolean;
  next_opening_at: string | null;
  timezone: string;
  slots: FoodAvailabilitySlot[];
}

/** Optional stock correction a merchant sends while confirming an order. */
export interface FoodConfirmationStockUpdate {
  order_item_id: string;
  /** Portions still for sale after this order. */
  remaining_quantity?: number;
  /** Takes the dish off the menu for the rest of the day. */
  last_one?: boolean;
}

export interface FoodSettings {
  item_id: string;
  business_location_id: string;
  marked_unavailable_at: string | null;
  timezone: string;
  has_schedule: boolean;
  is_open_now: boolean;
  is_marked_unavailable_today: boolean;
  is_available_now: boolean;
  next_opening_at: string | null;
  slots: FoodAvailabilitySlot[];
}
