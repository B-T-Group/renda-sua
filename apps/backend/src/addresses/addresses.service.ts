import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { getCountry } from 'country-currency-map';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface CreateAddressDto {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary?: boolean;
  address_type?: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressResponse {
  id: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
  address_type: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class AddressesService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  private getCurrencyFromCountry(country: string): string {
    try {
      const countryInfo = getCountry(country);
      if (!countryInfo || !countryInfo.currency) {
        // Default to XAF for Cameroon if country not found
        return 'XAF';
      }

      // Map common currency codes to our enum values
      const currencyMap: { [key: string]: string } = {
        USD: 'USD',
        EUR: 'EUR',
        GBP: 'GBP',
        JPY: 'JPY',
        CNY: 'CNY',
        CHF: 'CHF',
        CAD: 'CAD',
        AUD: 'AUD',
        XAF: 'XAF',
        XOF: 'XOF',
        NGN: 'NGN',
        ZAR: 'ZAR',
        EGP: 'EGP',
        KES: 'KES',
        GHS: 'GHS',
        MAD: 'MAD',
        TND: 'TND',
        DZD: 'DZD',
        ETB: 'ETB',
        UGX: 'UGX',
        TZS: 'TZS',
        MWK: 'MWK',
        ZMW: 'ZMW',
        BWP: 'BWP',
        NAM: 'NAM',
        LSL: 'LSL',
        SZL: 'SZL',
        MUR: 'MUR',
        SCR: 'SCR',
        CDF: 'CDF',
        RWF: 'RWF',
        BIF: 'BIF',
        SDG: 'SDG',
        SOS: 'SOS',
        DJF: 'DJF',
        KMF: 'KMF',
        MGA: 'MGA',
        INR: 'INR',
        KRW: 'KRW',
        SGD: 'SGD',
        HKD: 'HKD',
        TWD: 'TWD',
        THB: 'THB',
        MYR: 'MYR',
        IDR: 'IDR',
        PHP: 'PHP',
        VND: 'VND',
        PKR: 'PKR',
        BDT: 'BDT',
        LKR: 'LKR',
        NPR: 'NPR',
        MMK: 'MMK',
        KHR: 'KHR',
        LAK: 'LAK',
        MNT: 'MNT',
        SEK: 'SEK',
        NOK: 'NOK',
        DKK: 'DKK',
        PLN: 'PLN',
        CZK: 'CZK',
        HUF: 'HUF',
        RON: 'RON',
        BGN: 'BGN',
        HRK: 'HRK',
        RSD: 'RSD',
        ALL: 'ALL',
        MKD: 'MKD',
        BAM: 'BAM',
        MDL: 'MDL',
        UAH: 'UAH',
        BYN: 'BYN',
        RUB: 'RUB',
        TRY: 'TRY',
        GEL: 'GEL',
        AMD: 'AMD',
        AZN: 'AZN',
        BRL: 'BRL',
        MXN: 'MXN',
        ARS: 'ARS',
        CLP: 'CLP',
        COP: 'COP',
        PEN: 'PEN',
        UYU: 'UYU',
        PYG: 'PYG',
        BOB: 'BOB',
        VES: 'VES',
        GTQ: 'GTQ',
        HNL: 'HNL',
        NIO: 'NIO',
        CRC: 'CRC',
        PAB: 'PAB',
        DOP: 'DOP',
        JMD: 'JMD',
        TTD: 'TTD',
        BBD: 'BBD',
        XCD: 'XCD',
        NZD: 'NZD',
        FJD: 'FJD',
        PGK: 'PGK',
        WST: 'WST',
        TOP: 'TOP',
        VUV: 'VUV',
        SBD: 'SBD',
        SAR: 'SAR',
        AED: 'AED',
        QAR: 'QAR',
        KWD: 'KWD',
        BHD: 'BHD',
        OMR: 'OMR',
        JOD: 'JOD',
        LBP: 'LBP',
        ILS: 'ILS',
        IRR: 'IRR',
        IQD: 'IQD',
        AFN: 'AFN',
      };

      const currency = currencyMap[countryInfo.currency] || 'XAF';
      return currency;
    } catch (error) {
      // Default to XAF if there's any error
      return 'XAF';
    }
  }

  private async getUserInfo(identifier: string) {
    const getUserQuery = `
      query GetUserByIdentifier($identifier: String!) {
        users(where: {identifier: {_eq: $identifier}}) {
          id
          identifier
          user_type_id
        }
      }
    `;

    const userResult = await this.hasuraUserService.executeQuery(getUserQuery, {
      identifier,
    });

    if (!userResult.users || userResult.users.length === 0) {
      throw new HttpException(
        {
          success: false,
          error: 'User not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    return userResult.users[0];
  }

  private async checkExistingAccount(userId: string, currency: string) {
    const checkExistingAccountQuery = `
      query CheckExistingAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(where: {user_id: {_eq: $userId}, currency: {_eq: $currency}}) {
          id
          currency
        }
      }
    `;

    const existingAccountResult = await this.hasuraUserService.executeQuery(
      checkExistingAccountQuery,
      {
        userId,
        currency,
      }
    );

    return (
      existingAccountResult.accounts &&
      existingAccountResult.accounts.length > 0
    );
  }

  private async createAccount(userId: string, currency: string) {
    const createAccountMutation = `
      mutation CreateAccount(
        $userId: uuid!, 
        $currency: currency_enum!
      ) {
        insert_accounts_one(object: {
          user_id: $userId,
          currency: $currency,
          available_balance: 0,
          withheld_balance: 0,
          is_active: true
        }) {
          id
          user_id
          currency
          available_balance
          withheld_balance
          total_balance
          is_active
          created_at
          updated_at
        }
      }
    `;

    const result = await this.hasuraSystemService.executeMutation(
      createAccountMutation,
      {
        userId,
        currency,
      }
    );

    return result.insert_accounts_one;
  }

  async createAddress(addressData: CreateAddressDto): Promise<{
    success: boolean;
    address: AddressResponse;
    accountCreated?: any;
  }> {
    try {
      const identifier = this.hasuraUserService.getIdentifier();
      const user = await this.getUserInfo(identifier);

      // Create the address first
      const createAddressMutation = `
        mutation CreateAddress(
          $addressLine1: String!,
          $addressLine2: String,
          $city: String!,
          $state: String!,
          $postalCode: String!,
          $country: String!,
          $isPrimary: Boolean!,
          $addressType: String!,
          $latitude: Decimal,
          $longitude: Decimal
        ) {
          insert_addresses_one(object: {
            address_line_1: $addressLine1,
            address_line_2: $addressLine2,
            city: $city,
            state: $state,
            postal_code: $postalCode,
            country: $country,
            is_primary: $isPrimary,
            address_type: $addressType,
            latitude: $latitude,
            longitude: $longitude
          }) {
            id
            address_line_1
            address_line_2
            city
            state
            postal_code
            country
            is_primary
            address_type
            latitude
            longitude
            created_at
            updated_at
          }
        }
      `;

      const addressResult = await this.hasuraSystemService.executeMutation(
        createAddressMutation,
        {
          addressLine1: addressData.address_line_1,
          addressLine2: addressData.address_line_2,
          city: addressData.city,
          state: addressData.state,
          postalCode: addressData.postal_code,
          country: addressData.country,
          isPrimary: addressData.is_primary || false,
          addressType: addressData.address_type || 'home',
          latitude: addressData.latitude,
          longitude: addressData.longitude,
        }
      );

      const address = addressResult.insert_addresses_one;

      // Now create the junction table entry based on user type
      let junctionMutation = '';
      let junctionVariables = {};

      if (user.user_type_id === 1) {
        // Client
        junctionMutation = `
          mutation CreateClientAddress($clientId: uuid!, $addressId: uuid!) {
            insert_client_addresses_one(object: {
              client_id: $clientId,
              address_id: $addressId
            }) {
              id
              client_id
              address_id
              created_at
              updated_at
            }
          }
        `;
        junctionVariables = {
          clientId: user.id,
          addressId: address.id,
        };
      } else if (user.user_type_id === 2) {
        // Business
        junctionMutation = `
          mutation CreateBusinessAddress($businessId: uuid!, $addressId: uuid!) {
            insert_business_addresses_one(object: {
              business_id: $businessId,
              address_id: $addressId
            }) {
              id
              business_id
              address_id
              created_at
              updated_at
            }
          }
        `;
        junctionVariables = {
          businessId: user.id,
          addressId: address.id,
        };
      } else if (user.user_type_id === 3) {
        // Agent
        junctionMutation = `
          mutation CreateAgentAddress($agentId: uuid!, $addressId: uuid!) {
            insert_agent_addresses_one(object: {
              agent_id: $agentId,
              address_id: $addressId
            }) {
              id
              agent_id
              address_id
              created_at
              updated_at
            }
          }
        `;
        junctionVariables = {
          agentId: user.id,
          addressId: address.id,
        };
      }

      if (junctionMutation) {
        await this.hasuraSystemService.executeMutation(
          junctionMutation,
          junctionVariables
        );
      }

      // Get currency from country and create account if needed
      const currency = this.getCurrencyFromCountry(addressData.country);
      let accountCreated = null;

      const hasExistingAccount = await this.checkExistingAccount(
        user.id,
        currency
      );

      if (!hasExistingAccount) {
        accountCreated = await this.createAccount(user.id, currency);
      }

      return {
        success: true,
        address,
        accountCreated,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
