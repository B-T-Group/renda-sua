import { api } from './apiClient';
import type { DeliveryTimeSlot } from '../types/deliveryWindow';

export async function fetchDeliverySlots(params: {
  countryCode: string;
  stateCode: string;
  date: string;
  isFastDelivery?: boolean;
  businessLocationId?: string;
}): Promise<DeliveryTimeSlot[]> {
  const qs = new URLSearchParams({
    countryCode: params.countryCode.trim(),
    stateCode: params.stateCode.trim(),
    date: params.date,
  });
  if (params.isFastDelivery !== undefined) {
    qs.set('isFastDelivery', String(params.isFastDelivery));
  }
  if (params.businessLocationId) {
    qs.set('businessLocationId', params.businessLocationId);
  }
  const res = await api.get<{
    success: boolean;
    slots?: DeliveryTimeSlot[];
    error?: string;
  }>(`/delivery-windows/slots?${qs.toString()}`);
  if (!res.success || !res.slots) {
    throw new Error(res.error || 'Failed to load delivery slots');
  }
  return res.slots;
}

export async function fetchNextAvailableDay(params: {
  countryCode: string;
  stateCode: string;
  isFastDelivery?: boolean;
  businessLocationId?: string;
}): Promise<{ date: string; slots: DeliveryTimeSlot[] } | null> {
  const qs = new URLSearchParams({
    countryCode: params.countryCode.trim(),
    stateCode: params.stateCode.trim(),
  });
  if (params.isFastDelivery !== undefined) {
    qs.set('isFastDelivery', String(params.isFastDelivery));
  }
  if (params.businessLocationId) {
    qs.set('businessLocationId', params.businessLocationId);
  }
  const res = await api.get<{
    success: boolean;
    date?: string;
    slots?: DeliveryTimeSlot[];
    message?: string;
    error?: string;
  }>(`/delivery-windows/next-available-day?${qs.toString()}`);
  if (!res.success || !res.date || !res.slots?.length) {
    return null;
  }
  return { date: res.date, slots: res.slots };
}
