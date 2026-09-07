import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from './public.decorator';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { Configuration } from '../config/configuration';

interface ResolveUserIdRequest {
  email?: string;
  phone_number?: string;
}

interface ResolveUserIdResponse {
  user_id: string | null;
  found: boolean;
}

@ApiTags('auth0-actions')
@Controller('auth0-actions')
export class Auth0ActionsController {
  private readonly logger = new Logger(Auth0ActionsController.name);
  private readonly requiredSecret: string;

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configService: ConfigService<Configuration>
  ) {
    this.requiredSecret =
      this.configService.get('AUTH0_ACTIONS_SHARED_SECRET') || '';
    if (!this.requiredSecret) {
      this.logger.warn(
        'AUTH0_ACTIONS_SHARED_SECRET not configured - auth0-actions endpoints will reject all requests'
      );
    }
  }

  private verifySharedSecret(providedSecret: string | undefined): void {
    if (!this.requiredSecret) {
      throw new UnauthorizedException(
        'Auth0 Actions endpoints are not configured'
      );
    }
    if (!providedSecret || providedSecret !== this.requiredSecret) {
      throw new UnauthorizedException('Invalid or missing action secret');
    }
  }

  @Public()
  @Post('resolve-user-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve user UUID by email or phone for Auth0 Actions',
    description:
      'Protected endpoint for Auth0 Actions to look up the database user UUID ' +
      'by email or phone number. Returns null if user not found (e.g., during signup). ' +
      'Used during JWT claim customization to set x-hasura-user-id. ' +
      'Requires X-Auth0-Action-Secret header matching AUTH0_ACTIONS_SHARED_SECRET.',
  })
  @ApiHeader({
    name: 'X-Auth0-Action-Secret',
    description: 'Shared secret for Auth0 Action authentication',
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        phone_number: { type: 'string' },
      },
      description: 'Provide either email or phone_number (not both)',
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User lookup result',
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', format: 'uuid', nullable: true },
        found: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing action secret',
  })
  async resolveUserId(
    @Headers('x-auth0-action-secret') actionSecret: string | undefined,
    @Body() body: ResolveUserIdRequest
  ): Promise<ResolveUserIdResponse> {
    this.verifySharedSecret(actionSecret);

    const email = body.email?.trim().toLowerCase();
    const phoneNumber = body.phone_number?.trim();

    if (!email && !phoneNumber) {
      this.logger.warn('Auth0 Action resolve-user-id: no email or phone provided');
      return { user_id: null, found: false };
    }

    if (email && phoneNumber) {
      this.logger.warn(
        'Auth0 Action resolve-user-id: both email and phone provided, using email'
      );
    }

    try {
      if (email) {
        const user = await this.getUserByEmail(email);
        if (user) {
          this.logger.debug(
            `Auth0 Action resolved user ${user.id} by email`
          );
          return { user_id: user.id, found: true };
        }
      } else if (phoneNumber) {
        const user = await this.getUserByPhone(phoneNumber);
        if (user) {
          this.logger.debug(
            `Auth0 Action resolved user ${user.id} by phone`
          );
          return { user_id: user.id, found: true };
        }
      }

      this.logger.debug(
        `Auth0 Action: user not found (likely new signup)`
      );
      return { user_id: null, found: false };
    } catch (error: any) {
      this.logger.error(
        `Auth0 Action resolve-user-id failed: ${error?.message || error}`,
        error?.stack
      );
      return { user_id: null, found: false };
    }
  }

  private async getUserByEmail(email: string): Promise<{ id: string } | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(
      `
      query ResolveUserIdByEmail($email: String!) {
        users(where: { email: { _eq: $email } }, limit: 1) {
          id
        }
      }
    `,
      { email }
    );
    return result.users?.[0] || null;
  }

  private async getUserByPhone(
    phoneNumber: string
  ): Promise<{ id: string } | null> {
    const result = await this.hasuraSystemService.executeQuery<{
      users: Array<{ id: string }>;
    }>(
      `
      query ResolveUserIdByPhone($phone: String!) {
        users(where: { phone_number: { _eq: $phone } }, limit: 1) {
          id
        }
      }
    `,
      { phone: phoneNumber }
    );
    return result.users?.[0] || null;
  }
}
