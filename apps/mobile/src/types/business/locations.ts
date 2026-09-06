import type { MobilePaymentPhoneSummary } from '../mobilePaymentPhone';
import type { OperatingHours } from '../../utils/operatingHours';

export interface BusinessLocationAddress {
  id?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code?: string;
  country: string;
  instructions?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface BusinessLocation {
  id: string;
  name: string;
  phone?: string;
  order_alert_phone?: string | null;
  mobile_payment_phone_id?: string | null;
  mobile_payment_phone?: MobilePaymentPhoneSummary | null;
  email?: string;
  is_active: boolean;
  is_primary: boolean;
  location_type: 'store' | 'warehouse' | 'office' | 'pickup_point';
  address: BusinessLocationAddress;
  /**
   * @deprecated Commission is now derived from Business.accountType.
   * TODO: remove this field after the business_locations.rendasua_item_commission_percentage column is dropped.
   */
  rendasua_item_commission_percentage?: number | null;
  auto_withdraw_commissions?: boolean;
  logo_url?: string | null;
  operating_hours?: OperatingHours | null;
}

export interface BusinessLocationsListData {
  business_locations: BusinessLocation[];
  primary_address_country?: string | null;
}

export interface LocationAccountSummary {
  currency: string;
  available_balance: number;
  total_balance: number;
  withheld_balance?: number;
}

export interface CreateBusinessLocationPayload {
  name: string;
  phone?: string;
  order_alert_phone?: string | null;
  mobile_payment_phone_id?: string | null;
  email?: string;
  location_type?: BusinessLocation['location_type'];
  is_primary?: boolean;
  auto_withdraw_commissions?: boolean;
  logo_url?: string | null;
  address_id?: string;
  address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code?: string;
    instructions?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface UpdateBusinessLocationPayload {
  name?: string;
  phone?: string;
  order_alert_phone?: string | null;
  mobile_payment_phone_id?: string | null;
  email?: string;
  location_type?: BusinessLocation['location_type'];
  is_primary?: boolean;
  is_active?: boolean;
  auto_withdraw_commissions?: boolean;
  logo_url?: string | null;
}

export interface PatchBusinessLocationAddressPayload {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
}
