import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { isActivePersona } from '../users/persona.util';
import { BusinessDelegationsService } from './business-delegations.service';
import { LocationDelegationsFlagService } from './location-delegations-flag.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { PatchRoleDto } from './dto/patch-role.dto';

@ApiTags('business-delegations')
@Controller('business-delegations')
@ApiBearerAuth()
export class BusinessDelegationsController {
  constructor(
    private readonly flag: LocationDelegationsFlagService,
    private readonly service: BusinessDelegationsService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  @Get('roles')
  @ApiOperation({ summary: 'List assignable location-delegation roles' })
  @ApiResponse({ status: 200, description: 'Assignable roles' })
  async listRoles(@ReqContext() ctx: RequestContext): Promise<{
    success: true;
    roles: Awaited<ReturnType<BusinessDelegationsService['listAssignableRoles']>>;
  }> {
    await this.requireOwner(ctx);
    return { success: true, roles: await this.service.listAssignableRoles() };
  }

  @Get()
  @ApiOperation({ summary: 'List location delegates and pending invites' })
  @ApiResponse({ status: 200, description: 'Team members and invites' })
  async list(@ReqContext() ctx: RequestContext) {
    const owner = await this.requireOwner(ctx);
    return {
      success: true,
      ...(await this.service.listTeam(owner.business.id)),
    };
  }

  @Post('invites')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Invite a location delegate with a role' })
  @ApiResponse({ status: 201, description: 'Invite created' })
  async createInvite(
    @ReqContext() ctx: RequestContext,
    @Body() body: CreateInviteDto
  ) {
    const owner = await this.requireOwner(ctx);
    return {
      success: true,
      ...(await this.service.createInvite(owner, owner.business.id, body)),
    };
  }

  @Post('invites/:id/resend')
  @ApiOperation({ summary: 'Resend a pending invite' })
  @ApiParam({ name: 'id' })
  async resend(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body?: PatchRoleDto
  ) {
    const owner = await this.requireOwner(ctx);
    return {
      success: true,
      ...(await this.service.resendInvite(owner, owner.business.id, id, body?.role_id)),
    };
  }

  @Patch('invites/:id')
  @ApiOperation({ summary: 'Change role on a pending invite' })
  @ApiParam({ name: 'id' })
  async patchInvite(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: PatchRoleDto
  ) {
    const owner = await this.requireOwner(ctx);
    return {
      success: true,
      ...(await this.service.patchInviteRole(
        owner.id,
        owner.business.id,
        id,
        body.role_id
      )),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change role on an active location delegate' })
  @ApiParam({ name: 'id' })
  async patchMember(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: PatchRoleDto
  ) {
    const owner = await this.requireOwner(ctx);
    return {
      success: true,
      ...(await this.service.changeMemberRole(
        owner,
        owner.business.id,
        id,
        body.role_id
      )),
    };
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke an active location delegation' })
  @ApiParam({ name: 'id' })
  async revoke(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    const owner = await this.requireOwner(ctx);
    return this.service.revokeMember(owner.id, owner.business.id, id);
  }

  private async requireOwner(ctx: RequestContext) {
    if (!(await this.flag.isEnabled())) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const user = await this.hasuraUser.getUser(ctx);
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException(
        'Only business owners can manage delegations',
        HttpStatus.FORBIDDEN
      );
    }
    return user as typeof user & { business: { id: string } };
  }
}
