import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';
import {
  Commission_Payouts_Insert_Input,
  GetPartnersQuery,
  GetRendasuaHQUserQuery,
  InsertCommissionPayoutMutation,
  Partners,
} from '../commissions/generated-types';
import {
  Addresses,
  GetAccountByIdQuery,
  GetUserAgentQuery,
  GetUserBusinessQuery,
  GetUserByIdQuery,
  GetUserClientQuery,
} from '../generated/graphql';
import type { PersonaId } from '../users/persona.types';
import { legacyUserTypeIdForPersonas } from '../users/persona.util';
import {
  GET_ACCOUNT_BY_ID,
  GET_USER_ACCOUNT,
  GET_USER_ACCOUNT_BY_LOCATION,
  GET_USER_AGENT,
  GET_USER_BUSINESS,
  GET_USER_BY_ID,
  GET_USER_BY_ID_WITH_RELATIONS,
  GET_USER_CLIENT,
} from './hasura.queries';

/** Row from account lookup queries; used for explicit location vs legacy matching. */
type UserAccountLookupRow = {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  business_location_id?: string | null;
  created_at: string;
};

@Injectable()
export class HasuraSystemService {
  private readonly logger = new Logger(HasuraSystemService.name);
  private readonly hasuraUrl: string;
  private readonly adminSecret: string;
  private readonly client: GraphQLClient;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get('hasura');

    console.log('config', config);

    this.hasuraUrl = config.endpoint || 'http://localhost:8080/v1/graphql';
    this.adminSecret = config.adminSecret || 'myadminsecretkey';

