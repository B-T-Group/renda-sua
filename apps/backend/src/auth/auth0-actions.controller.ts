import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from './public.decorator';
import { HasuraSystemService } from '../hasura/hasura-system.service';

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

  constructor(
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  @Public()
  @Post('resolve-user-id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve user UUID by email or phone for Auth0 Actions',
    description:
      'Public endpoint for Auth0 Actions to look up the database user UUID ' +
      'by email or phone number. Returns null if user not found. ' +
      'Used during JWT claim customization to set x-hasura-user-id.',
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
  async resolveUserId(
    @Body() body: ResolveUserIdRequest
  ): Promise<ResolveUserIdResponse> {
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
          this.logger.log(
            `Auth0 Action resolved user ${user.id} by email ${email}`
          );
          return { user_id: user.id, found: true };
        }
      } else if (phoneNumber) {
        const user = await this.getUserByPhone(phoneNumber);
        if (user) {
          this.logger.log(
            `Auth0 Action resolved user ${user.id} by phone ${phoneNumber}`
          );
          return { user_id: user.id, found: true };
        }
      }

      this.logger.debug(
        `Auth0 Action: user not found for ${email || phoneNumber} (likely new signup)`
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
