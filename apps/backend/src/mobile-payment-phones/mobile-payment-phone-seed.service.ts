import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  isSupportedMobileMoneyE164,
  isoFromMobileMoneyCallingCode,
  normalizeToE164,
  parseE164,
  toMobileMoneyCallingCode,
} from './phone-e164.util';
import type { UserMobilePaymentPhoneRow } from './mobile-payment-phones.types';

/**
 * Soft-seed helpers for signup / persona flows.
 * Kept in a thin module so Auth can import without MobilePaymentPhones → Admin cycles.
 */
@Injectable()
export class MobilePaymentPhoneSeedService {
  private readonly logger = new Logger(MobilePaymentPhoneSeedService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly paymentRoutingService: PaymentRoutingService
  ) {}

  async ensureFromContactPhone(
    userId: string,
    countryCode: string | undefined | null,
    phoneRaw: string | undefined | null
  ): Promise<UserMobilePaymentPhoneRow | null> {
    const trimmed = phoneRaw?.trim();
    if (!trimmed) return null;
    try {
      const railCountry = this.resolveIsoForRail(countryCode, trimmed);
      const rail =
        await this.paymentRoutingService.resolveRailForCountry(
          railCountry ?? undefined
        );
      if (rail !== 'mobile_money') return null;
      const phoneE164 = this.resolveContactE164(countryCode, trimmed);
      if (!phoneE164) return null;
      this.assertProviderSupports(phoneE164);
      const existing = await this.findByUserAndE164(userId, phoneE164);
      if (existing) return existing;
      return await this.insertUnverifiedPhone(userId, phoneE164);
    } catch (error: any) {
      this.logger.warn(
        `ensureFromContactPhone skipped for user ${userId}: ${error?.message || error}`
      );
      return null;
    }
  }

  async linkPhoneToLocation(
    locationId: string,
    phone: UserMobilePaymentPhoneRow
  ): Promise<void> {
    await this.hasuraSystemService.executeMutation(
      `mutation LinkLocPhone($id: uuid!, $phone: String!, $phoneId: uuid!) {
        update_business_locations_by_pk(
          pk_columns: { id: $id }
          _set: { phone: $phone, mobile_payment_phone_id: $phoneId }
        ) { id }
      }`,
      {
        id: locationId,
        phone: phone.phone_e164,
        phoneId: phone.id,
      }
    );
  }

  async ensureAndLinkContactPhoneToLocation(
    userId: string,
    locationId: string,
    countryCode: string | undefined | null,
    phoneRaw?: string | null
  ): Promise<void> {
    try {
      let phone = phoneRaw;
      if (phone == null || !String(phone).trim()) {
        const userRes = await this.hasuraSystemService.executeQuery(
          `query UserPhone($id: uuid!) {
            users_by_pk(id: $id) { phone_number }
          }`,
          { id: userId }
        );
        phone = userRes.users_by_pk?.phone_number ?? null;
      }
      const row = await this.ensureFromContactPhone(userId, countryCode, phone);
      if (!row) return;
      await this.linkPhoneToLocation(locationId, row);
    } catch (error: any) {
      this.logger.warn(
        `ensureAndLinkContactPhoneToLocation failed for ${locationId}: ${error?.message || error}`
      );
    }
  }

  private async insertUnverifiedPhone(
    userId: string,
    phoneE164: string
  ): Promise<UserMobilePaymentPhoneRow> {
    const res = await this.hasuraSystemService.executeMutation(
      `mutation InsertPhone($row: user_mobile_payment_phones_insert_input!) {
        insert_user_mobile_payment_phones_one(object: $row) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { row: { user_id: userId, phone_e164: phoneE164, is_verified: false } }
    );
    return res.insert_user_mobile_payment_phones_one;
  }

  private async findByUserAndE164(
    userId: string,
    phoneE164: string
  ): Promise<UserMobilePaymentPhoneRow | null> {
    const res = await this.hasuraSystemService.executeQuery(
      `query FindPhone($userId: uuid!, $phone: String!) {
        user_mobile_payment_phones(
          where: { user_id: { _eq: $userId }, phone_e164: { _eq: $phone } }
          limit: 1
        ) {
          id user_id phone_e164 is_verified verified_at
          last_verification_transaction_id created_at updated_at
        }
      }`,
      { userId, phone: phoneE164 }
    );
    return res.user_mobile_payment_phones?.[0] ?? null;
  }

  private resolveContactE164(
    countryCode: string | undefined | null,
    phoneRaw: string
  ): string | null {
    const trimmed = phoneRaw.trim();
    if (trimmed.startsWith('+')) {
      return isSupportedMobileMoneyE164(trimmed) ? trimmed : null;
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits && isSupportedMobileMoneyE164(`+${digits}`)) {
      return `+${digits}`;
    }
    const calling = toMobileMoneyCallingCode(countryCode);
    if (!calling) return null;
    return normalizeToE164(calling, trimmed);
  }

  private resolveIsoForRail(
    countryCode: string | undefined | null,
    phoneRaw: string
  ): string | null {
    if (countryCode?.trim()) {
      const upper = countryCode.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(upper)) return upper;
      const fromCalling = isoFromMobileMoneyCallingCode(upper);
      if (fromCalling) return fromCalling;
    }
    const e164 = this.resolveContactE164(countryCode, phoneRaw);
    if (!e164) return null;
    const parsed = parseE164(e164);
    return parsed ? isoFromMobileMoneyCallingCode(parsed.countryCode) : null;
  }

  private assertProviderSupports(phoneE164: string): void {
    this.mobilePaymentsService.getProvider(phoneE164);
  }
}
