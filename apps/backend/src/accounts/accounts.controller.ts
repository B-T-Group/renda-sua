import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  @Post()
  async createAccount(@Body() accountData: { currency: string }) {
    try {
      const identifier = this.hasuraUserService.getIdentifier();
      
      // First, get the current user to check their user_type_id
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

      const user = userResult.users[0];

      // Check if user already has an account with this currency
      const checkExistingAccountQuery = `
        query CheckExistingAccount($userId: uuid!, $currency: String!) {
          accounts(where: {user_id: {_eq: $userId}, currency: {_eq: $currency}}) {
            id
            currency
          }
        }
      `;

      const existingAccountResult = await this.hasuraUserService.executeQuery(
        checkExistingAccountQuery,
        {
          userId: user.id,
          currency: accountData.currency,
        }
      );

      if (existingAccountResult.accounts && existingAccountResult.accounts.length > 0) {
        throw new HttpException(
          {
            success: false,
            error: `User already has an account with currency ${accountData.currency}`,
          },
          HttpStatus.CONFLICT
        );
      }

      // Create the new account
      const createAccountMutation = `
        mutation CreateAccount(
          $userId: uuid!, 
          $currency: String!
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
          userId: user.id,
          currency: accountData.currency,
        }
      );

      return {
        success: true,
        account: result.insert_accounts_one,
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