export interface DeliveryWindow {
  label: string;
  band: string;
  start: string | null;
  end: string | null;
}

export interface DeliveryFee {
  currency: string;
  min: number | null;
  max: number | null;
  exact: number | null;
  confidence: 'exact' | 'range' | 'unknown';
}

export interface DeliveryEstimateResponse {
  areaLabel: string;
  needsFinerArea: boolean;
  window: DeliveryWindow;
  fee: DeliveryFee;
  servingStatus: string | null;
  coverage: 'in' | 'out';
  trustVariant: 'map_and_pin' | 'sms_link' | 'app_and_web';
}
