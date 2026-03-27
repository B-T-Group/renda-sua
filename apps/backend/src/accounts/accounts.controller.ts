import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { GET_ACCOUNT_BY_ID_FOR_USER } from '../hasura/hasura.queries';
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

  @Get('info')
  @ApiOperation({
    summary: 'Get account info (accounts with transactions and clients)',
    description:
      'Returns accounts with account_transactions and client info for the current user. Matches the former frontend GetAccountInfo GraphQL shape.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account info retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
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
                  business_location_id: { type: 'string', nullable: true },
                  business_location: { type: 'object', nullable: true },
                  account_transactions: { type: 'array' },
                },
              },
            },
            clients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  user_id: { type: 'string' },
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
  async getAccountInfo() {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user?.id) {
        throw new HttpException(
          { success: false, error: 'User not found' },
          HttpStatus.UNAUTHORIZED
        );
      }

      const query = `
        query GetAccountInfo($userId: uuid!) {
          accounts(
            where: { user_id: { _eq: $userId } }
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
            business_location_id
            business_location {
              id
              name
              phone
            }
            account_transactions {
              id
              account_id
              transaction_type
              amount
              memo
              created_at
            }
          }
          clients(where: { user_id: { _eq: $userId } }) {
            id
            user_id
            created_at
            updated_at
          }
        }
      `;

      const result = await this.hasuraSystemService.executeQuery(query, {
        userId: user.id,
      });

      const accounts = result.accounts || [];
      const clients = result.clients || [];

      return {
        success: true,
        data: { accounts, clients },
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch account info',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':accountId')
  @ApiOperation({
    summary: 'Get a single account by ID for the current user',
    description:
      'Returns account with business_location and account_transactions when the account belongs to the authenticated user.',
  })
  @ApiParam({ name: 'accountId', format: 'uuid', description: 'Account id' })
  @ApiResponse({
    status: 200,
    description: 'Account found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            account: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async getAccountById(@Param('accountId') accountId: string) {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user?.id) {
        throw new HttpException(
          { success: false, error: 'User not found' },
          HttpStatus.UNAUTHORIZED
        );
      }

      const result = await this.hasuraUserService.executeQuery<{
        accounts: unknown[];
      }>(GET_ACCOUNT_BY_ID_FOR_USER, {
        accountId,
        userId: user.id,
      });

      const account = result.accounts?.[0];
      if (!account) {
        throw new HttpException(
          { success: false, error: 'Account not found' },
          HttpStatus.NOT_FOUND
        );
      }

      return { success: true, data: { account } };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to fetch account',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

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
            business_location_id
            business_location {
              id
              name
              phone
            }
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
      const userId = this.hasuraUserService.getUserId();

      // First, get the current user to check their user_type_id
      const getUserQuery = `
        query GetUserByIdForAccount($userId: uuid!) {
          users_by_pk(id: $userId) {
            id
            user_type_id
          }
        }
      `;

      const userResult = await this.hasuraUserService.executeQuery(
        getUserQuery,
        {
          userId,
        }
      );

      if (!userResult.users_by_pk) {
        throw new HttpException(
          {
            success: false,
            error: 'User not found',
          },
          HttpStatus.NOT_FOUND
        );
      }

      const user = userResult.users_by_pk;

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
