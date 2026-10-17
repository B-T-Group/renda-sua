import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MtnMomoDatabaseService } from '../mtn-momo/mtn-momo-database.service';
import { CollectionRequest, MtnMomoService } from '../mtn-momo/mtn-momo.service';
import { OrangeMomoDatabaseService } from '../orange-momo/orange-momo-database.service';
import type { OrangeCollectionRequest } from '../orange-momo/orange-momo.types';
import { OrangeMomoService } from '../orange-momo/orange-momo.service';
import { isoCountryCode } from '../orders/delivery-pricing.util';
import { mapCountryToMobileMoneyProvider } from './item-country.util';
import {
  detectCameroonPhone,
  isCameroonCountryCode,
  removeCountryCode,
  resolveWalletPhoneRegion,
  validatePhoneNumber,
} from './phone-validation.util';
import { sanitizeProviderError, maskPhoneNumber } from './sanitize-provider-error.util';
import {
  FreemopayPaymentRequest,
  FreemopayPaymentResponse,
  FreemopayService,
  FreemopayWithdrawalRequest,
} from './providers/freemopay.service';
import {
  FedaPayPaymentRequest,
  FedaPayPaymentResponse,
  FedaPayService,
  FedaPayWithdrawalRequest,
} from './providers/fedapay.service';
import {
  buildShortReferenceForMyPVit,
  MyPVitPaymentRequest,
  MyPVitService,
} from './providers/mypvit.service';

export { detectCameroonPhone };

function pickPrimaryOrOnlyAddressCountry(
  rows: Array<{ address?: { country?: string | null; is_primary?: boolean | null } | null }>
): string | null {
  const addresses = rows
    .map((row) => row.address)
    .filter(
      (address): address is { country?: string | null; is_primary?: boolean | null } =>
        !!address?.country?.trim()
    );
  if (!addresses.length) return null;
  const primary = addresses.find((address) => address.is_primary);
  const chosen = primary ?? addresses[0];
  return chosen.country?.trim().toUpperCase() || null;
}

export interface MobilePaymentRequest {
  amount: number;
  currency: string;
  description: string;
  customerPhone?: string;
  /** Catalog item location country (ISO alpha-2). Wins over phone digits for provider + parse region. */
  itemCountry?: string;
  customerEmail?: string;
  ownerCharge?: 'MERCHANT' | 'CUSTOMER';
  callbackUrl?: string;
  returnUrl?: string;
  provider?: 'mypvit' | 'airtel' | 'moov' | 'mtn' | 'orange' | 'freemopay' | 'fedapay';
  paymentMethod?: 'mobile_money' | 'card' | 'bank_transfer';
  accountId?: string; // Account ID for top-up operations
  transactionType?: 'PAYMENT' | 'GIVE_CHANGE'; // Transaction type for mobile payments
}

export interface MobilePaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  message?: string;
  errorCode?: string;
  provider?: string;
  /** Returned when success:true but outcome is ambiguous (e.g., FedaPay send failure after create) */
  status?: 'pending';
  /** Reason for ambiguous/pending status */
  reason?: 'provider_ambiguous';
}

export interface MobileTransactionStatus {
  transactionId: string;
  /** Normalized provider status; `ambiguous` maps MyPVit AMBIGUOUS (uncertain, recheck later). */
  status: 'pending' | 'success' | 'failed' | 'cancelled' | 'ambiguous';
  amount: number;
  currency: string;
  reference: string;
  message?: string;
  provider?: string;
}

export interface PaymentProvider {
  name: string;
  supportedMethods: string[];
  supportedCurrencies: string[];
  isAvailable: boolean;
}

/** Integration used for persistence and API responses. */
export type MobilePaymentIntegrationProvider =
  | 'freemopay'
  | 'mypvit'
  | 'mtn'
  | 'orange'
  | 'fedapay';

@Injectable()
export class MobilePaymentsService {
  private readonly logger = new Logger(MobilePaymentsService.name);
  private readonly providers: Map<string, unknown> = new Map();

