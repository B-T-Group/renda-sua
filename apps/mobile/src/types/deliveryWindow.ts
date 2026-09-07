/** Aligné backend `/delivery-windows/slots` et web `useDeliveryTimeSlots`. */

export interface DeliveryTimeSlot {
  id: string;
  slot_name: string;
  slot_type: 'standard' | 'fast' | string;
  start_time: string;
  end_time: string;
  available_capacity: number;
  is_available: boolean;
}

export interface ClientDeliveryWindowPayload {
  slot_id: string;
  preferred_date: string;
}