    this.client = new GraphQLClient(this.hasuraUrl, {
      headers: {
        'x-hasura-admin-secret': this.adminSecret,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Creates a GraphQL client with admin secret for system operations
   */
  createClient(): GraphQLClient {
    return new GraphQLClient(this.hasuraUrl, {
      headers: {
        'x-hasura-admin-secret': this.adminSecret,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute a GraphQL query with admin privileges
   */
  async executeQuery<T = any>(query: string, variables?: any): Promise<T> {
    return this.client.request<T>(query, variables);
  }

  /**
   * Execute a GraphQL mutation with admin privileges
   */
  async executeMutation<T = any>(
    mutation: string,
    variables?: any
  ): Promise<T> {
    return this.client.request<T>(mutation, variables);
  }

  /**
   * Create a user account for a given user and currency.
   * When businessLocationId is set, creates a location-scoped account.
   */
  async createUserAccount(
    userId: string,
    currency: string,
    available_balance = 0,
    withheld_balance = 0,
    businessLocationId?: string | null
  ): Promise<any> {
    const mutation = `
      mutation CreateUserAccount($userId: uuid!, $currency: currency_enum!, $available_balance: numeric!, $withheld_balance: numeric!, $businessLocationId: uuid) {
        insert_accounts_one(object: {
          user_id: $userId,
          currency: $currency,
          available_balance: $available_balance,
          withheld_balance: $withheld_balance,
          business_location_id: $businessLocationId
        }) {
          id
          user_id
          currency
          available_balance
          withheld_balance
          business_location_id
        }
      }
    `;
    const result = await this.executeMutation(mutation, {
      userId,
      currency,
      available_balance,
      withheld_balance,
      businessLocationId: businessLocationId ?? null,
    });
    return result.insert_accounts_one;
  }

  /**
   * Get the Hasura endpoint URL
   */
  getHasuraUrl(): string {
    return this.hasuraUrl;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.hasuraUrl && this.adminSecret);
  }

  /**
   * Get the client user using HasuraSystemService (create method if not exists)
   * We'll assume a method getUserById exists or add it to HasuraSystemService if not.
   * Usage:   const clientUser = await this.hasuraSystemService.getUserById(clientUserId);
   * If not present, you should add this to HasuraSystemService:
   */
  async getUserById(userId: string) {
    const result = await this.executeQuery<GetUserByIdQuery>(GET_USER_BY_ID, {
      userId,
    });
    return result.users_by_pk;
  }

  /**
   * User row with client, agent, and business relations (admin).
   * Needed for /users/me personas: user-scoped GraphQL can hide relations under RLS.
   */
  async getUserByIdWithRelations(userId: string): Promise<any> {
    const result = await this.executeQuery<any>(
      GET_USER_BY_ID_WITH_RELATIONS,
      { userId }
    );
    return result.users_by_pk ?? null;
  }

  /** Counts addresses linked to this user across client, agent, and business personas. */
  async countLinkedAddressesForUser(userId: string): Promise<number> {
    const result = await this.executeQuery<{
      ca: { aggregate: { count: number } | null } | null;
      aa: { aggregate: { count: number } | null } | null;
      ba: { aggregate: { count: number } | null } | null;
    }>(
      `
      query CountUserAddresses($uid: uuid!) {
        ca: client_addresses_aggregate(
          where: { client: { user_id: { _eq: $uid } } }
        ) {
          aggregate {
            count
          }
        }
        aa: agent_addresses_aggregate(
          where: { agent: { user_id: { _eq: $uid } } }
        ) {
          aggregate {
            count
          }
        }
        ba: business_addresses_aggregate(
          where: { business: { user_id: { _eq: $uid } } }
        ) {
          aggregate {
            count
          }
        }
      }
    `,
      { uid: userId }
    );
    const n = (x: { aggregate: { count: number } | null } | null) =>
      x?.aggregate?.count ?? 0;
    return n(result.ca) + n(result.aa) + n(result.ba);
  }

  async setUserTimezone(userId: string, timezone: string): Promise<void> {
    await this.executeMutation(
      `
      mutation SetUserTimezone($id: uuid!, $tz: String!) {
        update_users_by_pk(pk_columns: { id: $id }, _set: { timezone: $tz }) {
          id
        }
      }
    `,
      { id: userId, tz: timezone }
    );
  }

  /**
   * Get client by user ID
   */
  async getClient(id: string): Promise<any> {
    const query = `
      query ($id: uuid!) {
        clients(where: { id: { _eq: $id } }) {
          id
          user_id
        }
      }
    `;
    const result = await this.executeQuery(query, { id });
    return result.clients[0] || null;
  }

  /**
   * Get business by user ID
   */
  async getBusiness(id: string): Promise<any> {
    const query = `
      query ($id: uuid!) {
        businesses(where: { id: { _eq: $id } }) {
          id
          user_id
          name
          is_admin
          is_verified
        }
      }
    `;
    const result = await this.executeQuery(query, { id });
    return result.businesses[0] || null;
  }

  /**
   * Get agent by user ID
   */
  async getAgent(id: string): Promise<any> {
    const query = `
      query ($id: uuid!) {
        agents(where: { id: { _eq: $id } }) {
          id
          user_id
          vehicle_type_id
          is_verified
        }
      }
    `;
    const result = await this.executeQuery(query, { id });
    return result.agents[0] || null;
  }

  /**
   * Prefer one account from a list: location-scoped when businessLocationId is set, else legacy (null location).
   * If multiple rows match (data issue), uses oldest created_at and logs a warning.
   */
  private pickUserAccount(
    accounts: UserAccountLookupRow[] | undefined | null,
    businessLocationId?: string | null
  ): UserAccountLookupRow | null {
    const list = accounts ?? [];
    const useLocation =
      businessLocationId != null && businessLocationId !== '';
    const matches = useLocation
      ? list.filter((a) => a.business_location_id === businessLocationId)
      : list.filter((a) => a.business_location_id == null);
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    this.logger.warn(
      `Multiple active accounts match user/currency${useLocation ? ` (location=${businessLocationId})` : ' (legacy, null location)'}; ` +
        `using oldest by created_at (count=${matches.length})`
    );
    return [...matches].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];
  }

  /**
   * Get user account by userId and currency.
   * When businessLocationId is provided, returns the account for that location; otherwise the legacy account (business_location_id IS NULL).
   */
  async getAccount(
    userId: string,
    currency: string,
    businessLocationId?: string | null
  ): Promise<any> {
    const hasLocation =
      businessLocationId != null && businessLocationId !== '';
    const result = await this.executeQuery<{ accounts: UserAccountLookupRow[] }>(
      hasLocation ? GET_USER_ACCOUNT_BY_LOCATION : GET_USER_ACCOUNT,
      hasLocation
        ? { userId, currency, businessLocationId }
        : { userId, currency }
    );
    let account = this.pickUserAccount(result.accounts, businessLocationId);
    if (!account) {
      account = await this.createUserAccount(
        userId,
        currency,
        0,
        0,
        hasLocation ? businessLocationId : null
      );
    }
    return account;
  }

  /**
   * Get the primary (or first) business address country for a business.
   * Returns null if the business has no addresses.
   */
  async getBusinessPrimaryAddressCountry(businessId: string): Promise<string | null> {
    const query = `
      query GetBusinessPrimaryAddress($businessId: uuid!) {
        business_addresses(
          where: { business_id: { _eq: $businessId } }
          limit: 1
        ) {
          address { country }
        }
      }
    `;
    const result = await this.executeQuery<{
      business_addresses: Array<{ address: { country: string } }>;
    }>(query, { businessId });
    const first = result.business_addresses?.[0]?.address?.country;
    return first ?? null;
  }

  /** True if this address is linked to the business via business_addresses. */
  async verifyBusinessAddressOwnership(
    businessId: string,
    addressId: string
  ): Promise<boolean> {
    const query = `
      query VerifyBusinessAddress($businessId: uuid!, $addressId: uuid!) {
        business_addresses(
          where: {
            business_id: { _eq: $businessId }
            address_id: { _eq: $addressId }
          }
          limit: 1
        ) {
          id
        }
      }
    `;
    const result = await this.executeQuery<{
      business_addresses: Array<{ id: string }>;
    }>(query, { businessId, addressId });
    return (result.business_addresses?.length ?? 0) > 0;
  }

  /**
   * Ensure an account exists for a business location (creates if missing).
   * Uses location's address country for currency. Call after inserting a business_location.
   */
  async ensureAccountForBusinessLocation(businessLocationId: string): Promise<any> {
    const query = `
      query GetBusinessLocationForAccount($id: uuid!) {
        business_locations_by_pk(id: $id) {
          id
          business { user_id }
          address { country }
        }
      }
    `;
    const result = await this.executeQuery<{
      business_locations_by_pk: { id: string; business: { user_id: string }; address: { country: string } };
    }>(query, { id: businessLocationId });
    const row = result.business_locations_by_pk;
    if (!row?.business?.user_id || !row?.address?.country) {
      return null;
    }
    const currency = await this.getCurrencyFromCountry(row.address.country);
    return this.getAccount(row.business.user_id, currency, businessLocationId);
  }

  private async getCurrencyFromCountry(country: string): Promise<string> {
    try {
      const countryToCurrency = await import('country-to-currency');
      const code = (country || '').toUpperCase().slice(0, 2);
      const currency = (countryToCurrency.default as Record<string, string>)[code];
      return currency || 'XAF';
    } catch {
      return 'XAF';
    }
  }

  /**
   * Get account by ID
   */
  async getAccountById(accountId: string) {
    const result = await this.executeQuery<GetAccountByIdQuery>(
      GET_ACCOUNT_BY_ID,
      {
        accountId,
      }
    );

    return result.accounts_by_pk;
  }

  /**
   * Update user account balances
   */
  async updateUserAccount(
    accountId: string,
    updates: {
      available_balance?: number;
      withheld_balance?: number;
    },
    operation: 'set' | 'inc' = 'set'
  ): Promise<any> {
    const mutation = `
      mutation UpdateUserAccount(
        $accountId: uuid!,
        $availableBalance: numeric,
        $withheldBalance: numeric
      ) {
        update_accounts_by_pk(
          pk_columns: { id: $accountId },
          ${operation === 'inc' ? '_inc' : '_set'}: {
            available_balance: $availableBalance,
            withheld_balance: $withheldBalance
          }
        ) {
          id
          available_balance
          withheld_balance
          total_balance
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      accountId,
      availableBalance: updates.available_balance,
      withheldBalance: updates.withheld_balance,
    });

    return result.update_accounts_by_pk;
  }


  /**
   * Get user client by user ID
   */
  async getUserClient(userId: string) {
    const clientResult = await this.executeQuery<GetUserClientQuery>(
      GET_USER_CLIENT,
      {
        userId,
      }
    );

    return clientResult.clients[0];
  }

  /**
   * Get user business by user ID
   */
  async getUserBusiness(userId: string) {
    const businessResult = await this.executeQuery<GetUserBusinessQuery>(
      GET_USER_BUSINESS,
      {
        userId,
      }
    );
    return businessResult.businesses[0];
  }

  /**
   * Get user agent by user ID
   */
  async getUserAgent(userId: string) {
    const agentResult = await this.executeQuery<GetUserAgentQuery>(
      GET_USER_AGENT,
      {
        userId,
      }
    );
    return agentResult.agents[0];
  }

  /**
   * Get all user addresses by user ID and user type
   */
  async getAllUserAddresses(
    userId: string,
    userType: string
  ): Promise<(Addresses & { formatted_address: string })[]> {
    let query: string;

    switch (userType) {
      case 'client':
        query = `
          query GetAllClientAddresses($userId: uuid!) {
            client_addresses(where: {client: {user_id: {_eq: $userId}}}) {
              address {
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
          }
        `;
        break;
      case 'agent':
        query = `
          query GetAllAgentAddresses($userId: uuid!) {
            agent_addresses(where: {agent: {user_id: {_eq: $userId}}}) {
              address {
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
          }
        `;
        break;
      case 'business':
        query = `
          query GetAllBusinessAddresses($userId: uuid!) {
            business_addresses(where: {business: {user_id: {_eq: $userId}}}) {
              address {
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
          }
        `;
        break;
      default:
        throw new Error('Invalid user type');
    }

    const addressResult = await this.executeQuery(query, {
      userId,
    });

    const addresses =
      addressResult.client_addresses ||
      addressResult.agent_addresses ||
      addressResult.business_addresses;

    return (
      addresses
        ?.map((item: any) => {
          const address = item.address;
          if (!address) return null;

          // Create formatted address by combining address fields
          const addressParts = [
            address.address_line_1,
            address.address_line_2,
            address.city,
            address.state,
            address.postal_code,
            address.country,
          ].filter((part) => part && part.trim() !== '');

          return {
            ...address,
            formatted_address: addressParts.join(', '),
          };
        })
        .filter(Boolean) || []
    );
  }

  /**
   * Get active partners
   */
  async getPartners(): Promise<Partners[]> {
    const query = `
      query GetActivePartners {
        partners(where: { is_active: { _eq: true } }) {
          id
          user_id
          company_name
          base_delivery_fee_commission
          per_km_delivery_fee_commission
          item_commission
          is_active
          created_at
          updated_at
        }
      }
    `;

    const response = await this.executeQuery<GetPartnersQuery>(query);
    return response.partners || [];
  }

  /**
   * Get RendaSua HQ user
   */
  async getRendasuaHQUser(): Promise<
    GetRendasuaHQUserQuery['users'][0] | null
  > {
    const query = `
      query GetRendasuaHQUser {
        users(where: { email: { _eq: "hq@rendasua.com" } }) {
          id
          user_type_id
          first_name
          last_name
          email
          phone_number
        }
      }
    `;

    const response = await this.executeQuery<GetRendasuaHQUserQuery>(query);
    return response.users?.[0] || null;
  }

  /**
   * Insert commission payout audit record
   */
  async insertCommissionPayout(payout: {
    orderId: string;
    recipientUserId: string;
    recipientType: string;
    commissionType: string;
    amount: number;
    currency: string;
    commissionPercentage?: number;
    accountTransactionId: string;
  }): Promise<InsertCommissionPayoutMutation['insert_commission_payouts_one']> {
    const mutation = `
      mutation InsertCommissionPayout($payout: commission_payouts_insert_input!) {
        insert_commission_payouts_one(object: $payout) {
          id
        }
      }
    `;

    const variables = {
      payout: {
        order_id: payout.orderId,
        recipient_user_id: payout.recipientUserId,
        recipient_type: payout.recipientType,
        commission_type: payout.commissionType,
        amount: payout.amount,
        currency: payout.currency,
        commission_percentage: payout.commissionPercentage,
        account_transaction_id: payout.accountTransactionId,
      } as Commission_Payouts_Insert_Input,
    };

    const response = await this.executeMutation<InsertCommissionPayoutMutation>(
      mutation,
      variables
    );
    return response.insert_commission_payouts_one;
  }

  /**
   * Create a new user record
   */
  async createUser(userData: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    user_type_id: string;
  }): Promise<any> {
    const mutation = `
      mutation CreateUser(
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!
      ) {
        insert_users_one(object: {
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id
        }) {
          id
          email
          first_name
          last_name
          phone_number
          phone_number_verified
          email_verified
          user_type_id
          created_at
          updated_at
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
    });

    return result.insert_users_one;
  }

  /**
   * Single insert with nested client and/or agent and/or business (signup / complete profile).
   */
  async insertUserWithPersonas(params: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string | null;
    email_verified?: boolean;
    personas: PersonaId[];
    vehicle_type_id?: string;
    business_name?: string;
    main_interest?: 'sell_items' | 'rent_items';
  }): Promise<{
    user: any;
    client?: any;
    agent?: any;
    business?: any;
  }> {
    const { mutation, variables } = this.buildMultiPersonaUserInsert(params);
    const result = await this.executeMutation(mutation, variables);
    const u = result.insert_users_one;
    return {
      user: {
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        phone_number: u.phone_number,
        phone_number_verified: u.phone_number_verified,
        email_verified: u.email_verified,
        user_type_id: u.user_type_id,
        created_at: u.created_at,
        updated_at: u.updated_at,
      },
      client: u.client ?? undefined,
      agent: u.agent ?? undefined,
      business: u.business ?? undefined,
    };
  }

  private buildMultiPersonaUserInsert(params: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string | null;
    email_verified?: boolean;
    personas: PersonaId[];
    vehicle_type_id?: string;
    business_name?: string;
    main_interest?: 'sell_items' | 'rent_items';
  }): { mutation: string; variables: Record<string, unknown> } {
    const { personas } = params;
    const varDecls: string[] = [
      '$email: String!',
      '$first_name: String!',
      '$last_name: String!',
      '$phone_number: String',
      '$email_verified: Boolean!',
      '$user_type_id: user_types_enum!',
    ];
    const vars: Record<string, unknown> = {
      email: params.email,
      first_name: params.first_name,
      last_name: params.last_name,
      phone_number: params.phone_number ?? null,
      email_verified: params.email_verified ?? false,
      user_type_id: legacyUserTypeIdForPersonas(personas),
    };
    const objectFields = [
      'email: $email',
      'first_name: $first_name',
      'last_name: $last_name',
      'phone_number: $phone_number',
      'email_verified: $email_verified',
      'user_type_id: $user_type_id',
    ];
    const returnSel = [
      'id',
      'email',
      'first_name',
      'last_name',
      'phone_number',
      'phone_number_verified',
      'email_verified',
      'user_type_id',
      'created_at',
      'updated_at',
    ];
    if (personas.includes('client')) {
      objectFields.push('client: { data: {} }');
      returnSel.push('client { id user_id created_at updated_at }');
    }
    if (personas.includes('agent')) {
      varDecls.push('$vehicle_type_id: vehicle_types_enum!');
      vars.vehicle_type_id = params.vehicle_type_id || 'other';
      objectFields.push(
        'agent: { data: { vehicle_type_id: $vehicle_type_id } }'
      );
      returnSel.push(
        'agent { id user_id vehicle_type_id is_verified created_at updated_at }'
      );
    }
    if (personas.includes('business')) {
      varDecls.push('$business_name: String!');
      varDecls.push('$main_interest: business_main_interest_enum!');
      vars.business_name = params.business_name ?? '';
      vars.main_interest = params.main_interest ?? 'sell_items';
      objectFields.push(
        'business: { data: { name: $business_name, main_interest: $main_interest } }'
      );
      returnSel.push(
        'business { id user_id name main_interest is_admin is_verified created_at updated_at }'
      );
    }
    const mutation = `
      mutation InsertUserMulti(${varDecls.join(', ')}) {
        insert_users_one(object: {
          ${objectFields.join('\n          ')}
        }) {
          ${returnSel.join('\n          ')}
        }
      }
    `;
    return { mutation, variables: vars };
  }

  /**
   * Create a new user with client record using nested query
   */
  async createUserWithClient(userData: {
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    user_type_id: string;
  }): Promise<{ user: any; client: any }> {
    const mutation = `
      mutation CreateUserWithClient(
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!
      ) {
        insert_users_one(object: {
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id,
          client: {
            data: {}
          }
        }) {
          id
          email
          first_name
          last_name
          phone_number
          phone_number_verified
          email_verified
          user_type_id
          created_at
          updated_at
          client {
            id
            user_id
            created_at
            updated_at
          }
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
    });

    const user = result.insert_users_one;
    const client = user.client;

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        phone_number_verified: user.phone_number_verified,
        email_verified: user.email_verified,
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      client: {
        id: client.id,
        user_id: client.user_id,
        created_at: client.created_at,
        updated_at: client.updated_at,
      },
    };
  }

  /**
   * Create a new user with agent record using nested query
   */
  async createUserWithAgent(
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      phone_number?: string;
      user_type_id: string;
    },
    agentData: { vehicle_type_id: string }
  ): Promise<{ user: any; agent: any }> {
    const mutation = `
      mutation CreateUserWithAgent(
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!,
        $vehicle_type_id: vehicle_types_enum!
      ) {
        insert_users_one(object: {
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id,
          agent: {
            data: {
              vehicle_type_id: $vehicle_type_id
            }
          }
        }) {
          id
          email
          first_name
          last_name
          phone_number
          phone_number_verified
          email_verified
          user_type_id
          created_at
          updated_at
          agent {
            id
            user_id
            vehicle_type_id
            is_verified
            created_at
            updated_at
          }
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
      vehicle_type_id: agentData.vehicle_type_id,
    });

    const user = result.insert_users_one;
    const agent = user.agent;

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        phone_number_verified: user.phone_number_verified,
        email_verified: user.email_verified,
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      agent: {
        id: agent.id,
        user_id: agent.user_id,
        vehicle_type_id: agent.vehicle_type_id,
        is_verified: agent.is_verified,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
      },
    };
  }

  /**
   * Create a new user with business record using nested query
   */
  async createUserWithBusiness(
    userData: {
      email: string;
      first_name: string;
      last_name: string;
      phone_number?: string;
      user_type_id: string;
    },
    businessData: { name: string; main_interest?: 'sell_items' | 'rent_items' }
  ): Promise<{ user: any; business: any }> {
    const mutation = `
      mutation CreateUserWithBusiness(
        $email: String!, 
        $first_name: String!, 
        $last_name: String!, 
        $phone_number: String,
        $user_type_id: user_types_enum!,
        $business_name: String!,
        $main_interest: business_main_interest_enum!
      ) {
        insert_users_one(object: {
          email: $email,
          first_name: $first_name,
          last_name: $last_name,
          phone_number: $phone_number,
          user_type_id: $user_type_id,
          business: {
            data: {
              name: $business_name
              main_interest: $main_interest
            }
          }
        }) {
          id
          email
          first_name
          last_name
          phone_number
          phone_number_verified
          email_verified
          user_type_id
          created_at
          updated_at
          business {
            id
            user_id
            name
            main_interest
            is_admin
            is_verified
            created_at
            updated_at
          }
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      user_type_id: userData.user_type_id,
      business_name: businessData.name,
      main_interest: businessData.main_interest ?? 'sell_items',
    });

    const user = result.insert_users_one;
    const business = user.business;

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        phone_number_verified: user.phone_number_verified,
        email_verified: user.email_verified,
        user_type_id: user.user_type_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      business: {
        id: business.id,
        user_id: business.user_id,
        name: business.name,
        main_interest: business.main_interest,
        is_admin: business.is_admin,
        is_verified: business.is_verified,
        created_at: business.created_at,
        updated_at: business.updated_at,
      },
    };
  }
}