  constructor(
    private readonly myPVitService: MyPVitService,
    private readonly mtnMomoService: MtnMomoService,
    private readonly mtnMomoDatabaseService: MtnMomoDatabaseService,
    private readonly orangeMomoService: OrangeMomoService,
    private readonly orangeMomoDatabaseService: OrangeMomoDatabaseService,
    private readonly freemopayService: FreemopayService,
    private readonly fedapayService: FedaPayService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {
    // Register payment providers
    this.providers.set('mypvit', myPVitService);
    this.providers.set('freemopay', freemopayService);
    this.providers.set('fedapay', fedapayService);
  }

  getProvider(phoneNumber: string): MobilePaymentIntegrationProvider {
    if (isCameroonCountryCode(phoneNumber) || detectCameroonPhone(phoneNumber)) {
      return 'freemopay';
    }
    // Note: +228 routing to fedapay is handled in providerFromHintOrPhone (B7)
    // to allow async flag check
    return 'mypvit';
  }

  /** Catalog MoMo integration from the item/listing country, not the payer phone. */
  async getProviderForCountry(country?: string | null): Promise<MobilePaymentIntegrationProvider> {
    const provider = mapCountryToMobileMoneyProvider(country);
    
    // Check if provider is active in supported_payment_systems
    if (provider === 'fedapay') {
      // Use normalized ISO code (B7)
      const iso = isoCountryCode(country);
      if (iso === 'TG') {
        const isActive = await this.isFedaPayActiveForTogo();
        if (!isActive) {
          this.logger.log('FedaPay for TG is not active, falling back to MyPVit');
          return 'mypvit';
        }
      }
    }
    
    return provider;
  }

  private async isFedaPayActiveForTogo(): Promise<boolean> {
    try {
      const query = `
        query CheckFedaPayActive {
          supported_payment_systems(
            where: { name: { _eq: "fedapay" }, country: { _eq: "TG" } }
          ) {
            active
          }
        }
      `;
      
      const result = await this.hasuraSystemService.executeQuery<{
        supported_payment_systems: Array<{ active: boolean }>;
      }>(query, {});
      
      return result.supported_payment_systems[0]?.active ?? false;
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to check FedaPay active status: ${sanitized.message}`);
      return false;
    }
  }

  /** National MSISDN digits for synthetic MyPVit callbacks (admin replay). */
  nationalCustomerIdForMypvit(customerPhone?: string | null): string {
    if (!customerPhone?.trim()) {
      return '';
    }
    return removeCountryCode(customerPhone);
  }

  async resolveAdminIntegrationProvider(
    customerPhone: string | undefined | null,
    storedProvider: string
  ): Promise<MobilePaymentIntegrationProvider> {
    // For stored transactions, honor fedapay unconditionally (B4)
    const known = this.knownProvider(storedProvider);
    if (known === 'fedapay') {
      return 'fedapay';
    }
    return await this.resolveProviderFromRequest({
      customerPhone: customerPhone ?? undefined,
      provider: known,
    });
  }

  private knownProvider(
    storedProvider: string
  ): MobilePaymentRequest['provider'] | undefined {
    const p = storedProvider?.toLowerCase();
    if (
      p === 'mypvit' ||
      p === 'airtel' ||
      p === 'moov' ||
      p === 'mtn' ||
      p === 'orange' ||
      p === 'freemopay' ||
      p === 'fedapay'
    ) {
      return p;
    }
    return undefined;
  }

  /**
   * Public callbacks are unauthenticated; confirm the provider's live status
   * matches the claimed terminal outcome before applying side effects.
   */
  async assertProviderConfirmsCallback(
    tx: {
      id: string;
      transaction_id?: string | null;
      customer_phone?: string | null;
      provider: string;
      amount?: number;
      currency?: string | null;
      reference?: string | null;
      transaction_type?: string | null;
    },
    claimed: 'SUCCESS' | 'FAILED'
  ): Promise<void> {
    const providerTxId = tx.transaction_id?.trim();
    if (!providerTxId) {
      throw new Error(
        `Cannot verify callback for ${tx.id}: missing provider transaction_id`
      );
    }
    // For status checks, honor the stored provider unconditionally (B4)
    // Don't gate fedapay on the active flag for existing transactions
    const storedProvider = tx.provider?.toLowerCase();
    let provider: MobilePaymentIntegrationProvider;
    if (storedProvider === 'fedapay') {
      provider = 'fedapay';
    } else {
      provider = await this.resolveAdminIntegrationProvider(
        tx.customer_phone,
        tx.provider
      );
    }
    const isGiveChange = tx.transaction_type === 'GIVE_CHANGE';
    const live = await this.checkTransactionStatus(
      providerTxId,
      provider,
      tx.customer_phone ?? undefined,
      isGiveChange
    );
    this.assertLiveMatchesClaim(tx, claimed, live);
  }

  private assertLiveMatchesClaim(
    tx: {
      id: string;
      provider: string;
      amount?: number;
      currency?: string | null;
      reference?: string | null;
    },
    claimed: 'SUCCESS' | 'FAILED',
    live: MobileTransactionStatus
  ): void {
    if (claimed === 'SUCCESS') {
      // (b) Transient/pending status stays 5xx so FedaPay retries
      if (live.status === 'pending' || live.status === 'ambiguous') {
        throw new Error(
          `Rejecting SUCCESS callback for ${tx.id}: provider status is ${live.status} (transient, will retry)`
        );
      }
      // (b) Definite mismatch (failed/cancelled when SUCCESS claimed)
      // FedaPay gets 409 (which it understands); other providers get 5xx to trigger retry
      if (live.status !== 'success') {
        if (tx.provider === 'fedapay') {
          throw new HttpException(
            `Rejecting SUCCESS callback for ${tx.id}: provider status is ${live.status}`,
            HttpStatus.CONFLICT
          );
        } else {
          throw new Error(
            `Rejecting SUCCESS callback for ${tx.id}: provider status is ${live.status} (non-FedaPay, will retry)`
          );
        }
      }
      if (tx.provider === 'fedapay') {
        // Check stored tx currency is XOF
        if (tx.currency && tx.currency !== 'XOF') {
          throw new Error(
            `Rejecting FedaPay callback for ${tx.id}: stored currency ${tx.currency} is not XOF`
          );
        }
        // Check live currency is XOF (fail closed if missing)
        if (!live.currency) {
          throw new Error(
            `Rejecting FedaPay callback for ${tx.id}: missing live currency (fail closed)`
          );
        }
        // (b) Definite currency mismatch returns 422 Unprocessable Entity
        if (live.currency !== 'XOF') {
          throw new HttpException(
            `Rejecting FedaPay callback for ${tx.id}: live currency ${live.currency} is not XOF`,
            HttpStatus.UNPROCESSABLE_ENTITY
          );
        }
        // (b) Definite amount mismatch returns 409 Conflict
        if (tx.amount !== undefined && live.amount !== undefined && live.amount !== tx.amount) {
          throw new HttpException(
            `Rejecting FedaPay callback for ${tx.id}: amount mismatch (expected ${tx.amount}, got ${live.amount})`,
            HttpStatus.CONFLICT
          );
        }
        // Check reference matches stored reference exactly (B4)
        // live.reference contains merchantRef || fedapay_id (from mapping at :719)
        // N6: Fail closed if stored reference is empty/null (422 for consistency with FAILED case)
        if (!tx.reference?.trim()) {
          throw new HttpException(
            `Rejecting FedaPay callback for ${tx.id}: missing stored reference (fail closed)`,
            HttpStatus.UNPROCESSABLE_ENTITY
          );
        }
        if (!live.reference) {
          throw new HttpException(
            `Rejecting FedaPay callback for ${tx.id}: missing live reference (fail closed)`,
            HttpStatus.UNPROCESSABLE_ENTITY
          );
        }
        // (b) Definite reference mismatch returns 409 Conflict
        if (live.reference !== tx.reference) {
          throw new HttpException(
            `Rejecting FedaPay callback for ${tx.id}: reference mismatch (expected ${tx.reference}, got ${live.reference})`,
            HttpStatus.CONFLICT
          );
        }
      }
      return;
    }
    // (b) Definite mismatch (success when FAILED claimed)
    // FedaPay gets 409 (which it understands); other providers get 5xx to trigger retry
    if (live.status === 'success') {
      if (tx.provider === 'fedapay') {
        throw new HttpException(
          `Rejecting FAILED callback for ${tx.id}: provider reports success`,
          HttpStatus.CONFLICT
        );
      } else {
        throw new Error(
          `Rejecting FAILED callback for ${tx.id}: provider reports success (non-FedaPay, will retry)`
        );
      }
    }
    // (b) Transient/pending status stays 5xx so FedaPay retries
    if (live.status === 'pending' || live.status === 'ambiguous') {
      throw new Error(
        `Rejecting FAILED callback for ${tx.id}: provider still ${live.status} (transient, will retry)`
      );
    }
    // N6: For FedaPay, also verify reference on DECLINED/failed outcomes
    // (with N2 substitution, a declined result could otherwise be confirmed on status alone)
    // Fail closed if stored reference is empty/null
    if (tx.provider === 'fedapay') {
      if (!tx.reference?.trim()) {
        throw new HttpException(
          `Rejecting FedaPay FAILED callback for ${tx.id}: missing stored reference (fail closed)`,
          HttpStatus.UNPROCESSABLE_ENTITY
        );
      }
      if (live.reference !== tx.reference) {
        throw new HttpException(
          `Rejecting FedaPay FAILED callback for ${tx.id}: reference mismatch (expected ${tx.reference}, got ${live.reference || '<missing>'})`,
          HttpStatus.UNPROCESSABLE_ENTITY
        );
      }
    }
  }

  /** Account withdrawals (GIVE_CHANGE): valid CM, GA, or TG MSISDN. */
  async isWithdrawalDestinationCmOrGa(customerPhone?: string): Promise<boolean> {
    if (!customerPhone?.trim()) {
      return false;
    }
    const v = validatePhoneNumber(customerPhone);
    if (!v.isValid) {
      return false;
    }
    if (v.regionCode === 'CM' || v.regionCode === 'GA') {
      return true;
    }
    if (v.regionCode === 'TG') {
      return await this.isFedaPayActiveForTogo();
    }
    return false;
  }

  /**
   * Get available payment providers
   */
  async getAvailableProviders(): Promise<PaymentProvider[]> {
    const providers: PaymentProvider[] = [];

    // MyPVit provider (Gabon)
    const mypvitAvailable = await this.myPVitService.testConnection();
    providers.push({
      name: 'MyPVit',
      supportedMethods: ['mobile_money', 'card'],
      supportedCurrencies: ['XAF', 'USD', 'EUR'],
      isAvailable: mypvitAvailable,
    });

    // Freemopay provider (Cameroon)
    const freemopayAvailable = await this.freemopayService.testConnection();
    providers.push({
      name: 'Freemopay',
      supportedMethods: ['mobile_money'],
      supportedCurrencies: ['XAF'],
      isAvailable: freemopayAvailable,
    });

    // FedaPay provider (Togo)
    const fedapayAvailable = await this.fedapayService.testConnection();
    providers.push({
      name: 'FedaPay',
      supportedMethods: ['mobile_money'],
      supportedCurrencies: ['XOF'],
      isAvailable: fedapayAvailable,
    });

    return providers;
  }

  /**
   * Get available payment providers for a specific country
   * Filters providers based on supported_payment_systems table
   */
  async getProvidersForCountry(countryCode: string): Promise<PaymentProvider[]> {
    const upperCountry = countryCode.toUpperCase();
    const allProviders = await this.getAvailableProviders();
    
    // Query supported_payment_systems for active providers in this country
    const query = `
      query GetSupportedPaymentSystems($country: bpchar!) {
        supported_payment_systems(where: {country: {_eq: $country}, active: {_eq: true}}) {
          name
          country
          active
        }
      }
    `;
    
    try {
      const result = await this.hasuraSystemService.executeQuery<{
        supported_payment_systems: Array<{
          name: string;
          country: string;
          active: boolean;
        }>;
      }>(query, { country: upperCountry });
      
      this.logger.log(
        `Found ${result.supported_payment_systems.length} active providers for ${upperCountry}: ${JSON.stringify(result.supported_payment_systems)}`
      );
      
      const activeProviderNames = new Set(
        result.supported_payment_systems.map((p) => p.name.toLowerCase())
      );
      
      // Filter providers to only those active for this country
      return allProviders.filter((p: PaymentProvider) => {
        const dbName = this.mapProviderName(p.name);
        return activeProviderNames.has(dbName);
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to get active providers for ${upperCountry}: ${error.message}`,
        error.stack
      );
      // Return empty array on error to be safe
      return [];
    }
  }

