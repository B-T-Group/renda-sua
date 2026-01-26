import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Auth0Service } from '../auth/auth0.service';
import { CurrentUser } from '../auth/user.decorator';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly auth0Service: Auth0Service
  ) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() auth0User: any) {
    try {
      const user = await this.hasuraUserService.getUser();

      const identifier = this.hasuraUserService.getIdentifier();

      return {
        success: true,
        user,
        identifier,
        auth0User: {
          sub: auth0User.sub,
          email: auth0User.email,
          email_verified: auth0User.email_verified,
        },
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
        HttpStatus.NOT_FOUND
      );
    }
  }

  @Get('pending_orders')
  async getPendingOrders() {
    try {
      const query = `
        query GetPendingOrders {
          orders(where: { current_status: { _eq: "pending" } }) {
            id
            order_number
            client_id
            business_id
            business_location_id
            assigned_agent_id
            delivery_address_id
            subtotal
            delivery_fee
            tax_amount
            total_amount
            currency
            current_status
            estimated_delivery_time
            actual_delivery_time
            special_instructions
            preferred_delivery_time
            payment_method
            payment_status
            created_at
            updated_at
            client {
              id
              user {
                id
                first_name
                last_name
                email
              }
            }
            business {
              id
              name
              user {
                id
                first_name
                last_name
              }
            }
            business_location {
              id
              name
              location_type
              address {
                id
                address_line_1
                address_line_2
                city
                state
                postal_code
                country
              }
            }
            delivery_address {
              id
              address_line_1
              address_line_2
              city
              state
              postal_code
              country
            }
            order_items {
              id
              item_name
              item_description
              unit_price
              quantity
              total_price
              special_instructions
            }
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query);

      return {
        success: true,
        orders: result.orders,
        count: result.orders.length,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch pending orders',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('profile')
  async createUserProfile(
    @Body()
    profileData: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      userType: string;
      businessName?: string;
      address?: string;
      vehicleTypeId?: string;
    }
  ) {
    try {
      const identifier = this.hasuraUserService.getIdentifier();

      // Map frontend user types to backend user type IDs (these should match the enum values)
      const userTypeMap: { [key: string]: string } = {
        client: 'client',
        agent: 'agent',
        business: 'business',
      };

      const userTypeId = userTypeMap[profileData.userType];
      if (!userTypeId) {
        throw new Error('Invalid user type');
      }

      let result: any;

      switch (userTypeId) {
        case 'client':
          result = await this.hasuraUserService.createUserWithClient({
            email: profileData.email,
            first_name: profileData.firstName,
            last_name: profileData.lastName,
            phone_number: profileData.phone,
            user_type_id: userTypeId,
          });
          return {
            success: true,
            user: result.user,
            client: result.client,
            identifier: identifier,
          };

        case 'agent':
          result = await this.hasuraUserService.createUserWithAgent(
            {
              email: profileData.email,
              first_name: profileData.firstName,
              last_name: profileData.lastName,
              phone_number: profileData.phone,
              user_type_id: userTypeId,
            },
            {
              vehicle_type_id: profileData.vehicleTypeId || 'other',
            }
          );
          return {
            success: true,
            user: result.user,
            agent: result.agent,
            identifier: identifier,
          };

        case 'business':
          if (!profileData.businessName) {
            throw new Error('Business name is required for business users');
          }
          result = await this.hasuraUserService.createUserWithBusiness(
            {
              email: profileData.email,
              first_name: profileData.firstName,
              last_name: profileData.lastName,
              phone_number: profileData.phone,
              user_type_id: userTypeId,
            },
            {
              name: profileData.businessName,
            }
          );
          return {
            success: true,
            user: result.user,
            business: result.business,
            identifier: identifier,
          };

        default:
          throw new Error('Invalid user type');
      }
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post('resend_verification')
  @HttpCode(202)
  async resendVerification(@CurrentUser() auth0User: any) {
    try {
      const userId = auth0User?.sub;
      if (!userId) {
        throw new Error('Invalid current user');
      }
      await this.auth0Service.resendVerificationEmail(userId);
      return { success: true };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to resend verification email',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  async createUser(
    @Body()
    userData: {
      first_name: string;
      last_name: string;
      email: string;
      phone_number?: string;
      user_type_id: string;
      profile: {
        vehicle_type_id?: string;
        name?: string;
      };
    }
  ) {
    try {
      const identifier = this.hasuraUserService.getIdentifier();

      let result: any;

      switch (userData.user_type_id) {
        case 'client':
          result = await this.hasuraUserService.createUserWithClient({
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone_number: userData.phone_number,
            user_type_id: userData.user_type_id,
          });
          return {
            success: true,
            user: result.user,
            client: result.client,
            identifier: identifier,
          };

        case 'agent':
          if (!userData.profile.vehicle_type_id) {
            throw new Error('vehicle_type_id is required for agent users');
          }
          result = await this.hasuraUserService.createUserWithAgent(
            {
              email: userData.email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              phone_number: userData.phone_number,
              user_type_id: userData.user_type_id,
            },
            {
              vehicle_type_id: userData.profile.vehicle_type_id,
            }
          );
          return {
            success: true,
            user: result.user,
            agent: result.agent,
            identifier: identifier,
          };

        case 'business':
          if (!userData.profile.name) {
            throw new Error('business name is required for business users');
          }
          result = await this.hasuraUserService.createUserWithBusiness(
            {
              email: userData.email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              phone_number: userData.phone_number,
              user_type_id: userData.user_type_id,
            },
            {
              name: userData.profile.name,
            }
          );
          return {
            success: true,
            user: result.user,
            business: result.business,
            identifier: identifier,
          };

        default: {
          // For any other user type, just create the user without related records
          const user = await this.hasuraUserService.createUser({
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone_number: userData.phone_number,
            user_type_id: userData.user_type_id,
          });
          return {
            success: true,
            user,
            identifier: identifier,
          };
        }
      }
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
