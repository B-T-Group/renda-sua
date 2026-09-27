import { api } from './apiClient';
import type {
  MobileMoneyVerificationMethod,
  MobilePaymentPhone,
  MobilePaymentPhoneStatus,
} from '../types/mobilePaymentPhone';

export const mobilePaymentPhonesApi = {
  list: () =>
    api.get<{
      success: boolean;
      data: {
        phones: MobilePaymentPhone[];
        verificationMethod?: MobileMoneyVerificationMethod;
      };
    }>('/mobile-payment-phones'),

  create: (
    countryCode: string,
    phoneNumber: string,
    options?: { setAsDefault?: boolean }
  ) =>
    api.post<{ success: boolean; data: { phone: MobilePaymentPhone } }>(
      '/mobile-payment-phones',
      {
        countryCode,
        phoneNumber,
        setAsDefault: options?.setAsDefault === true,
      }
    ),

  update: (id: string, countryCode: string, phoneNumber: string) =>
    api.patch<{ success: boolean; data: { phone: MobilePaymentPhone } }>(
      `/mobile-payment-phones/${id}`,
      { countryCode, phoneNumber }
    ),

  delete: (id: string) => api.delete(`/mobile-payment-phones/${id}`),

  setDefault: (id: string) =>
    api.post<{ success: boolean; data: { phone: MobilePaymentPhone } }>(
      `/mobile-payment-phones/${id}/default`
    ),

  linkProfile: () =>
    api.post<{
      success: boolean;
      data: { phone: MobilePaymentPhone | null; reason: string | null };
    }>('/mobile-payment-phones/link-profile'),

  verify: (id: string) =>
    api.post<{ success: boolean; data: { transactionId: string; message?: string } }>(
      `/mobile-payment-phones/${id}/verify`
    ),

  confirm: (id: string) =>
    api.post<{ success: boolean; data: { phone: MobilePaymentPhone } }>(
      `/mobile-payment-phones/${id}/confirm`
    ),

  getStatus: (id: string) =>
    api.get<{ success: boolean; data: MobilePaymentPhoneStatus }>(
      `/mobile-payment-phones/${id}`
    ),

  attachAgent: (mobilePaymentPhoneId: string) =>
    api.post('/mobile-payment-phones/agent/attach', { mobilePaymentPhoneId }),
};

export function parseE164Parts(phoneE164: string): {
  countryCode: string;
  phoneNumber: string;
} {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.startsWith('237')) {
    return { countryCode: '237', phoneNumber: digits.slice(3) };
  }
  if (digits.startsWith('241')) {
    return { countryCode: '241', phoneNumber: digits.slice(3) };
  }
  return { countryCode: '237', phoneNumber: digits };
}
