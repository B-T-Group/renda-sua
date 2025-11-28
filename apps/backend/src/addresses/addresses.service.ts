import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { GoogleDistanceService } from '../google/google-distance.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface CreateAddressDto {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code?: string;
  country: string;
  is_primary?: boolean;
  address_type?: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressResponse {
  id: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary?: boolean | null;
  address_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UpdateAddressDto {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  is_primary?: boolean;
  address_type?: string;
  latitude?: number;
  longitude?: number;
}

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly googleDistanceService: GoogleDistanceService
  ) {}

  /**
   * Format address components into a single string for geocoding
   */
  private formatAddressForGoogle(addressData: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code?: string;
    country: string;
  }): string {
    return [
      addressData.address_line_1,
      addressData.address_line_2,
      addressData.city,
      addressData.state,
      addressData.postal_code,
      addressData.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Geocode an address using Google API
   * Returns coordinates or null if geocoding fails
   */
  private async geocodeAddress(addressData: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code?: string;
    country: string;
  }): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const addressString = this.formatAddressForGoogle(addressData);
      const coordinates = await this.googleDistanceService.geocode(
        addressString
      );
      return coordinates;
    } catch (error: any) {
      this.logger.error(
        `Error geocoding address: ${error.message}`,
        error.stack
      );
      return null;
    }
  }

  private async getCurrencyFromCountry(country: string): Promise<string> {
    try {
      const countryToCurrency = await import('country-to-currency');
      const countryCode = country.toUpperCase();
      const currency = (countryToCurrency.default as any)[countryCode];
      if (!currency) {
        // Default to XAF for Cameroon if country not found
        return 'XAF';
      }
      return currency;
    } catch (error) {
      // Default to XAF for Cameroon if any error occurs
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
          client {
            id
          }
          agent {
            id
          }
          business {
            id
          }
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

  /**
   * Ensure only one address is marked as primary for a user
   * Sets all other addresses to is_primary = false
   */
  private async ensureSinglePrimaryAddress(
    userId: string,
    userType: string,
    excludeAddressId?: string
  ): Promise<void> {
    try {
      // Get all address IDs for this user via junction tables
      let addressIdsQuery = '';

      switch (userType) {
        case 'client':
          addressIdsQuery = `
            query GetClientAddressIds($userId: uuid!) {
              client_addresses(where: {client: {user_id: {_eq: $userId}}}) {
                address_id
              }
            }
          `;
          break;
        case 'agent':
          addressIdsQuery = `
            query GetAgentAddressIds($userId: uuid!) {
              agent_addresses(where: {agent: {user_id: {_eq: $userId}}}) {
                address_id
              }
            }
          `;
          break;
        case 'business':
          addressIdsQuery = `
            query GetBusinessAddressIds($userId: uuid!) {
              business_addresses(where: {business: {user_id: {_eq: $userId}}}) {
                address_id
              }
            }
          `;
          break;
        default:
          return;
      }

      const addressIdsResult = await this.hasuraUserService.executeQuery(
        addressIdsQuery,
        { userId }
      );

      let addressIds: string[] = [];
      if (userType === 'client') {
        addressIds = (addressIdsResult.client_addresses || []).map(
          (ca: any) => ca.address_id
        );
      } else if (userType === 'agent') {
        addressIds = (addressIdsResult.agent_addresses || []).map(
          (aa: any) => aa.address_id
        );
      } else if (userType === 'business') {
        addressIds = (addressIdsResult.business_addresses || []).map(
          (ba: any) => ba.address_id
        );
      }

      // Filter out the address we're about to create/update
      if (excludeAddressId) {
        addressIds = addressIds.filter((id) => id !== excludeAddressId);
      }

      if (addressIds.length === 0) {
        return;
      }

      // Update all other addresses to is_primary = false
      const updateMutation = `
        mutation UpdateAddressesPrimary($addressIds: [uuid!]!) {
          update_addresses(
            where: {id: {_in: $addressIds}},
            _set: {is_primary: false}
          ) {
            affected_rows
          }
        }
      `;

      await this.hasuraSystemService.executeMutation(updateMutation, {
        addressIds,
      });
    } catch (error: any) {
      this.logger.error(
        `Error ensuring single primary address: ${error.message}`,
        error.stack
      );
      // Don't throw - this is not critical enough to fail the operation
    }
  }

  async createAddress(addressData: CreateAddressDto): Promise<{
    success: boolean;
    address: AddressResponse;
    accountCreated?: any;
    warning?: string;
  }> {
    try {
      const identifier = this.hasuraUserService.getIdentifier();
      const user = await this.getUserInfo(identifier);

      // Geocode the address
      let coordinates: { latitude: number; longitude: number } | null = null;
      let warning = '';

      try {
        coordinates = await this.geocodeAddress(addressData);
        if (!coordinates) {
          // For agent and business addresses, geocoding is crucial
          if (
            user.user_type_id === 'agent' ||
            user.user_type_id === 'business'
          ) {
            warning =
              "This address doesn't seem valid. Please verify the address details.";
          } else {
            warning =
              'Unable to calculate location coordinates for this address.';
          }
        }
      } catch (error: any) {
        this.logger.error(`Geocoding error: ${error.message}`);
        if (user.user_type_id === 'agent' || user.user_type_id === 'business') {
          warning =
            "This address doesn't seem valid. Please verify the address details.";
        } else {
          warning =
            'Unable to calculate location coordinates for this address.';
        }
      }

      // Ensure only one primary address if this is being set as primary
      if (addressData.is_primary) {
        await this.ensureSinglePrimaryAddress(user.id, user.user_type_id);
      }

      // Create the address first
      const createAddressMutation = `
        mutation CreateAddress(
          $addressLine1: String!,
          $addressLine2: String,
          $city: String!,
          $state: String!,
          $postalCode: String,
          $country: String!,
          $isPrimary: Boolean!,
          $addressType: String!,
          $latitude: numeric,
          $longitude: numeric
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
          latitude: coordinates?.latitude || addressData.latitude,
          longitude: coordinates?.longitude || addressData.longitude,
        }
      );

      const address = addressResult.insert_addresses_one;

      // Now create the junction table entry based on user type
      let junctionMutation = '';
      let junctionVariables = {};

      if (user.user_type_id === 'client') {
        // Client
        if (!user.client) {
          throw new HttpException(
            {
              success: false,
              error: 'Client record not found for user',
            },
            HttpStatus.BAD_REQUEST
          );
        }
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
          clientId: user.client.id,
          addressId: address.id,
        };
      } else if (user.user_type_id === 'business') {
        // Business
        if (!user.business) {
          throw new HttpException(
            {
              success: false,
              error: 'Business record not found for user',
            },
            HttpStatus.BAD_REQUEST
          );
        }
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
          businessId: user.business.id,
          addressId: address.id,
        };
      } else if (user.user_type_id === 'agent') {
        // Agent
        if (!user.agent) {
          throw new HttpException(
            {
              success: false,
              error: 'Agent record not found for user',
            },
            HttpStatus.BAD_REQUEST
          );
        }
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
          agentId: user.agent.id,
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
      const currency = await this.getCurrencyFromCountry(addressData.country);
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
        warning: warning || undefined,
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

  /**
   * Get a single address by ID with user validation
   */
  async getAddress(addressId: string): Promise<AddressResponse> {
    // Check if address belongs to user
    const address = await this.getAddressesByIds([addressId]);
    if (address.length === 0) {
      throw new HttpException(
        {
          success: false,
          error: 'Address not found',
        },
        HttpStatus.NOT_FOUND
      );
    }

    // Verify address belongs to user
    const userAddresses = await this.getUserAddresses();
    const addressBelongsToUser = userAddresses.some(
      (addr) => addr.id === addressId
    );

    if (!addressBelongsToUser) {
      throw new HttpException(
        {
          success: false,
          error: 'Unauthorized access to address',
        },
        HttpStatus.FORBIDDEN
      );
    }

    return address[0];
  }

  /**
   * Get all addresses for the current user
   */
  async getUserAddresses(): Promise<AddressResponse[]> {
    const user = await this.hasuraUserService.getUser();
    return user.addresses || [];
  }

  /**
   * Update an address
   */
  async updateAddress(
    addressId: string,
    addressData: UpdateAddressDto
  ): Promise<{
    success: boolean;
    address: AddressResponse;
    warning?: string;
  }> {
    try {
      const identifier = this.hasuraUserService.getIdentifier();
      const user = await this.getUserInfo(identifier);

      // Get existing address
      const existingAddress = await this.getAddress(addressId);

      // Check if address fields changed (for geocoding)
      const addressFieldsChanged =
        addressData.address_line_1 !== undefined &&
        addressData.address_line_1 !== existingAddress.address_line_1
          ? true
          : addressData.address_line_2 !== undefined &&
            addressData.address_line_2 !== existingAddress.address_line_2
          ? true
          : addressData.city !== undefined &&
            addressData.city !== existingAddress.city
          ? true
          : addressData.state !== undefined &&
            addressData.state !== existingAddress.state
          ? true
          : addressData.postal_code !== undefined &&
            addressData.postal_code !== existingAddress.postal_code
          ? true
          : addressData.country !== undefined &&
            addressData.country !== existingAddress.country
          ? true
          : false;

      // Geocode if address fields changed
      let coordinates: { latitude: number; longitude: number } | null = null;
      let warning = '';

      if (addressFieldsChanged) {
        try {
          const addressForGeocoding = {
            address_line_1:
              addressData.address_line_1 ?? existingAddress.address_line_1,
            address_line_2:
              addressData.address_line_2 ??
              existingAddress.address_line_2 ??
              undefined,
            city: addressData.city ?? existingAddress.city,
            state: addressData.state ?? existingAddress.state,
            postal_code: addressData.postal_code ?? existingAddress.postal_code,
            country: addressData.country ?? existingAddress.country,
          };

          coordinates = await this.geocodeAddress(addressForGeocoding);
          if (!coordinates) {
            if (
              user.user_type_id === 'agent' ||
              user.user_type_id === 'business'
            ) {
              warning =
                "This address doesn't seem valid. Please verify the address details.";
            } else {
              warning =
                'Unable to calculate location coordinates for this address.';
            }
          }
        } catch (error: any) {
          this.logger.error(`Geocoding error: ${error.message}`);
          if (
            user.user_type_id === 'agent' ||
            user.user_type_id === 'business'
          ) {
            warning =
              "This address doesn't seem valid. Please verify the address details.";
          } else {
            warning =
              'Unable to calculate location coordinates for this address.';
          }
        }
      }

      // Ensure only one primary address if this is being set as primary
      if (addressData.is_primary === true) {
        await this.ensureSinglePrimaryAddress(
          user.id,
          user.user_type_id,
          addressId
        );
      }

      // Build update object
      const updateData: any = {};
      if (addressData.address_line_1 !== undefined) {
        updateData.address_line_1 = addressData.address_line_1;
      }
      if (addressData.address_line_2 !== undefined) {
        updateData.address_line_2 = addressData.address_line_2;
      }
      if (addressData.city !== undefined) {
        updateData.city = addressData.city;
      }
      if (addressData.state !== undefined) {
        updateData.state = addressData.state;
      }
      if (addressData.postal_code !== undefined) {
        updateData.postal_code = addressData.postal_code;
      }
      if (addressData.country !== undefined) {
        updateData.country = addressData.country;
      }
      if (addressData.is_primary !== undefined) {
        updateData.is_primary = addressData.is_primary;
      }
      if (addressData.address_type !== undefined) {
        updateData.address_type = addressData.address_type;
      }
      if (coordinates) {
        updateData.latitude = coordinates.latitude;
        updateData.longitude = coordinates.longitude;
      } else if (addressData.latitude !== undefined) {
        updateData.latitude = addressData.latitude;
      }
      if (addressData.longitude !== undefined && !coordinates) {
        updateData.longitude = addressData.longitude;
      }

      // Update address
      const updateMutation = `
        mutation UpdateAddress(
          $addressId: uuid!,
          $addressLine1: String,
          $addressLine2: String,
          $city: String,
          $state: String,
          $postalCode: String,
          $country: String,
          $isPrimary: Boolean,
          $addressType: String,
          $latitude: numeric,
          $longitude: numeric
        ) {
          update_addresses_by_pk(
            pk_columns: { id: $addressId },
            _set: {
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
            }
          ) {
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

      const result = await this.hasuraSystemService.executeMutation(
        updateMutation,
        {
          addressId,
          addressLine1: updateData.address_line_1,
          addressLine2: updateData.address_line_2,
          city: updateData.city,
          state: updateData.state,
          postalCode: updateData.postal_code,
          country: updateData.country,
          isPrimary: updateData.is_primary,
          addressType: updateData.address_type,
          latitude: updateData.latitude,
          longitude: updateData.longitude,
        }
      );

      return {
        success: true,
        address: result.update_addresses_by_pk,
        warning: warning || undefined,
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

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Verify address belongs to user
      await this.getAddress(addressId);

      const deleteMutation = `
        mutation DeleteAddress($addressId: uuid!) {
          delete_addresses_by_pk(id: $addressId) {
            id
          }
        }
      `;

      await this.hasuraSystemService.executeMutation(deleteMutation, {
        addressId,
      });

      return {
        success: true,
        message: 'Address deleted successfully',
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

  /**
   * Fetch multiple addresses by their IDs
   */
  async getAddressesByIds(addressIds: string[]): Promise<AddressResponse[]> {
    if (!addressIds || addressIds.length === 0) return [];
    const query = `
      query GetAddressesByIds($ids: [uuid!]!) {
        addresses(where: {id: {_in: $ids}}) {
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
    const result = await this.hasuraSystemService.executeQuery(query, {
      ids: addressIds,
    });
    return result.addresses || [];
  }

  /**
   * Fetch the current user's primary address (returns null if not found)
   */
  async getCurrentUserPrimaryAddress(): Promise<AddressResponse | null> {
    const user = await this.hasuraUserService.getUser();
    console.log(user);
    return (
      user.addresses?.find((address) => address.is_primary) ||
      user.addresses?.[0] ||
      null
    );
  }

  /**
   * Get business location address
   */
  async getBusinessLocationAddress(
    locationId: string
  ): Promise<AddressResponse> {
    const identifier = this.hasuraUserService.getIdentifier();
    const user = await this.getUserInfo(identifier);

    // Verify business location exists and belongs to user's business
    const locationQuery = `
      query GetBusinessLocation($locationId: uuid!, $userId: uuid!) {
        business_locations(
          where: {
            id: {_eq: $locationId},
            business: {user_id: {_eq: $userId}}
          }
        ) {
          id
          address_id
          business_id
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

    const locationResult = await this.hasuraUserService.executeQuery(
      locationQuery,
      { locationId, userId: user.id }
    );

    if (
      !locationResult.business_locations ||
      locationResult.business_locations.length === 0
    ) {
      throw new HttpException(
        {
          success: false,
          error: 'Business location not found or access denied',
        },
        HttpStatus.NOT_FOUND
      );
    }

    return locationResult.business_locations[0].address;
  }

  /**
   * Create or update business location address
   */
  async createBusinessLocationAddress(
    locationId: string,
    addressData: CreateAddressDto
  ): Promise<{
    success: boolean;
    address: AddressResponse;
    warning?: string;
  }> {
    const identifier = this.hasuraUserService.getIdentifier();
    const user = await this.getUserInfo(identifier);

    // Verify business location exists and belongs to user's business
    const locationQuery = `
      query GetBusinessLocation($locationId: uuid!, $userId: uuid!) {
        business_locations(
          where: {
            id: {_eq: $locationId},
            business: {user_id: {_eq: $userId}}
          }
        ) {
          id
          address_id
          business_id
        }
      }
    `;

    const locationResult = await this.hasuraUserService.executeQuery(
      locationQuery,
      { locationId, userId: user.id }
    );

    if (
      !locationResult.business_locations ||
      locationResult.business_locations.length === 0
    ) {
      throw new HttpException(
        {
          success: false,
          error: 'Business location not found or access denied',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const location = locationResult.business_locations[0];

    // If address already exists, update it; otherwise create new
    if (location.address_id) {
      return this.updateBusinessLocationAddress(locationId, {
        ...addressData,
      } as UpdateAddressDto);
    }

    // Geocode the address
    let coordinates: { latitude: number; longitude: number } | null = null;
    let warning = '';

    try {
      coordinates = await this.geocodeAddress(addressData);
      if (!coordinates) {
        warning =
          "This address doesn't seem valid. Please verify the address details.";
      }
    } catch (error: any) {
      this.logger.error(`Geocoding error: ${error.message}`);
      warning =
        "This address doesn't seem valid. Please verify the address details.";
    }

    // Create address
    const createAddressMutation = `
      mutation CreateAddress(
        $addressLine1: String!,
        $addressLine2: String,
        $city: String!,
        $state: String!,
        $postalCode: String,
        $country: String!,
        $addressType: String!,
        $latitude: numeric,
        $longitude: numeric
      ) {
        insert_addresses_one(object: {
          address_line_1: $addressLine1,
          address_line_2: $addressLine2,
          city: $city,
          state: $state,
          postal_code: $postalCode,
          country: $country,
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
        addressType: addressData.address_type || 'store',
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
      }
    );

    const address = addressResult.insert_addresses_one;

    // Update business location with new address_id
    const updateLocationMutation = `
      mutation UpdateBusinessLocation($locationId: uuid!, $addressId: uuid!) {
        update_business_locations_by_pk(
          pk_columns: { id: $locationId },
          _set: { address_id: $addressId }
        ) {
          id
          address_id
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(updateLocationMutation, {
      locationId,
      addressId: address.id,
    });

    return {
      success: true,
      address,
      warning: warning || undefined,
    };
  }

  /**
   * Update business location address
   */
  async updateBusinessLocationAddress(
    locationId: string,
    addressData: UpdateAddressDto
  ): Promise<{
    success: boolean;
    address: AddressResponse;
    warning?: string;
  }> {
    const identifier = this.hasuraUserService.getIdentifier();
    const user = await this.getUserInfo(identifier);

    // Get business location and verify ownership
    const location = await this.getBusinessLocationAddress(locationId);
    const locationQuery = `
      query GetBusinessLocation($locationId: uuid!, $userId: uuid!) {
        business_locations(
          where: {
            id: {_eq: $locationId},
            business: {user_id: {_eq: $userId}}
          }
        ) {
          id
          address_id
        }
      }
    `;

    const locationResult = await this.hasuraUserService.executeQuery(
      locationQuery,
      { locationId, userId: user.id }
    );

    if (
      !locationResult.business_locations ||
      locationResult.business_locations.length === 0
    ) {
      throw new HttpException(
        {
          success: false,
          error: 'Business location not found or access denied',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const businessLocation = locationResult.business_locations[0];
    const addressId = businessLocation.address_id || location.id;

    // Check if address fields changed
    const addressFieldsChanged =
      addressData.address_line_1 !== undefined &&
      addressData.address_line_1 !== location.address_line_1
        ? true
        : addressData.address_line_2 !== undefined &&
          addressData.address_line_2 !== location.address_line_2
        ? true
        : addressData.city !== undefined && addressData.city !== location.city
        ? true
        : addressData.state !== undefined &&
          addressData.state !== location.state
        ? true
        : addressData.postal_code !== undefined &&
          addressData.postal_code !== location.postal_code
        ? true
        : addressData.country !== undefined &&
          addressData.country !== location.country
        ? true
        : false;

    // Geocode if address fields changed
    let coordinates: { latitude: number; longitude: number } | null = null;
    let warning = '';

    if (addressFieldsChanged) {
      try {
        const addressForGeocoding = {
          address_line_1: addressData.address_line_1 ?? location.address_line_1,
          address_line_2:
            addressData.address_line_2 ?? location.address_line_2 ?? undefined,
          city: addressData.city ?? location.city,
          state: addressData.state ?? location.state,
          postal_code: addressData.postal_code ?? location.postal_code,
          country: addressData.country ?? location.country,
        };

        coordinates = await this.geocodeAddress(addressForGeocoding);
        if (!coordinates) {
          warning =
            "This address doesn't seem valid. Please verify the address details.";
        }
      } catch (error: any) {
        this.logger.error(`Geocoding error: ${error.message}`);
        warning =
          "This address doesn't seem valid. Please verify the address details.";
      }
    }

    // Build update object
    const updateData: any = {};
    if (addressData.address_line_1 !== undefined) {
      updateData.address_line_1 = addressData.address_line_1;
    }
    if (addressData.address_line_2 !== undefined) {
      updateData.address_line_2 = addressData.address_line_2;
    }
    if (addressData.city !== undefined) {
      updateData.city = addressData.city;
    }
    if (addressData.state !== undefined) {
      updateData.state = addressData.state;
    }
    if (addressData.postal_code !== undefined) {
      updateData.postal_code = addressData.postal_code;
    }
    if (addressData.country !== undefined) {
      updateData.country = addressData.country;
    }
    if (addressData.address_type !== undefined) {
      updateData.address_type = addressData.address_type;
    }
    if (coordinates) {
      updateData.latitude = coordinates.latitude;
      updateData.longitude = coordinates.longitude;
    } else if (addressData.latitude !== undefined) {
      updateData.latitude = addressData.latitude;
    }
    if (addressData.longitude !== undefined && !coordinates) {
      updateData.longitude = addressData.longitude;
    }

    // Update address
    const updateMutation = `
      mutation UpdateAddress(
        $addressId: uuid!,
        $addressLine1: String,
        $addressLine2: String,
        $city: String,
        $state: String,
        $postalCode: String,
        $country: String,
        $addressType: String,
        $latitude: numeric,
        $longitude: numeric
      ) {
        update_addresses_by_pk(
          pk_columns: { id: $addressId },
          _set: {
            address_line_1: $addressLine1,
            address_line_2: $addressLine2,
            city: $city,
            state: $state,
            postal_code: $postalCode,
            country: $country,
            address_type: $addressType,
            latitude: $latitude,
            longitude: $longitude
          }
        ) {
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

    const result = await this.hasuraSystemService.executeMutation(
      updateMutation,
      {
        addressId,
        addressLine1: updateData.address_line_1,
        addressLine2: updateData.address_line_2,
        city: updateData.city,
        state: updateData.state,
        postalCode: updateData.postal_code,
        country: updateData.country,
        addressType: updateData.address_type,
        latitude: updateData.latitude,
        longitude: updateData.longitude,
      }
    );

    return {
      success: true,
      address: result.update_addresses_by_pk,
      warning: warning || undefined,
    };
  }

  /**
   * Delete business location address
   */
  async deleteBusinessLocationAddress(locationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const identifier = this.hasuraUserService.getIdentifier();
    const user = await this.getUserInfo(identifier);

    // Get business location and verify ownership
    const locationQuery = `
      query GetBusinessLocation($locationId: uuid!, $userId: uuid!) {
        business_locations(
          where: {
            id: {_eq: $locationId},
            business: {user_id: {_eq: $userId}}
          }
        ) {
          id
          address_id
        }
      }
    `;

    const locationResult = await this.hasuraUserService.executeQuery(
      locationQuery,
      { locationId, userId: user.id }
    );

    if (
      !locationResult.business_locations ||
      locationResult.business_locations.length === 0
    ) {
      throw new HttpException(
        {
          success: false,
          error: 'Business location not found or access denied',
        },
        HttpStatus.NOT_FOUND
      );
    }

    const businessLocation = locationResult.business_locations[0];

    if (!businessLocation.address_id) {
      throw new HttpException(
        {
          success: false,
          error: 'No address found for this business location',
        },
        HttpStatus.NOT_FOUND
      );
    }

    // Delete address
    const deleteMutation = `
      mutation DeleteAddress($addressId: uuid!) {
        delete_addresses_by_pk(id: $addressId) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(deleteMutation, {
      addressId: businessLocation.address_id,
    });

    // Update business location to remove address_id
    const updateLocationMutation = `
      mutation UpdateBusinessLocation($locationId: uuid!) {
        update_business_locations_by_pk(
          pk_columns: { id: $locationId },
          _set: { address_id: null }
        ) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(updateLocationMutation, {
      locationId,
    });

    return {
      success: true,
      message: 'Business location address deleted successfully',
    };
  }
}
