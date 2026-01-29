import { Injectable, Logger } from '@nestjs/common';
import * as libphonenumber from 'google-libphonenumber';
import { CollectionRequest, MtnMomoService } from '../mtn-momo/mtn-momo.service';
import {
  MyPVitPaymentRequest,
  MyPVitService,
} from './providers/mypvit.service';

type CameroonCarrier = "mtn" | "orange";

interface CameroonPhoneResult {
  carrier: CameroonCarrier;
  phone: string; // 9 digits, no country code
}

const MTN_PREFIXES = new Set([
  "650","651","652","653","654",
  "670","671","672","673","674",
  "675","676","677","678","679",
  "680","681","682","683","684","685","686","687","688","689"
]);

const ORANGE_PREFIXES = new Set([
  "655","656","657","658","659",
  "690","691","692","693","694","695","696","697","698","699"
]);

function normalizeCameroonPhone(phone: string): string | null {
  // Remove everything except digits
  let digits = phone.replace(/\D/g, "");

  // Remove country code if present
  if (digits.startsWith("237")) {
    digits = digits.slice(3);
  }

  // Cameroon mobile numbers: 9 digits, start with 6
  if (digits.length !== 9 || !digits.startsWith("6")) {
    return null;
  }

  return digits;
}

export function detectCameroonPhone(
  phone: string
): CameroonPhoneResult | null {
  const normalized = normalizeCameroonPhone(phone);

  // Not a Cameroonian mobile number
  if (!normalized) return null;

  const prefix = normalized.slice(0, 3);

  if (MTN_PREFIXES.has(prefix)) {
    return { carrier: "mtn", phone: normalized };
  }

  if (ORANGE_PREFIXES.has(prefix)) {
    return { carrier: "orange", phone: normalized };
  }

  // Cameroon number but not MTN or Orange
  return null;
}


/**
 * Remove country code from phone number using Google's libphonenumber
 * @param phoneNumber - Phone number with or without country code
 * @param defaultRegion - Default region code (e.g., 'GA' for Gabon)
 * @returns Phone number without country code
 *
 * Examples:
 * removeCountryCode('+241123456789') -> '123456789'
 * removeCountryCode('+33123456789') -> '123456789'
 * removeCountryCode('123456789', 'GA') -> '123456789'
 * removeCountryCode('') -> ''
 */
function removeCountryCode(phoneNumber: string, defaultRegion = 'GA'): string {
  if (!phoneNumber) return '';

  try {
    // Get an instance of PhoneNumberUtil
    const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

    // Parse the phone number
    const parsedNumber = phoneUtil.parse(phoneNumber, defaultRegion);

    // Get the national number (without country code)
    const nationalNumber = parsedNumber.getNationalNumber();

    // Return the national number as string
    return nationalNumber ? nationalNumber.toString() : phoneNumber;
  } catch {
    // If parsing fails, return the original number
    // This handles cases where the number format is not recognized
    return phoneNumber;
  }
}

/**
 * Validate phone number using Google's libphonenumber
 * @param phoneNumber - Phone number to validate
 * @param defaultRegion - Default region code (e.g., 'GA' for Gabon)
 * @returns Object with validation results
 */
function validatePhoneNumber(
  phoneNumber: string,
  defaultRegion = 'GA'
): {
  isValid: boolean;
  isPossible: boolean;
  countryCode: string;
  nationalNumber: string;
  regionCode: string;
} {
  if (!phoneNumber) {
    return {
      isValid: false,
      isPossible: false,
      countryCode: '',
      nationalNumber: '',
      regionCode: '',
    };
  }


  try {
    const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    const parsedNumber = phoneUtil.parse(phoneNumber, defaultRegion);

    return {
      isValid: phoneUtil.isValidNumber(parsedNumber),
      isPossible: phoneUtil.isPossibleNumber(parsedNumber),
      countryCode: parsedNumber.getCountryCode()?.toString() || '',
      nationalNumber: parsedNumber.getNationalNumber()?.toString() || '',
      regionCode: phoneUtil.getRegionCodeForNumber(parsedNumber) || '',
    };
  } catch {
    return {
      isValid: false,
      isPossible: false,
      countryCode: '',
      nationalNumber: '',
      regionCode: '',
    };
  }
}

export interface MobilePaymentRequest {
  amount: number;
  currency: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  ownerCharge?: 'MERCHANT' | 'CUSTOMER';
  callbackUrl?: string;
  returnUrl?: string;
  provider?: 'mypvit' | 'airtel' | 'moov' | 'mtn' | 'orange';
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
}

export interface MobileTransactionStatus {
  transactionId: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
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

@Injectable()
export class MobilePaymentsService {
  private readonly logger = new Logger(MobilePaymentsService.name);
  private readonly providers: Map<string, unknown> = new Map();

  constructor(private readonly myPVitService: MyPVitService, private readonly mtnMomoService: MtnMomoService) {
    // Register payment providers
    this.providers.set('mypvit', myPVitService);
  }

  getProvider(phoneNumber: string): 'airtel' | 'mypvit' | 'moov' | 'mtn' | 'orange' {
    const res = detectCameroonPhone(phoneNumber);
    if(res) {
      return res.carrier as 'mtn' | 'orange';
    }
    return 'mypvit';
  }

  /**
   * Get available payment providers
   */
  async getAvailableProviders(): Promise<PaymentProvider[]> {
    const providers: PaymentProvider[] = [];

    // MyPVit provider
    const mypvitAvailable = await this.myPVitService.testConnection();
    providers.push({
      name: 'MyPVit',
      supportedMethods: ['mobile_money', 'card'],
      supportedCurrencies: ['XAF', 'USD', 'EUR'],
      isAvailable: mypvitAvailable,
    });

    return providers;
  }

