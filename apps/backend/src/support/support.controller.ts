import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { HasuraUserService } from '../hasura/hasura-user.service';
import type {
    CreateTicketDto,
    SupportTicket,
    SupportTicketStatus,
} from './support.service';
import { SupportService } from './support.service';

@ApiTags('Support')
@Controller('support')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  async createTicket(@Body() dto: CreateTicketDto): Promise<SupportTicket> {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return this.supportService.createTicket(userId, dto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List my support tickets' })
  @ApiResponse({ status: 200, description: 'List of tickets' })
  async getMyTickets(): Promise<SupportTicket[]> {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') {
      return [];
    }
    return this.supportService.getMyTickets(userId);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket details' })
  async getTicket(@Param('id') id: string): Promise<SupportTicket | null> {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') {
      return null;
    }
    return this.supportService.getTicketById(id, userId);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update ticket status (e.g. admin resolve)' })
  @ApiResponse({ status: 200, description: 'Ticket updated' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() body: { status: SupportTicketStatus }
  ): Promise<SupportTicket> {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return this.supportService.updateTicketStatus(id, body.status, userId);
  }
}
