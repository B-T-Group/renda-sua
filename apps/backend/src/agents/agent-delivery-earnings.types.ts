export type DeliveryEarningsPeriod = 'month' | 'last_month' | 'all';

export interface DeliveryPayRates {
  baseAmount: number;
  fastBaseAmount: number | null;
  perKmAmount: number;
}

export interface DeliveryTrip {
  orderId: string;
  orderNumber: string;
  deliveredAt: string | null;
  amount: number;
}

export interface DeliveryEarnings {
  currency: string;
  period: DeliveryEarningsPeriod;
  pay: DeliveryPayRates;
  earnedAmount: number;
  tripCount: number;
  trips: DeliveryTrip[];
}

export interface DeliveryPayoutRow {
  orderId: string;
  orderNumber: string | null;
  deliveredAt: string | null;
  amount: number;
  commissionType: string;
  createdAt: string;
}
