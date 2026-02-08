import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type { TransactionRequest } from './accounts.service';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@Controller('accounts')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get active accounts for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Accounts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            accounts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
                  currency: { type: 'string' },
                  available_balance: { type: 'number' },
                  withheld_balance: { type: 'number' },
                  total_balance: { type: 'number' },
                  is_active: { type: 'boolean' },
                  created_at: { type: 'string' },
                  updated_at: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAccounts() {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user?.id) {
        throw new HttpException(
          { success: false, error: 'User not found' },
          HttpStatus.UNAUTHORIZED
        );
      }

      const query = `
        query GetAccounts($userId: uuid!) {
          accounts(
            where: { user_id: { _eq: $userId }, is_active: { _eq: true } }
            order_by: { created_at: desc }
          ) {
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

      const result = await this.hasuraSystemService.executeQuery(query, {
        userId: user.id,
      });

      const accounts = result.accounts || [];

      return {
        success: true,
        message: 'Accounts retrieved successfully',
        data: { accounts },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch accounts',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

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

      const userResult = await this.hasuraUserService.executeQuery(
        getUserQuery,
        {
          identifier,
        }
      );

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
          userId: user.id,
          currency: accountData.currency,
        }
      );

      if (
        existingAccountResult.accounts &&
        existingAccountResult.accounts.length > 0
      ) {
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

  @Post('transaction')
  async registerTransaction(@Body() transactionData: TransactionRequest) {
    try {
      const result = await this.accountsService.registerTransaction(
        transactionData
      );

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            error: result.error,
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return {
        success: true,
        transactionId: result.transactionId,
        newBalance: result.newBalance,
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