  /**
   * Map provider display name to database provider value
   * F-M5: Map GA's airtel/moov rows to MyPVit
   */
  private mapProviderName(displayName: string): string {
    const mapping: Record<string, string> = {
      'MyPVit': 'mypvit',
      'Freemopay': 'freemopay',
      'FedaPay': 'fedapay',
      // GA uses airtel/moov in DB but should map to MyPVit provider
      'airtel': 'mypvit',
      'moov': 'mypvit',
    };
    return mapping[displayName] || displayName.toLowerCase();
  }

  /**
   * Get supported payment methods for a provider
   */
  async getSupportedPaymentMethods(provider: string): Promise<string[]> {
    switch (provider.toLowerCase()) {
      case 'mypvit':
        return await this.myPVitService.getSupportedPaymentMethods();
      case 'freemopay':
        return await this.freemopayService.getSupportedPaymentMethods();
      case 'fedapay':
        return await this.fedapayService.getSupportedPaymentMethods();
      default:
        return [];
    }
  }

  /**
   * Initiate a mobile payment
   */
  /**
   * F-M6: Validate payment request before creating ANY database row.
   * Returns null if valid, or an error response if invalid.
   */
  async validatePaymentRequest(
    paymentRequest: { 
      customerPhone?: string; 
      itemCountry?: string; 
      provider?: string;
      currency?: string;
      amount?: number;
    },
    userId?: string
  ): Promise<{ success: false; message: string; errorCode: string } | null> {
    const phoneRegion = await this.resolvePhoneDefaultRegion(
      userId,
      paymentRequest.customerPhone,
      paymentRequest.itemCountry
    );

    // Validate phone number if provided
    if (paymentRequest.customerPhone) {
      // F-M3: Enforce that payer phone country matches the market/item country FIRST
      const phoneValidation = validatePhoneNumber(
        paymentRequest.customerPhone,
        phoneRegion
      );
      
      if (paymentRequest.itemCountry) {
        const normalizedItemCountry = isoCountryCode(paymentRequest.itemCountry);
        if (normalizedItemCountry && phoneValidation.regionCode !== normalizedItemCountry) {
          return {
            success: false,
            message: `Payment phone number must match the item's country (${normalizedItemCountry})`,
            errorCode: 'PHONE_COUNTRY_MISMATCH',
          };
        }
      }

      // Provider-specific validation
      if (paymentRequest.provider === 'fedapay') {
        // FedaPay custom validation: region, length, prefix checks BEFORE isValid
        if (phoneValidation.regionCode !== 'TG') {
          return {
            success: false,
            message: 'FedaPay requires a Togo (+228) phone number',
            errorCode: 'INVALID_PHONE_NUMBER',
          };
        }
        
        const cleaned = paymentRequest.customerPhone.replace(/\D/g, '');
        const hasTogoPrefix = cleaned.startsWith('228');
        const national = hasTogoPrefix ? cleaned.slice(3) : cleaned;
        
        if (national.length !== 8) {
          return {
            success: false,
            message: 'Invalid Togo phone number. Must be 8 digits after +228.',
            errorCode: 'INVALID_PHONE_NUMBER',
          };
        }
        
        const prefix = national.slice(0, 2);
        const validPrefixes = ['70', '71', '72', '73', '78', '79', '90', '91', '92', '93', '96', '97', '98', '99'];
        if (!validPrefixes.includes(prefix)) {
          return {
            success: false,
            message: 'Invalid Togo phone number. Must use valid Moov or Mixx prefix.',
            errorCode: 'INVALID_PHONE_NUMBER',
          };
        }
        
        // FedaPay: custom validation sufficient, skip isValid check
      } else {
        if (!phoneValidation.isValid) {
          return {
            success: false,
            message: 'Invalid phone number format',
            errorCode: 'INVALID_PHONE_NUMBER',
          };
        }
      }
    }

    // FedaPay currency validation
    if (paymentRequest.provider === 'fedapay') {
      if (paymentRequest.currency && paymentRequest.currency !== 'XOF') {
        return {
          success: false,
          message: 'FedaPay (Togo) only supports XOF currency',
          errorCode: 'UNSUPPORTED_CURRENCY',
        };
      }
      if (paymentRequest.amount && !Number.isInteger(paymentRequest.amount)) {
        return {
          success: false,
          message: 'FedaPay amounts must be integers (XOF has no decimals)',
          errorCode: 'INVALID_AMOUNT',
        };
      }
    }

    return null;
  }

