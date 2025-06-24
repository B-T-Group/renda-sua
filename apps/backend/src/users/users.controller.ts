import { Controller, Post, Body, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Controller('users')
export class UsersController {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  @Get('me')
  async getCurrentUser() {
    try {
      const identifier = this.hasuraUserService.getIdentifier();
      
      const query = `
        query GetUserByIdentifier($identifier: String!) {
          users(where: {identifier: {_eq: $identifier}}) {
            id
            identifier
            email
            first_name
            last_name
            user_type_id
            created_at
            updated_at
          }
        }
      `;

      const result = await this.hasuraUserService.executeQuery(query, {
        identifier: identifier,
      });

      if (!result.users || result.users.length === 0) {
        throw new HttpException(
          {
            success: false,
            error: 'User not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      const user = result.users[0];

      return {
        success: true,
        user,
        identifier: identifier,
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

  @Post()
  async createUser(@Body() userData: { 
    email: string; 
    first_name: string;
    last_name: string;
    user_type_id: string;
    vehicle_type_id?: string; // Required for agents
    business_name?: string; // Required for businesses
  }) {
    try {
      let result: any;

      switch (userData.user_type_id) {
        case 'client':
          result = await this.hasuraUserService.createUserWithClient({
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            user_type_id: userData.user_type_id,
          });
          return {
            success: true,
            user: result.user,
            client: result.client,
            identifier: this.hasuraUserService.getIdentifier(),
          };

        case 'agent':
          if (!userData.vehicle_type_id) {
            throw new Error('vehicle_type_id is required for agent users');
          }
          result = await this.hasuraUserService.createUserWithAgent(
            {
              email: userData.email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              user_type_id: userData.user_type_id,
            },
            {
              vehicle_type_id: userData.vehicle_type_id,
            }
          );
          return {
            success: true,
            user: result.user,
            agent: result.agent,
            identifier: this.hasuraUserService.getIdentifier(),
          };

        case 'business':
          if (!userData.business_name) {
            throw new Error('business_name is required for business users');
          }
          result = await this.hasuraUserService.createUserWithBusiness(
            {
              email: userData.email,
              first_name: userData.first_name,
              last_name: userData.last_name,
              user_type_id: userData.user_type_id,
            },
            {
              name: userData.business_name,
            }
          );
          return {
            success: true,
            user: result.user,
            business: result.business,
            identifier: this.hasuraUserService.getIdentifier(),
          };

        default:
          // For any other user type, just create the user without related records
          const user = await this.hasuraUserService.createUser({
            email: userData.email,
            first_name: userData.first_name,
            last_name: userData.last_name,
            user_type_id: userData.user_type_id,
          });
          return {
            success: true,
            user,
            identifier: this.hasuraUserService.getIdentifier(),
          };
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