  /**
   * Get supported payment methods for a provider
   */
  async getSupportedPaymentMethods(provider: string): Promise<string[]> {
    switch (provider.toLowerCase()) {
      case 'mypvit':
        return await this.myPVitService.getSupportedPaymentMethods();
      default:
        return [];
    }
  }

  /**
   * Initiate a mobile payment
   */
  async initiatePayment(
    paymentRequest: MobilePaymentRequest,
    reference?: string,
    userId?: string
  ): Promise<MobilePaymentResponse> {
    try {
      // Validate phone number if provided
      if (paymentRequest.customerPhone) {
        const phoneValidation = validatePhoneNumber(
          paymentRequest.customerPhone
        );
        if (!phoneValidation.isValid) {
          this.logger.warn(
            `Invalid phone number provided: ${paymentRequest.customerPhone}`
          );
          return {
            success: false,
            message: 'Invalid phone number format',
            errorCode: 'INVALID_PHONE_NUMBER',
          };
        }

        this.logger.log(
          `Phone number validated: ${paymentRequest.customerPhone} -> Country: ${phoneValidation.regionCode}, National: ${phoneValidation.nationalNumber}`
        );
      }

      this.logger.log(
        `Initiating mobile payment for account: ${
          paymentRequest.customerPhone
            ? removeCountryCode(paymentRequest.customerPhone)
            : paymentRequest.accountId || 'unknown'
        }`
      );

      // Determine the best provider based on request
      const provider = this.selectProvider(paymentRequest);

      if (!provider) {
        return {
          success: false,
          message: 'No suitable payment provider available',
          errorCode: 'NO_PROVIDER_AVAILABLE',
        };
      }

      // Convert to provider-specific request
      const providerRequest = this.convertToProviderRequest(
        paymentRequest as MobilePaymentRequest & CollectionRequest,
        provider,
        reference
      );

      let response: MobilePaymentResponse;

      switch (provider) {
        case 'mypvit':
        case 'airtel':
        case 'moov': {
          const phoneNumber = removeCountryCode(
            paymentRequest.customerPhone || ''
          );
          const mypvitResponse = await this.myPVitService.initiatePayment(
            providerRequest as MyPVitPaymentRequest,
            reference,
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
    } catch (error) {
      this.logger.error('Failed to initiate mobile payment:', error);
      return {
        success: false,
        message: 'Failed to initiate payment',
        errorCode: 'INITIATION_FAILED',
      };
    }
  }

  /**
   * Check transaction status
   */
  async checkTransactionStatus(
    transactionId: string,
    provider?: string
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
            transactionId
          );
          status = {
            transactionId: mypvitStatus.transactionId,
            status: mypvitStatus.status as
              | 'pending'
              | 'success'
              | 'failed'
              | 'cancelled',
            amount: mypvitStatus.amount || 0,
            currency: mypvitStatus.currency || 'XAF',
            reference: mypvitStatus.reference || '',
            message: mypvitStatus.message,
            provider: 'mypvit',
          };
          break;
        }
        default:
          throw new Error(`Unsupported payment provider: ${paymentProvider}`);
      }

      // Log the status check
      await this.logStatusCheck(transactionId, status);

      return status;
    } catch (error) {
      this.logger.error('Failed to check transaction status:', error);
      throw error;
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
        default:
          throw new Error(`Unsupported payment provider: ${paymentProvider}`);
      }

      // Log the cancellation
      await this.logTransactionCancellation(transactionId, success);

      return success;
    } catch (error) {
      this.logger.error('Failed to cancel transaction:', error);
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
        default:
          this.logger.warn(
            `Unsupported provider for callback verification: ${provider}`
          );
          return false;
      }
    } catch (error) {
      this.logger.error('Failed to verify callback:', error);
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
        default:
          this.logger.warn(
            `Unsupported provider for transaction history: ${provider}`
          );
          return [];
      }
    } catch (error) {
      this.logger.error('Failed to get transaction history:', error);
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
        default:
          throw new Error(
            `Unsupported provider for balance check: ${provider}`
          );
      }
    } catch (error) {
      this.logger.error('Failed to check balance:', error);
      throw error;
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
    } catch (error) {
      this.logger.error('Failed to perform KYC:', error);
      throw error;
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
    } catch (error) {
      this.logger.error(`Failed to update secret ${secretName}:`, error);
      throw error;
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
   * Select the best payment provider based on request
   */
  private selectProvider(request: MobilePaymentRequest): string | null {

    if(request.customerPhone) {
      const res = detectCameroonPhone(request.customerPhone);
      if(res) {
        return res.carrier;
      }
    }

    // If provider is explicitly specified, use it
    if (request.provider) {
      return request.provider;
    }

    // Default to MyPVit for now
    return 'mypvit';
  }

  /**
   * Convert generic request to provider-specific request
   */
  private convertToProviderRequest(
    request: MobilePaymentRequest & CollectionRequest,
    provider: string,
    reference?: string
  ): CollectionRequest | MyPVitPaymentRequest {
    const phoneNumber = removeCountryCode(request.customerPhone || '');
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
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Detect provider from transaction ID
   */
  private async detectProvider(transactionId: string): Promise<string | null> {
    // This is a simplified implementation
    // In a real scenario, you might store provider information with the transaction
    // For now, we'll try MyPVit first
    try {
      await this.myPVitService.checkTransactionStatus(transactionId);
      return 'mypvit';
    } catch {
      // Try other providers here when they're implemented
      return null;
    }
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