  async initiatePayment(
    paymentRequest: MobilePaymentRequest,
    reference?: string,
    userId?: string
  ): Promise<MobilePaymentResponse> {
    try {
      // F-M6: Validate before any processing
      const validationError = await this.validatePaymentRequest(paymentRequest, userId);
      if (validationError) {
        return validationError;
      }

      const phoneRegion = await this.resolvePhoneDefaultRegion(
        userId,
        paymentRequest.customerPhone,
        paymentRequest.itemCountry
      );

      // Phone logging (validation already done by validatePaymentRequest)
      if (paymentRequest.customerPhone) {
        const phoneValidation = validatePhoneNumber(paymentRequest.customerPhone, phoneRegion);
        this.logger.log(
          `Phone number validated: ${maskPhoneNumber(paymentRequest.customerPhone)} -> Country: ${phoneValidation.regionCode}, National: ${maskPhoneNumber(phoneValidation.nationalNumber)}, callback URL: ${paymentRequest.callbackUrl || 'none'}`
        );
      }

      this.logger.log(
        `Initiating mobile payment for account: ${
          paymentRequest.customerPhone
            ? maskPhoneNumber(paymentRequest.customerPhone)
            : paymentRequest.accountId || 'unknown'
        }`
      );

      // Determine the best provider based on request
      const provider = await this.selectProvider(paymentRequest);
      
      // B5: Validate against the RESOLVED provider (critical for requests without explicit provider)
      if (provider === 'fedapay') {
        const phoneValidation = validatePhoneNumber(paymentRequest.customerPhone || '', phoneRegion);
        
        // Restore isValid check for FedaPay
        if (paymentRequest.customerPhone && !phoneValidation.isValid) {
          return {
            success: false,
            message: 'Invalid phone number format',
            errorCode: 'INVALID_PHONE_NUMBER',
          };
        }
        
        // Currency validation
        if (paymentRequest.currency && paymentRequest.currency !== 'XOF') {
          return {
            success: false,
            message: 'FedaPay (Togo) only supports XOF currency',
            errorCode: 'UNSUPPORTED_CURRENCY',
          };
        }
        
        // Integer amount validation
        if (paymentRequest.amount && !Number.isInteger(paymentRequest.amount)) {
          return {
            success: false,
            message: 'FedaPay amounts must be integers (XOF has no decimals)',
            errorCode: 'INVALID_AMOUNT',
          };
        }
      }

      // Convert to provider-specific request
      const providerRequest = this.convertToProviderRequest(
        paymentRequest as MobilePaymentRequest & CollectionRequest,
        provider,
        reference,
        phoneRegion
      );

      let response: MobilePaymentResponse;

      switch (provider) {
        case 'mypvit':
        case 'airtel':
        case 'moov': {
          const phoneNumber = removeCountryCode(
            paymentRequest.customerPhone || '',
            phoneRegion
          );
          // Generate short reference for MyPVIT (max 15 chars)
          const shortReference = reference 
            ? buildShortReferenceForMyPVit(reference)
            : undefined;
          
          const mypvitResponse = await this.myPVitService.initiatePayment(
            providerRequest as MyPVitPaymentRequest,
            shortReference,
            phoneNumber
          );

          response = {
            success: mypvitResponse.success,
            transactionId: mypvitResponse.transactionId,
            paymentUrl: mypvitResponse.paymentUrl,
            message: mypvitResponse.message,
            errorCode: mypvitResponse.errorCode,
            provider: 'mypvit',
          };
          break;
        }
        case 'freemopay': {
          const isGiveChange = paymentRequest.transactionType === 'GIVE_CHANGE';
          const freemopayResponse = isGiveChange
            ? await this.freemopayService.withdraw(
                providerRequest as FreemopayWithdrawalRequest,
                reference
              )
            : await this.freemopayService.initiatePayment(
                providerRequest as FreemopayPaymentRequest,
                reference
              );
          response = {
            success: freemopayResponse.success,
            transactionId: freemopayResponse.transactionId,
            paymentUrl: (freemopayResponse as FreemopayPaymentResponse)
              .paymentUrl,
            message: freemopayResponse.message,
            errorCode: freemopayResponse.errorCode,
            provider: 'freemopay',
          };
          break;
        }
        case 'fedapay': {
          const isGiveChange = paymentRequest.transactionType === 'GIVE_CHANGE';
          const fedapayResponse = isGiveChange
            ? await this.fedapayService.withdraw(
                providerRequest as FedaPayWithdrawalRequest,
                reference
              )
            : await this.fedapayService.initiatePayment(
                providerRequest as FedaPayPaymentRequest,
                reference
              );
          
          // N5: Surface ambiguous payout/push outcome
          if (fedapayResponse.ambiguous && fedapayResponse.transactionId) {
            this.logger.warn(
              `FedaPay ambiguous outcome: tx_id=${fedapayResponse.transactionId} status=${fedapayResponse.status || 'pending'}`
            );
          }
          
          response = {
            success: fedapayResponse.success,
            transactionId: fedapayResponse.transactionId,
            paymentUrl: (fedapayResponse as FedaPayPaymentResponse)
              .paymentUrl,
            message: fedapayResponse.message,
            errorCode: fedapayResponse.errorCode,
            provider: 'fedapay',
            ...(fedapayResponse.ambiguous ? { 
              status: 'pending',
              reason: 'provider_ambiguous' 
            } : {}),
          };
          break;
        }
        case 'mtn': {
          const mtnResponse = await this.mtnMomoService.requestToPay(
            providerRequest as CollectionRequest,
            userId || ''
          );
          response = {
            success: mtnResponse.status,
            transactionId: mtnResponse.financialTransactionId,
            paymentUrl: '',
            message: mtnResponse.error,
            errorCode: mtnResponse.error,
            provider: 'mtn',
          };
          break;
        }
        case 'orange': {
          const orangeResponse = await this.orangeMomoService.requestToPay(
            providerRequest as OrangeCollectionRequest,
            userId || ''
          );
          response = {
            success: orangeResponse.status,
            transactionId: orangeResponse.financialTransactionId,
            paymentUrl: '',
            message: orangeResponse.error,
            errorCode: orangeResponse.error,
            provider: 'orange',
          };
          break;
        }
        default:
          return {
            success: false,
            message: `Unsupported payment provider: ${provider}`,
            errorCode: 'UNSUPPORTED_PROVIDER',
          };
      }

      // Log the payment initiation
      await this.logPaymentInitiation(paymentRequest, response);

      return response;
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to initiate mobile payment: ${sanitized.message}`);
      return {
        success: false,
        message: 'Failed to initiate payment',
        errorCode: 'INITIATION_FAILED',
      };
    }
  }

  /**
   * Check transaction status.
   * Optional phoneNumber selects the MyPVit operator secret (Airtel vs MOOV).
   * Optional isGiveChange indicates if this is a payout (for FedaPay Payout API).
   */
  async checkTransactionStatus(
    transactionId: string,
    provider?: string,
    phoneNumber?: string,
    isGiveChange?: boolean
  ): Promise<MobileTransactionStatus> {
    try {
      this.logger.log(`Checking transaction status for: ${transactionId}`);

      // Determine provider if not specified
      const paymentProvider =
        provider || (await this.detectProvider(transactionId));

      if (!paymentProvider) {
        throw new Error('Unable to determine payment provider');
      }

      let status: MobileTransactionStatus;

      switch (paymentProvider) {
        case 'mypvit': {
          const mypvitStatus = await this.myPVitService.checkTransactionStatus(
            transactionId,
            phoneNumber
          );
          status = {
            transactionId: mypvitStatus.transactionId,
            status: this.mapMypvitStatusToMobile(mypvitStatus.status),
            amount: mypvitStatus.amount || 0,
            currency: mypvitStatus.currency || 'XAF',
            reference: mypvitStatus.reference || '',
            message: mypvitStatus.message,
            provider: 'mypvit',
          };
          break;
        }
        case 'freemopay': {
          const freemopayStatus =
            await this.freemopayService.checkTransactionStatus(transactionId);
          status = {
            transactionId: freemopayStatus.transactionId,
            status: (freemopayStatus.status?.toLowerCase() ||
              'pending') as 'pending' | 'success' | 'failed' | 'cancelled',
            amount: freemopayStatus.amount || 0,
            currency: 'XAF',
            reference: freemopayStatus.reference || freemopayStatus.merchantRef || '',
            message: freemopayStatus.reason || freemopayStatus.message,
            provider: 'freemopay',
          };
          break;
        }
        case 'fedapay': {
          const fedapayStatus = isGiveChange
            ? await this.fedapayService.checkPayoutStatus(transactionId)
            : await this.fedapayService.checkTransactionStatus(transactionId);
          const statusMap: Record<string, MobileTransactionStatus['status']> = {
            approved: 'success',
            declined: 'failed',
            canceled: 'cancelled',
            pending: 'pending',
            transferred: 'success',
            expired: 'failed', // FedaPay docs: unpaid collections expire after 24h
          };
          status = {
            transactionId: fedapayStatus.transactionId,
            status: statusMap[fedapayStatus.status] || 'pending',
            amount: fedapayStatus.amount || 0,
            currency: fedapayStatus.currency || '', // Pass through real currency, fail closed on missing
            reference: fedapayStatus.merchantRef || fedapayStatus.reference || '',
            message: fedapayStatus.reason || fedapayStatus.message,
            provider: 'fedapay',
          };
          break;
        }
        case 'mtn': {
          const mtnStatus =
            await this.mtnMomoService.requestToPayDeliveryNotification(
              transactionId
            );
          const raw = mtnStatus.statusCode?.toUpperCase() || '';
          status = {
            transactionId,
            status: this.mapMtnCollectionStatusToMobile(raw),
            amount: parseFloat(mtnStatus.amount || '0'),
            currency: mtnStatus.currency || 'XAF',
            reference: mtnStatus.externalId || '',
            message: mtnStatus.statusMessage || mtnStatus.error,
            provider: 'mtn',
          };
          break;
        }
        case 'orange': {
          const orangeRes =
            await this.orangeMomoService.getMpPaymentStatus(transactionId);
          if (!orangeRes.success || !orangeRes.data) {
            throw new Error(orangeRes.error || 'Orange status check failed');
          }
          const entity = orangeRes.data.data;
          const raw = `${entity?.status ?? ''} ${entity?.confirmtxnstatus ?? ''}`;
          status = {
            transactionId,
            status: this.mapOrangeMpStatusToMobile(raw),
            amount: entity?.amount ?? 0,
            currency: 'XAF',
            reference: entity?.payToken || transactionId,
            message: entity?.confirmtxnmessage || entity?.inittxnmessage,
            provider: 'orange',
          };
          break;
        }
        default:
          throw new Error(`Unsupported payment provider: ${paymentProvider}`);
      }

      // Log the status check
      await this.logStatusCheck(transactionId, status);

      return status;
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to check transaction status: ${sanitized.message}`);
      throw new Error(sanitized.message);
    }
  }

  private mapMtnCollectionStatusToMobile(
    raw: string
  ): MobileTransactionStatus['status'] {
    switch (raw) {
      case 'SUCCESSFUL':
        return 'success';
      case 'FAILED':
      case 'REJECTED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      case 'PENDING':
      default:
        return 'pending';
    }
  }

  private mapOrangeMpStatusToMobile(raw: string): MobileTransactionStatus['status'] {
    const u = raw.toUpperCase();
    if (u.includes('SUCCESS') || u.includes('COMPLETE')) {
      return 'success';
    }
    if (u.includes('FAIL') || u.includes('REJECT')) {
      return 'failed';
    }
    if (u.includes('CANCEL')) {
      return 'cancelled';
    }
    return 'pending';
  }

  private mapMypvitStatusToMobile(
    raw: string
  ): MobileTransactionStatus['status'] {
    switch (raw?.toUpperCase()) {
      case 'SUCCESS':
        return 'success';
      case 'FAILED':
        return 'failed';
      case 'PENDING':
        return 'pending';
      case 'AMBIGUOUS':
        return 'ambiguous';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  /**
   * Cancel a pending transaction
   */
  async cancelTransaction(
    transactionId: string,
    provider?: string
  ): Promise<boolean> {
    try {
      this.logger.log(`Cancelling transaction: ${transactionId}`);

      const paymentProvider =
        provider || (await this.detectProvider(transactionId));

      if (!paymentProvider) {
        throw new Error('Unable to determine payment provider');
      }

      let success: boolean;

      switch (paymentProvider) {
        case 'mypvit':
          success = await this.myPVitService.cancelTransaction(transactionId);
          break;
        case 'freemopay':
          success = await this.freemopayService.cancelTransaction(transactionId);
          break;
        default:
          throw new Error(`Unsupported payment provider: ${paymentProvider}`);
      }

      // Log the cancellation
      await this.logTransactionCancellation(transactionId, success);

      return success;
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to cancel transaction: ${sanitized.message}`);
      return false;
    }
  }

  /**
   * Verify payment callback
   */
  async verifyCallback(
    payload: unknown,
    signature: string,
    timestamp: string,
    provider: string
  ): Promise<boolean> {
    try {
      switch (provider.toLowerCase()) {
        case 'mypvit':
          return await this.myPVitService.verifyCallback(
            payload,
            signature,
            timestamp
          );
        case 'freemopay':
          return this.freemopayService.verifyCallback(
            payload,
            signature,
            timestamp
          );
        default:
          this.logger.warn(
            `Unsupported provider for callback verification: ${provider}`
          );
          return false;
      }
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to verify callback: ${sanitized.message}`);
      return false;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(filters?: {
    provider?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]> {
    try {
      const provider = filters?.provider || 'mypvit';

      switch (provider.toLowerCase()) {
        case 'mypvit':
          return await this.myPVitService.getTransactionHistory(filters);
        case 'freemopay':
          return [];
        default:
          this.logger.warn(
            `Unsupported provider for transaction history: ${provider}`
          );
          return [];
      }
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to get transaction history: ${sanitized.message}`);
      return [];
    }
  }

  /**
   * Check merchant balance
   */
  async checkBalance(
    provider = 'mypvit'
  ): Promise<{ balance: number; currency: string }> {
    try {
      switch (provider.toLowerCase()) {
        case 'mypvit':
          return await this.myPVitService.checkBalance();
        case 'freemopay':
          throw new Error(
            'Freemopay does not support balance check via API'
          );
        default:
          throw new Error(
            `Unsupported provider for balance check: ${provider}`
          );
      }
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to check balance: ${sanitized.message}`);
      throw new Error(sanitized.message);
    }
  }

  /**
   * Perform KYC verification
   */
  async performKYC(
    kycData: {
      customerPhone: string;
      customerName: string;
      customerId?: string;
      customerEmail?: string;
    },
    provider = 'mypvit'
  ): Promise<{ success: boolean; kycStatus: string; message?: string }> {
    try {
      switch (provider.toLowerCase()) {
        case 'mypvit':
          return await this.myPVitService.performKYC(kycData);
        default:
          throw new Error(`Unsupported provider for KYC: ${provider}`);
      }
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to perform KYC: ${sanitized.message}`);
      throw new Error(sanitized.message);
    }
  }

  /**
   * Update secret in AWS Secrets Manager
   */
  async updateSecretInSecretsManager(
    secretName: string,
    key: string,
    value: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string }> {
    try {
      this.logger.log(`Updating secret ${secretName} with key ${key}`);

      // Get current secret value
      const currentSecret = await this.getSecretValue(secretName);

      // Update the secret with new key-value pair
      const updatedSecret = {
        ...currentSecret,
        [key]: value,
        ...metadata,
      };

      // Update the secret in AWS Secrets Manager
      const { SecretsManagerClient, UpdateSecretCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      );
      const secretsManager = new SecretsManagerClient();

      const command = new UpdateSecretCommand({
        SecretId: secretName,
        SecretString: JSON.stringify(updatedSecret),
      });

      await secretsManager.send(command);

      this.logger.log(`Successfully updated secret ${secretName}`);

      return {
        success: true,
        message: 'Secret updated successfully',
      };
    } catch (error: any) {
      const sanitized = sanitizeProviderError(error);
      this.logger.error(`Failed to update secret ${secretName}: ${sanitized.message}`);
      throw new Error(sanitized.message);
    }
  }

  /**
   * Get secret value from AWS Secrets Manager
   */
  private async getSecretValue(
    secretName: string
  ): Promise<Record<string, unknown>> {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import(
        '@aws-sdk/client-secrets-manager'
      );
      const secretsManager = new SecretsManagerClient();

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await secretsManager.send(command);

      if (!response.SecretString) {
        return {};
      }

      return JSON.parse(response.SecretString);
    } catch (error) {
      // If secret doesn't exist, return empty object
      if (
        error instanceof Error &&
        error.name === 'ResourceNotFoundException'
      ) {
        this.logger.warn(
          `Secret ${secretName} not found, will create new secret`
        );
        return {};
      }
      throw error;
    }
  }

  /**
   * Same choice at charge time and on the callback.
   * Direct MTN/Orange first, then any +237 number on FreemoPay, then item country.
   */
  async resolveProviderFromRequest(
    request: Pick<MobilePaymentRequest, 'customerPhone' | 'provider' | 'itemCountry'>
  ): Promise<MobilePaymentIntegrationProvider> {
    if (request.provider === 'mtn' || request.provider === 'orange') {
      return request.provider;
    }
    if (isCameroonCountryCode(request.customerPhone)) return 'freemopay';
    if (request.itemCountry?.trim()) {
      return await this.getProviderForCountry(request.itemCountry);
    }
    return this.providerFromHintOrPhone(request);
  }

  private async providerFromHintOrPhone(
    request: Pick<MobilePaymentRequest, 'customerPhone' | 'provider'>
  ): Promise<MobilePaymentIntegrationProvider> {
    if (request.provider === 'freemopay') return 'freemopay';
    if (
      request.provider === 'mypvit' ||
      request.provider === 'airtel' ||
      request.provider === 'moov'
    ) {
      return 'mypvit';
    }
    const isTogoPhone =
      !!request.customerPhone?.trim() &&
      validatePhoneNumber(request.customerPhone).regionCode === 'TG';
    // FedaPay only serves Togo (+228) numbers, and only once TG is active.
    if (isTogoPhone && (await this.isFedaPayActiveForTogo())) return 'fedapay';
    if (request.provider === 'fedapay') {
      this.logger.warn(
        'FedaPay hint ignored: payer is not +228 or TG is not active, falling back'
      );
    }
    if (request.customerPhone?.trim()) {
      return this.getProvider(request.customerPhone);
    }
    return 'mypvit';
  }

  private async selectProvider(request: MobilePaymentRequest): Promise<string> {
    return await this.resolveProviderFromRequest(request);
  }

  /**
   * Convert generic request to provider-specific request
   */
  private convertToProviderRequest(
    request: MobilePaymentRequest & CollectionRequest,
    provider: string,
    reference?: string,
    phoneRegion = 'GA'
  ):
    | CollectionRequest
    | OrangeCollectionRequest
    | MyPVitPaymentRequest
    | FreemopayPaymentRequest
    | FreemopayWithdrawalRequest
    | FedaPayPaymentRequest
    | FedaPayWithdrawalRequest {
    const phoneNumber = removeCountryCode(
      request.customerPhone || '',
      phoneRegion
    );
    const amount: number = request.amount;

    switch (provider) {
      case 'mypvit':
      case 'airtel':
      case 'moov': {
        return {
          amount: amount,
          service: 'RESTFUL',
          callback_url_code: this.myPVitService.getCallbackUrlCode(),
          customer_account_number: phoneNumber,
          merchant_operation_account_code:
            this.myPVitService.getMerchantOperationAccountCode(phoneNumber),
          transaction_type: request.transactionType || 'PAYMENT',
          owner_charge: request.ownerCharge || 'CUSTOMER',
          free_info: request.description,
        } as MyPVitPaymentRequest;
      }
      case 'freemopay': {
        const phone = phoneNumber || '';
        const formatted = phone.startsWith('237') ? phone : phone ? `237${phone}` : '';
        const isGiveChange = request.transactionType === 'GIVE_CHANGE';
        return isGiveChange
          ? ({
              payee: formatted,
              amount,
              externalId: reference || '',
              description: request.description || 'Withdrawal',
              callback: this.freemopayService.getCallbackUrl(),
            } as FreemopayWithdrawalRequest)
          : ({
              payer: formatted,
              amount,
              externalId: reference || '',
              description: request.description || 'Payment',
              callback: this.freemopayService.getCallbackUrl(),
            } as FreemopayPaymentRequest);
      }
      case 'fedapay': {
        const phone = phoneNumber || '';
        const formatted = phone.startsWith('228') ? phone : phone ? `228${phone}` : '';
        const isGiveChange = request.transactionType === 'GIVE_CHANGE';
        const channel: 'moov_tg' | 'togocel' = phone.startsWith('78') || phone.startsWith('79') || 
                                                 phone.startsWith('96') || phone.startsWith('97') || 
                                                 phone.startsWith('98') || phone.startsWith('99')
          ? 'moov_tg'
          : 'togocel';
        return isGiveChange
          ? ({
              payee: formatted,
              amount,
              externalId: reference || '',
              description: request.description || 'Payout',
              callback: this.fedapayService.getCallbackUrl(),
              channel,
            } as FedaPayWithdrawalRequest)
          : ({
              payer: formatted,
              amount,
              externalId: reference || '',
              description: request.description || 'Payment',
              callback: this.fedapayService.getCallbackUrl(),
              channel,
            } as FedaPayPaymentRequest);
      }
      case 'mtn': {
        return {
          amount: amount.toString(),
          currency: request.currency.toUpperCase(),
          externalId: reference || '',
          payer: {
            partyIdType: 'MSISDN',
            partyId: phoneNumber,
          },
          payerMessage: request.description,
          payeeNote: request.description,
        } as CollectionRequest;
      }
      case 'orange': {
        return {
          amount: amount.toString(),
          currency: request.currency.toUpperCase(),
          externalId: reference || '',
          payer: {
            partyIdType: 'MSISDN',
            partyId: phoneNumber,
          },
          payerMessage: request.description,
          payeeNote: request.description,
        } as OrangeCollectionRequest;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Detect provider from transaction ID
   */
  private async detectProvider(transactionId: string): Promise<string | null> {
    try {
      const mtnRow =
        await this.mtnMomoDatabaseService.getPaymentRequestByTransactionId(
          transactionId
        );
      if (mtnRow) {
        return 'mtn';
      }
    } catch {
      // ignore lookup errors
    }
    try {
      const orangeRow =
        await this.orangeMomoDatabaseService.getPaymentRequestByTransactionId(
          transactionId
        );
      if (orangeRow) {
        return 'orange';
      }
    } catch {
      // ignore lookup errors
    }
    try {
      await this.freemopayService.checkTransactionStatus(transactionId);
      return 'freemopay';
    } catch {
      // Not a Freemopay reference, try MyPVit
    }
    try {
      await this.myPVitService.checkTransactionStatus(transactionId);
      return 'mypvit';
    } catch {
      return null;
    }
  }

  /**
   * Catalog item country wins. Wallet uses users.country, then address, then CM phone digits.
   */
  private async resolvePhoneDefaultRegion(
    userId?: string,
    phone?: string,
    itemCountry?: string
  ): Promise<string> {
    const fromItem = isoCountryCode(itemCountry);
    if (fromItem) return fromItem;
    const fromUser = userId ? await this.getUserCountryOrAddress(userId) : null;
    const region = resolveWalletPhoneRegion({ phone, userCountry: fromUser });
    return isoCountryCode(region) ?? region;
  }

  private async getUserCountryOrAddress(userId: string): Promise<string | null> {
    try {
      const profileCountry = await this.getUserProfileCountry(userId);
      if (profileCountry) return profileCountry;
      return await this.getUserPrimaryAddressCountry(userId);
    } catch (error: any) {
      this.logger.warn(
        `Could not resolve phone region for user ${userId}: ${error?.message ?? error}`
      );
      return null;
    }
  }

  private async getUserProfileCountry(userId: string): Promise<string | null> {
    const query = `
      query GetUserCountryForPhone($userId: uuid!) {
        users_by_pk(id: $userId) { country }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, { userId });
    return result.users_by_pk?.country?.trim().toUpperCase() || null;
  }

  private async getUserPrimaryAddressCountry(
    userId: string
  ): Promise<string | null> {
    const query = `
      query GetUserAddressCountries($userId: uuid!) {
        business_addresses(
          where: {
            business: { user_id: { _eq: $userId } }
            address: { status: { _eq: active } }
          }
        ) {
          address { country is_primary }
        }
        client_addresses(
          where: {
            client: { user_id: { _eq: $userId } }
            address: { status: { _eq: active } }
          }
        ) {
          address { country is_primary }
        }
        agent_addresses(
          where: {
            agent: { user_id: { _eq: $userId } }
            address: { status: { _eq: active } }
          }
        ) {
          address { country is_primary }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });
    return pickPrimaryOrOnlyAddressCountry([
      ...(result.business_addresses ?? []),
      ...(result.client_addresses ?? []),
      ...(result.agent_addresses ?? []),
    ]);
  }

  /**
   * Log payment initiation
   */
  private async logPaymentInitiation(
    request: MobilePaymentRequest,
    response: MobilePaymentResponse
  ): Promise<void> {
    // TODO: Implement logging to database
    this.logger.log(
      `Payment initiated: ${
        request.customerPhone
          ? removeCountryCode(request.customerPhone)
          : request.accountId || 'unknown'
      } -> ${response.success ? 'SUCCESS' : 'FAILED'}`
    );
  }

  /**
   * Schedule mock callback for FedaPay mock transactions.
   * Must be called AFTER persisting the transaction_id to avoid G2 race.
   */
  async scheduleMockCallback(transactionId: string, reference: string): Promise<void> {
    if (transactionId.startsWith('mock-')) {
      this.fedapayService.scheduleMockCallback(transactionId, reference);
    }
  }

  /**
   * Log status check
   */
  private async logStatusCheck(
    transactionId: string,
    status: MobileTransactionStatus
  ): Promise<void> {
    // TODO: Implement logging to database
    this.logger.log(`Status checked: ${transactionId} -> ${status.status}`);
  }

  /**
   * Log transaction cancellation
   */
  private async logTransactionCancellation(
    transactionId: string,
    success: boolean
  ): Promise<void> {
    // TODO: Implement logging to database
    this.logger.log(
      `Transaction cancelled: ${transactionId} -> ${
        success ? 'SUCCESS' : 'FAILED'
      }`
    );
  }
}
