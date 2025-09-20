import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminAuthGuard } from './admin-auth.guard';
import {
  ApplicationConfiguration,
  ConfigurationsService,
} from './configurations.service';
import { UpdateConfigurationDto } from './dto/update-configuration.dto';

interface RequestWithUser extends Request {
  user: any;
}

@ApiTags('admin-configurations')
@Controller('admin/configurations')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class ConfigurationsController {
  constructor(private readonly configurationsService: ConfigurationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all application configurations',
    description:
      'Retrieve all application configurations with optional filtering',
  })
  @ApiQuery({
    name: 'country',
    description: 'Filter by country code (ISO 3166-1 alpha-2)',
    required: false,
    example: 'CM',
  })
  @ApiQuery({
    name: 'tags',
    description: 'Filter by tags (comma-separated)',
    required: false,
    example: 'delivery,pricing',
  })
  @ApiResponse({
    status: 200,
    description: 'List of application configurations',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          config_key: { type: 'string', example: 'base_delivery_fee' },
          config_name: { type: 'string', example: 'Base Delivery Fee' },
          description: { type: 'string', example: 'Base fee for delivery' },
          data_type: { type: 'string', example: 'number' },
          number_value: { type: 'number', example: 300.0 },
          country_code: { type: 'string', example: 'CM' },
          status: { type: 'string', example: 'active' },
          version: { type: 'number', example: 1 },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['delivery', 'pricing'],
          },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getAllConfigurations(
    @Query('country') country?: string,
    @Query('tags') tags?: string
  ): Promise<ApplicationConfiguration[]> {
    if (country) {
      return this.configurationsService.getConfigurationsByCountry(country);
    }

    if (tags) {
      const tagArray = tags.split(',').map((tag) => tag.trim());
      return this.configurationsService.getConfigurationsByTags(tagArray);
    }

    return this.configurationsService.getAllConfigurations();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get configuration by ID',
    description: 'Retrieve a specific configuration by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Configuration ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        config_key: { type: 'string', example: 'base_delivery_fee' },
        config_name: { type: 'string', example: 'Base Delivery Fee' },
        description: { type: 'string', example: 'Base fee for delivery' },
        data_type: { type: 'string', example: 'number' },
        number_value: { type: 'number', example: 300.0 },
        country_code: { type: 'string', example: 'CM' },
        status: { type: 'string', example: 'active' },
        version: { type: 'number', example: 1 },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['delivery', 'pricing'],
        },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async getConfigurationById(
    @Param('id') id: string
  ): Promise<ApplicationConfiguration | null> {
    return this.configurationsService.getConfigurationById(id);
  }

  @Get('key/:key')
  @ApiOperation({
    summary: 'Get configuration by key',
    description: 'Retrieve configuration by key with optional country filter',
  })
  @ApiParam({
    name: 'key',
    description: 'Configuration key',
    example: 'base_delivery_fee',
  })
  @ApiQuery({
    name: 'country',
    description: 'Country code (ISO 3166-1 alpha-2)',
    required: false,
    example: 'CM',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        config_key: { type: 'string', example: 'base_delivery_fee' },
        config_name: { type: 'string', example: 'Base Delivery Fee' },
        description: { type: 'string', example: 'Base fee for delivery' },
        data_type: { type: 'string', example: 'number' },
        number_value: { type: 'number', example: 300.0 },
        country_code: { type: 'string', example: 'CM' },
        status: { type: 'string', example: 'active' },
        version: { type: 'number', example: 1 },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['delivery', 'pricing'],
        },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async getConfigurationByKey(
    @Param('key') key: string,
    @Query('country') country?: string
  ): Promise<ApplicationConfiguration | null> {
    return this.configurationsService.getConfigurationByKey(key, country);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update configuration',
    description:
      'Update an existing configuration. The config_key cannot be changed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Configuration ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated configuration',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        config_key: { type: 'string', example: 'base_delivery_fee' },
        config_name: { type: 'string', example: 'Base Delivery Fee' },
        description: { type: 'string', example: 'Base fee for delivery' },
        data_type: { type: 'string', example: 'number' },
        number_value: { type: 'number', example: 350.0 },
        country_code: { type: 'string', example: 'CM' },
        status: { type: 'string', example: 'active' },
        version: { type: 'number', example: 2 },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['delivery', 'pricing'],
        },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid update data or config_key change attempt',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async updateConfiguration(
    @Param('id') id: string,
    @Body() updateDto: UpdateConfigurationDto,
    @Req() request: RequestWithUser
  ): Promise<ApplicationConfiguration> {
    const userId = request.user?.sub || request.user?.id;
    return this.configurationsService.updateConfiguration(
      id,
      updateDto,
      userId
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete configuration',
    description: 'Delete a configuration by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Configuration ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Configuration deleted successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async deleteConfiguration(
    @Param('id') id: string
  ): Promise<{ success: boolean; message: string }> {
    const deleted = await this.configurationsService.deleteConfiguration(id);
    return {
      success: deleted,
      message: deleted
        ? 'Configuration deleted successfully'
        : 'Failed to delete configuration',
    };
  }
}
