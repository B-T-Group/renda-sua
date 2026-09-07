export interface PickupReminderPayload {
  orderId: string;
  orderNumber?: string;
  title: string;
  body: string;
  businessName?: string;
  pickupDueAt?: string;
}
