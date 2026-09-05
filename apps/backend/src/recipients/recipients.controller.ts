import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import { RecipientsService } from './recipients.service';
import {
  CreateRecipientDto,
  ListRecipientsQueryDto,
  RecipientResponseDto,
  UpdateRecipientDto,
} from './dto/recipients.dto';

@ApiTags('Recipients')
@Controller('recipients')
@ApiBearerAuth()
export class RecipientsController {
  constructor(private readonly recipientsService: RecipientsService) {}

  @Get()
  @ApiOperation({
    summary: 'List saved recipients for the authenticated user',
    description:
      'Returns all saved recipients for the authenticated user, optionally filtered by country.',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'ISO 3166-1 alpha-2 country code to filter by',
    example: 'GA',
  })
  @ApiResponse({
    status: 200,
    description: 'List of saved recipients',
    type: [RecipientResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  async listRecipients(
    @ReqContext() ctx: RequestContext,
    @Query() query: ListRecipientsQueryDto
  ): Promise<RecipientResponseDto[]> {
    return this.recipientsService.listRecipients(ctx, query.country);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single recipient by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Recipient UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipient details',
    type: RecipientResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Recipient not found',
  })
  async getRecipient(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string
  ): Promise<RecipientResponseDto> {
    return this.recipientsService.getRecipient(ctx, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new saved recipient',
    description:
      'Creates a new recipient contact for diaspora orders. Phone number is validated and normalized to E.164 for the specified country.',
  })
  @ApiResponse({
    status: 201,
    description: 'Recipient created successfully',
    type: RecipientResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid country code or phone number',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: {
          type: 'string',
          enum: ['INVALID_COUNTRY', 'INVALID_PHONE'],
        },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  async createRecipient(
    @ReqContext() ctx: RequestContext,
    @Body() dto: CreateRecipientDto
  ): Promise<RecipientResponseDto> {
    return this.recipientsService.createRecipient(ctx, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a saved recipient',
    description:
      'Updates name, phone, or WhatsApp preference. Phone validation uses the recipient country.',
  })
  @ApiParam({
    name: 'id',
    description: 'Recipient UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipient updated successfully',
    type: RecipientResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phone number for recipient country',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Recipient not found',
  })
  async updateRecipient(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: UpdateRecipientDto
  ): Promise<RecipientResponseDto> {
    return this.recipientsService.updateRecipient(ctx, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a saved recipient',
  })
  @ApiParam({
    name: 'id',
    description: 'Recipient UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Recipient deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Recipient not found',
  })
  async deleteRecipient(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string
  ): Promise<{ success: boolean }> {
    return this.recipientsService.deleteRecipient(ctx, id);
  }
}
