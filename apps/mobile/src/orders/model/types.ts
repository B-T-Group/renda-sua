import type { OrderPhase, OrderPrimaryActionId } from '../../utils/orderPhase';
import type { AddressFields } from '../../components/orders/shared/AddressCard';
import type { ContactInfo } from '../../components/orders/shared/ContactCard';
import type { TimelineEntry } from '../../components/orders/shared/Timeline';

export type OrderActionVariant = 'contained' | 'outlined' | 'text' | 'danger';

export type OrderActionId =
  | OrderPrimaryActionId
  | 'reject'
  | 'mark_preparing'
  | 'contact_business'
  | 'contact_customer'
  | 'contact_agent'
  | 'track'
  | 'report_issue'
  | 'navigate_pickup'
  | 'navigate_delivery'
  | 'arrived'
  | 'unable_pickup'
  | 'drop_order'
  | 'pickup_delay'
  | 'report_pickup_issue'
  | 'fail_delivery'
  | 'request_payment'
  | 'switch_to_pickup'
  | 'request_refund';

export interface OrderActionDescriptor {
  id: OrderActionId;
  labelKey: string;
  labelDefault: string;
  variant: OrderActionVariant;
  disabled?: boolean;
  reason?: string;
  primary?: boolean;
}

export interface OrderViewModelContext {
  t: (
    key: string,
    defaultValue?: string,
    options?: Record<string, unknown>
  ) => string;
  now: Date;
  locale?: string;
}

export interface OrderMoneySummary {
  subtotal?: number | null;
  deliveryFee?: number | null;
  tax?: number | null;
  total?: number | null;
  currency?: string | null;
}

export interface ProductListItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number | null;
  totalPrice?: number | null;
  currency?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
}

export interface ClientOrderViewModel {
  orderId: string;
  orderNumber: string;
  status: string;
  statusMessage: string;
  heroTitle: string;
  nextStepMessage: string | null;
  etaText: string | null;
  progress: { activeStep: number; totalSteps: number };
  phase: OrderPhase;
  primaryActionId: OrderPrimaryActionId;
  businessName: string | null;
  summary: OrderMoneySummary;
  contacts: {
    business: ContactInfo | null;
    agent: ContactInfo | null;
  };
  timeline: TimelineEntry[];
  items: ProductListItem[];
  availableActions: OrderActionDescriptor[];
}

export interface BusinessOrderViewModel {
  orderId: string;
  orderNumber: string;
  status: string;
  statusMessage: string;
  requiredAction: string;
  heroTitle: string;
  nextStepMessage: string | null;
  slaCountdown: {
    deadlineAt: string | null;
    label: string;
    overdue: boolean;
  } | null;
  phase: OrderPhase;
  primaryActionId: OrderPrimaryActionId;
  customer: ContactInfo | null;
  items: ProductListItem[];
  notes: string | null;
  paymentStatus: string | null;
  paymentStatusLabel: string | null;
  deliveryWindowLabel: string | null;
  assignedAgent: ContactInfo | null;
  summary: OrderMoneySummary;
  availableActions: OrderActionDescriptor[];
}

export interface DeliveryStopView {
  kind: 'pickup' | 'delivery';
  title: string;
  address: AddressFields | null;
  contact: ContactInfo | null;
  instructions: string | null;
}

export interface PackageProperty {
  id: string;
  label: string;
}

export interface DeliveryRequirement {
  id: string;
  label: string;
}

export interface DeliveryEarnings {
  commission?: number | null;
  tips?: number | null;
  bonuses?: number | null;
  estimatedTotal?: number | null;
  currency?: string | null;
}

export interface DeliveryOrderViewModel {
  orderId: string;
  orderNumber: string;
  status: string;
  statusMessage: string;
  currentObjective: string;
  heroTitle: string;
  nextStepMessage: string | null;
  urgency: {
    deadlineAt: string | null;
    label: string;
    overdue: boolean;
  } | null;
  phase: OrderPhase;
  primaryActionId: OrderPrimaryActionId;
  stops: DeliveryStopView[];
  deliveryWindowLabel: string | null;
  packageInfo: {
    items: ProductListItem[];
    itemCount: number;
    packageCount: number;
    weightLabel: string | null;
    dimensionsLabel: string | null;
    properties: PackageProperty[];
  };
  deliveryRequirements: DeliveryRequirement[];
  earnings: DeliveryEarnings;
  distanceLabel: string | null;
  availableActions: OrderActionDescriptor[];
}

/** Minimal order shape accepted by view-model builders (mobile Order-compatible). */
export interface OrderLike {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_method?: string | null;
  fulfillment_timing?: 'asap' | 'scheduled' | null;
  promised_ready_at?: string | null;
  promised_fulfill_by?: string | null;
  payment_timing?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  assigned_agent_id?: string | null;
  reconciliation_status?: string | null;
  acceptance_deadline_at?: string | null;
  pickup_due_at?: string | null;
  pickup_by?: string | null;
  pickup_state?: string | null;
  pickup_extension_minutes?: number | null;
  estimated_delivery_time?: string | null;
  preferred_delivery_time?: string | null;
  special_instructions?: string | null;
  subtotal?: number | null;
  base_delivery_fee?: number | null;
  per_km_delivery_fee?: number | null;
  tax_amount?: number | null;
  total_amount?: number | null;
  currency?: string | null;
  delivery_commission?: number | null;
  tip_amount?: number | null;
  bonus_amount?: number | null;
  requires_fast_delivery?: boolean;
  business?: {
    name?: string | null;
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      phone_number?: string | null;
      email?: string | null;
    } | null;
  } | null;
  business_location?: {
    name?: string | null;
    address?: AddressFields | null;
  } | null;
  client?: {
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      phone_number?: string | null;
      email?: string | null;
    } | null;
  } | null;
  assigned_agent?: {
    user?: {
      first_name?: string | null;
      last_name?: string | null;
      phone_number?: string | null;
      email?: string | null;
    } | null;
  } | null;
  delivery_contact?: {
    name: string;
    phone: string | null;
    is_recipient: boolean;
  } | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  is_third_party_recipient?: boolean | null;
  delivery_address?: AddressFields | null;
  order_items?: Array<{
    id: string;
    item_name?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total_price?: number | null;
    special_instructions?: string | null;
    item?: {
      name?: string | null;
      weight?: number | null;
      weight_unit?: string | null;
      dimensions?: string | null;
      item_images?: Array<{
        image_url?: string | null;
        display_url?: string | null;
      }> | null;
    } | null;
  }> | null;
  order_status_history?: Array<{
    id: string;
    status: string;
    notes?: string | null;
    created_at: string;
    changed_by_type?: string | null;
  }> | null;
  delivery_time_window_id?: string | null;
  delivery_time_windows?: Array<{
    id?: string | null;
    window_date?: string | null;
    preferred_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    time_slot_start?: string | null;
    time_slot_end?: string | null;
    is_selected?: boolean | null;
    is_confirmed?: boolean | null;
  }> | null;
  distance_km?: number | null;
  pickup_distance_km?: number | null;
}
