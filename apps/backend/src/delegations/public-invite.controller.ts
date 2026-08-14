import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/user.decorator';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { LocationDelegationsFlagService } from './location-delegations-flag.service';
import { PublicInviteService } from './public-invite.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@ApiTags('invite')
@Controller('invite')
export class PublicInviteController {
  constructor(
    private readonly flag: LocationDelegationsFlagService,
    private readonly service: PublicInviteService,
    private readonly hasura: HasuraSystemService
  ) {}

  @Public()
  @Get(':token')
  @ApiOperation({ summary: 'Preview a location-delegation invite (does not consume)' })
  @ApiParam({ name: 'token' })
  @ApiResponse({ status: 200, description: 'Invite preview' })
  async preview(@Param('token') token: string) {
    await this.requireFlag();
    return { success: true, ...(await this.service.preview(token)) };
  }

  @Public()
  @Post(':token/accept')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Accept a location-delegation invite' })
  @ApiParam({ name: 'token' })
  @ApiResponse({ status: 200, description: 'Invite accepted; OTP started unless already signed in' })
  async accept(
    @Param('token') token: string,
    @Body() body: AcceptInviteDto,
    @CurrentUser() auth0User?: { email?: string; sub?: string }
  ) {
    await this.requireFlag();
    const loggedIn = await this.resolveLoggedIn(auth0User);
    return this.service.accept(token, body, loggedIn);
  }

  private async requireFlag() {
    if (!(await this.flag.isEnabled())) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
  }

  private async resolveLoggedIn(auth0User?: { email?: string; sub?: string }) {
    const email = auth0User?.email?.trim().toLowerCase();
    if (!email) return undefined;
    const result = await this.hasura.executeQuery<{
      users: Array<{ id: string; email: string }>;
    }>(
      `
      query LoggedInByEmail($email: String!) {
        users(where: { email: { _eq: $email } }, limit: 1) { id email }
      }
    `,
      { email }
    );
    const user = result.users?.[0];
    return user ? { userId: user.id, email: user.email } : undefined;
  }
}
