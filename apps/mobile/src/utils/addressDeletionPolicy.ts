/**
 * Mobile address deletion policy and error handling utilities
 * Provides consistent deletion eligibility checks and error code mapping
 */

export interface UserAddress {
  id: string;
  is_primary?: boolean;
  [key: string]: unknown;
}

export type AddressDeletionErrorCode =
  | 'ADDRESS_MINIMUM_REQUIRED'
  | 'ADDRESS_PRIMARY_DELETE_FORBIDDEN'
  | 'ADDRESS_PRIMARY_REPLACEMENT_REQUIRED';

export interface AddressDeletionError {
  code: AddressDeletionErrorCode;
  message: string;
}

/**
 * Check if an address can be deleted based on the list of addresses
 * Returns null if deletion is allowed, or an error object if not
 */
export function checkAddressDeletionEligibility(
  addressId: string,
  addresses: UserAddress[],
  activePersona?: 'client' | 'agent' | 'business'
): AddressDeletionError | null {
  const address = addresses.find((a) => a.id === addressId);
  if (!address) {
    return null; // Address not found, let backend handle it
  }

  const isAgentPersona = activePersona === 'agent';

  // Agents may delete their last address; client/business must keep at least one.
  if (addresses.length === 1 && !isAgentPersona) {
    return {
      code: 'ADDRESS_MINIMUM_REQUIRED',
      message: 'Cannot delete the only address. Each persona must have at least one address.',
    };
  }

  // Primary can be deleted when it is the agent's only address.
  if (address.is_primary && addresses.length > 1) {
    return {
      code: 'ADDRESS_PRIMARY_DELETE_FORBIDDEN',
      message: 'Cannot delete the primary address. Please set another address as primary first.',
    };
  }

  return null;
}

/**
 * Map backend error codes to localized messages
 * Used by components to display user-friendly error messages
 */
export function mapAddressErrorCodeToMessage(
  code: string | undefined,
  t: (key: string, defaultValue?: string) => string
): string {
  switch (code) {
    case 'ADDRESS_MINIMUM_REQUIRED':
      return t(
        'addresses.errors.minimumRequired',
        'Cannot delete the only address. Each persona must have at least one address.'
      );
    case 'ADDRESS_PRIMARY_DELETE_FORBIDDEN':
      return t(
        'addresses.errors.primaryDeleteForbidden',
        'Cannot delete the primary address. Please set another address as primary first.'
      );
    case 'ADDRESS_PRIMARY_REPLACEMENT_REQUIRED':
      return t(
        'addresses.errors.primaryReplacementRequired',
        'Cannot demote the primary address without another address to promote.'
      );
    default:
      return t('addresses.errors.unknown', 'An error occurred while processing your request.');
  }
}

/**
 * Extract error code from API error
 */
export function extractErrorCode(error: any): AddressDeletionErrorCode | undefined {
  if (error?.code) {
    return error.code;
  }
  if (error?.response?.data?.code) {
    return error.response.data.code;
  }
  return undefined;
}
