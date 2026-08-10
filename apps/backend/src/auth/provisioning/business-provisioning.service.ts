import { Injectable, Logger } from '@nestjs/common';
import { AddressesService } from '../../addresses/addresses.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { BusinessContractsService } from '../../business-contracts/business-contracts.service';
import { LaunchPromoService } from '../../launch-promo/launch-promo.service';
import type { LaunchPromoSlot } from '../../launch-promo/launch-promo.types';
import { MobilePaymentPhoneSeedService } from '../../mobile-payment-phones/mobile-payment-phone-seed.service';
import { timezoneFromAddressCountryCode } from '../../users/user-timezone.util';
import type {
  ProvisionedBusinessLocation,
  ProvisionedEntity,
} from './user-provisioning.service';
import type { NormalizedSignupAddress } from './signup-address.normalize';

export interface BusinessPostCommitInput {
  userId: string;
  entities: ProvisionedEntity[];
  businessLocation?: ProvisionedBusinessLocation;
  /** Address used when location was nested (for timezone / personal account). */
  storeAddress?: NormalizedSignupAddress;
  phoneNumber?: string | null;
  businessName?: string;
  countryCode?: string;
}

@Injectable()
export class BusinessProvisioningService {
  private readonly logger = new Logger(BusinessProvisioningService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly addressesService: AddressesService,
    private readonly businessContractsService: BusinessContractsService,
    private readonly mobilePaymentPhoneSeedService: MobilePaymentPhoneSeedService,
    private readonly launchPromoService: LaunchPromoService
  ) {}

  /**
   * Idempotent post-commit side effects after the atomic user+location insert.
   * Failures are logged and do not roll back the user row.
   */
  async runPostCommitEffects(
    input: BusinessPostCommitInput
  ): Promise<{ launchPromo: LaunchPromoSlot | null }> {
    const business = input.entities.find((e) => e.type === 'business');
    if (!business) return { launchPromo: null };

    if (input.businessLocation) {
      await this.safeLinkBusinessAddress(
        business.id,
        input.businessLocation.addressId
      );
      await this.safeEnsureLocationAccount(input.businessLocation.id);
      await this.safeSeedPaymentPhone(
        input.userId,
        input.businessLocation.id,
        input.businessLocation.country || input.storeAddress?.country,
        input.phoneNumber
      );
    } else {
      await this.safeSeedContactPhoneOnly(input.userId, input.phoneNumber);
    }

    if (input.storeAddress) {
      await this.safeSetTimezone(input.userId, input.storeAddress.country);
      await this.safeEnsurePersonalAccount(
        input.userId,
        input.storeAddress.country
      );
    }

    this.scheduleEnsureContract(business.id);

    const country =
      input.countryCode ||
      input.businessLocation?.country ||
      input.storeAddress?.country;
    const launchPromo = await this.safeClaimLaunchPromo(business.id, country);
    return { launchPromo };
  }

  private async safeClaimLaunchPromo(
    businessId: string,
    countryCode?: string | null
  ): Promise<LaunchPromoSlot | null> {
    try {
      return await this.launchPromoService.claimSlotIfAvailable(
        businessId,
        countryCode
      );
    } catch (error: any) {
      this.logger.warn(
        `Launch promo claim failed for ${businessId}: ${error?.message}`
      );
      return null;
    }
  }

  scheduleEnsureContract(businessId: string): void {
    this.businessContractsService
      .ensureContractForBusiness(businessId)
      .catch((error: any) => {
        this.logger.warn(
          `Contract creation after signup failed for ${businessId}: ${error?.message}`
        );
      });
  }

  private async safeLinkBusinessAddress(
    businessId: string,
    addressId: string
  ): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(
        `mutation LinkBusinessAddress($businessId: uuid!, $addressId: uuid!) {
          insert_business_addresses_one(object: {
            business_id: $businessId,
            address_id: $addressId
          }) { id }
        }`,
        { businessId, addressId }
      );
    } catch (error: any) {
      this.logger.warn(
        `business_addresses link failed for ${businessId}: ${error?.message}`
      );
    }
  }

  private async safeEnsureLocationAccount(locationId: string): Promise<void> {
    try {
      await this.hasuraSystemService.ensureAccountForBusinessLocation(
        locationId
      );
    } catch (error: any) {
      this.logger.warn(
        `ensureAccountForBusinessLocation failed for ${locationId}: ${error?.message}`
      );
    }
  }

  private async safeSeedPaymentPhone(
    userId: string,
    locationId: string,
    country: string | undefined,
    phone: string | null | undefined
  ): Promise<void> {
    try {
      await this.mobilePaymentPhoneSeedService.ensureAndLinkContactPhoneToLocation(
        userId,
        locationId,
        country,
        phone
      );
    } catch (error: any) {
      this.logger.warn(
        `Payment phone seed/link failed for ${userId}: ${error?.message}`
      );
    }
  }

  private async safeSeedContactPhoneOnly(
    userId: string,
    phone: string | null | undefined
  ): Promise<void> {
    try {
      await this.mobilePaymentPhoneSeedService.ensureFromContactPhone(
        userId,
        undefined,
        phone
      );
    } catch (error: any) {
      this.logger.warn(
        `Contact phone seed failed for ${userId}: ${error?.message}`
      );
    }
  }

  private async safeSetTimezone(userId: string, country: string): Promise<void> {
    try {
      await this.hasuraSystemService.setUserTimezone(
        userId,
        timezoneFromAddressCountryCode(country)
      );
    } catch (error: any) {
      this.logger.warn(
        `Timezone set failed for ${userId}: ${error?.message}`
      );
    }
  }

  private async safeEnsurePersonalAccount(
    userId: string,
    country: string
  ): Promise<void> {
    try {
      const currency =
        await this.addressesService.resolveCurrencyFromCountry(country);
      await this.addressesService.ensurePersonalAccount(userId, currency);
    } catch (error: any) {
      this.logger.warn(
        `Personal account ensure failed for ${userId}: ${error?.message}`
      );
    }
  }
}
