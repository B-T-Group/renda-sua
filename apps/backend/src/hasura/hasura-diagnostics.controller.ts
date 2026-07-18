import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from './hasura-user.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

@ApiTags('diagnostics')
@Controller('diagnostics/hasura')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class HasuraDiagnosticsController {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  @Get('jwt-claims')
  @ApiOperation({
    summary: 'Debug JWT Hasura claims',
    description:
      'Returns the decoded Hasura claims from the current user JWT token. Useful for debugging role and permission issues.',
  })
  async getJwtClaims(@ReqContext() ctx: RequestContext) {
    try {
      const userId = this.hasuraUserService.getUserId(ctx);
      const authSub = this.hasuraUserService.getAuthSubject();

      // Query to get user's personas
      const query = `
        query GetUserPersonas($userId: uuid!) {
          users_by_pk(id: $userId) {
            id
            email
            first_name
            last_name
            client {
              id
            }
            agent {
              id
            }
            business {
              id
              name
              is_verified
            }
          }
        }
      `;

      const result = await this.hasuraUserService.executeQuery<{
        users_by_pk: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          client: { id: string } | null;
          agent: { id: string } | null;
          business: { id: string; name: string; is_verified: boolean } | null;
        } | null;
      }>(query, { userId });

      const user = result.users_by_pk;

      const availablePersonas = [];
      if (user?.client) availablePersonas.push('client');
      if (user?.agent) availablePersonas.push('agent');
      if (user?.business) availablePersonas.push('business');

      return {
        success: true,
        data: {
          hasura_user_id: userId,
          auth0_sub: authSub,
          user: user
            ? {
                id: user.id,
                email: user.email,
                name: `${user.first_name} ${user.last_name}`,
              }
            : null,
          available_personas: availablePersonas,
          personas: {
            has_client: !!user?.client,
            has_agent: !!user?.agent,
            has_business: !!user?.business,
            business_details: user?.business
              ? {
                  id: user.business.id,
                  name: user.business.name,
                  is_verified: user.business.is_verified,
                }
              : null,
          },
          note: 'Check if your JWT x-hasura-allowed-roles matches the available_personas array. If business operations are failing, ensure has_business is true.',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get JWT claims',
        note: 'This usually means the JWT token is invalid or missing required Hasura claims',
      };
    }
  }
}
