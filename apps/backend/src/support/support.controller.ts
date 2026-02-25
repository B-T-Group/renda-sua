import {
    Body,
    Controller,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import type {
    CreateTicketDto,
    SupportTicket,
    SupportTicketStatus,
} from './support.service';
import { SupportService } from './support.service';

interface RequestWithUser extends Request {
  user?: { sub?: string; id?: string };
}

@ApiTags('Support')
@Controller('support')
@UseGuards(AuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Create a support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  async createTicket(
    @Body() dto: CreateTicketDto,
    @Req() request: RequestWithUser
  ): Promise<SupportTicket> {
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return this.supportService.createTicket(userIdentifier, dto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List my support tickets' })
  @ApiResponse({ status: 200, description: 'List of tickets' })
  async getMyTickets(@Req() request: RequestWithUser): Promise<SupportTicket[]> {
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      return [];
    }
    return this.supportService.getMyTickets(userIdentifier);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket details' })
  async getTicket(
    @Param('id') id: string,
    @Req() request: RequestWithUser
  ): Promise<SupportTicket | null> {
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      return null;
    }
    return this.supportService.getTicketById(id, userIdentifier);
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update ticket status (e.g. admin resolve)' })
  @ApiResponse({ status: 200, description: 'Ticket updated' })
  async updateTicketStatus(
    @Param('id') id: string,
    @Body() body: { status: SupportTicketStatus },
    @Req() request: RequestWithUser
  ): Promise<SupportTicket> {
    const userIdentifier = request.user?.sub ?? request.user?.id;
    if (!userIdentifier) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    return this.supportService.updateTicketStatus(
      id,
      body.status,
      userIdentifier
    );
  }
}
