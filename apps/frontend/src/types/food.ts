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

export interface FoodSettings {
  item_id: string;
  business_location_id: string;
  marked_unavailable_at: string | null;
  timezone: string;
  is_open_now: boolean;
  is_available_now: boolean;
  next_opening_at: string | null;
  slots: FoodAvailabilitySlot[];
}
