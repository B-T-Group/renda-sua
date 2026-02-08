import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import type { CreateAddressDto, UpdateAddressDto } from './addresses.service';
import { AddressesService } from './addresses.service';

@ApiTags('addresses')
@Controller('addresses')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new address' })
  @ApiResponse({
    status: 201,
    description: 'Address created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
            accountCreated: { type: 'object' },
            warning: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createAddress(@Body() addressData: CreateAddressDto) {
    try {
      // Validate required fields
      if (
        !addressData.address_line_1 ||
        !addressData.city ||
        !addressData.state ||
        !addressData.country
      ) {
        throw new HttpException(
          {
            success: false,
            error:
              'Missing required fields: address_line_1, city, state, and country are required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.addressesService.createAddress(addressData);

      return {
        success: true,
        message: 'Address created successfully',
        data: {
          address: result.address,
          accountCreated: result.accountCreated
            ? {
                message: `New account created with currency ${result.accountCreated.currency}`,
                account: result.accountCreated,
              }
            : {
                message:
                  "No new account created - user already has an account for this country's currency",
              },
          warning: result.warning,
        },
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

  @Get()
  @ApiOperation({ summary: 'Get all addresses for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of addresses retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            addresses: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getUserAddresses() {
    try {
      const addresses = await this.addressesService.getUserAddresses();

      // Wrap each address as { address } to match frontend format (client_addresses, agent_addresses, etc.)
      const wrappedAddresses = addresses.map((addr) => ({ address: addr }));

      return {
        success: true,
        message: 'Addresses retrieved successfully',
        data: {
          addresses: wrappedAddresses,
        },
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

  @Get(':id')
  @ApiOperation({ summary: 'Get a single address by ID' })
  @ApiResponse({
    status: 200,
    description: 'Address retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Address not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getAddress(@Param('id') id: string) {
    try {
      const address = await this.addressesService.getAddress(id);

      return {
        success: true,
        message: 'Address retrieved successfully',
        data: {
          address,
        },
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

  @Put(':id')
  @ApiOperation({ summary: 'Update an address (full replacement)' })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
            warning: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  @ApiResponse({
    status: 404,
    description: 'Address not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateAddress(
    @Param('id') id: string,
    @Body() addressData: UpdateAddressDto
  ) {
    try {
      // Validate required fields for PUT (full replacement)
      if (
        !addressData.address_line_1 ||
        !addressData.city ||
        !addressData.state ||
        !addressData.country
      ) {
        throw new HttpException(
          {
            success: false,
            error:
              'Missing required fields: address_line_1, city, state, and country are required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.addressesService.updateAddress(id, addressData);

      return {
        success: true,
        message: 'Address updated successfully',
        data: {
          address: result.address,
          warning: result.warning,
        },
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

  @Patch(':id')
  @ApiOperation({ summary: 'Update an address (partial update)' })
  @ApiResponse({
    status: 200,
    description: 'Address updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
            warning: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Address not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async patchAddress(
    @Param('id') id: string,
    @Body() addressData: UpdateAddressDto
  ) {
    try {
      const result = await this.addressesService.updateAddress(id, addressData);

      return {
        success: true,
        message: 'Address updated successfully',
        data: {
          address: result.address,
          warning: result.warning,
        },
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address' })
  @ApiResponse({
    status: 200,
    description: 'Address deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Address not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async deleteAddress(@Param('id') id: string) {
    try {
      const result = await this.addressesService.deleteAddress(id);

      return {
        success: result.success,
        message: result.message,
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

  @Get('business-locations/:locationId')
  @ApiOperation({
    summary: 'Get business location address (business owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Business location address retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Business location not found or access denied',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Business owner access required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getBusinessLocationAddress(@Param('locationId') locationId: string) {
    try {
      const address = await this.addressesService.getBusinessLocationAddress(
        locationId
      );

      return {
        success: true,
        message: 'Business location address retrieved successfully',
        data: {
          address,
        },
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

  @Post('business-locations/:locationId')
  @ApiOperation({
    summary: 'Create or update business location address (business owner only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Business location address created/updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
            warning: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  @ApiResponse({
    status: 404,
    description: 'Business location not found or access denied',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Business owner access required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async createBusinessLocationAddress(
    @Param('locationId') locationId: string,
    @Body() addressData: CreateAddressDto
  ) {
    try {
      // Validate required fields
      if (
        !addressData.address_line_1 ||
        !addressData.city ||
        !addressData.state ||
        !addressData.country
      ) {
        throw new HttpException(
          {
            success: false,
            error:
              'Missing required fields: address_line_1, city, state, and country are required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.addressesService.createBusinessLocationAddress(
        locationId,
        addressData
      );

      return {
        success: true,
        message: 'Business location address created/updated successfully',
        data: {
          address: result.address,
          warning: result.warning,
        },
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

  @Put('business-locations/:locationId')
  @ApiOperation({
    summary:
      'Update business location address - full replacement (business owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Business location address updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
            warning: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data',
  })
  @ApiResponse({
    status: 404,
    description: 'Business location not found or access denied',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Business owner access required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async updateBusinessLocationAddress(
    @Param('locationId') locationId: string,
    @Body() addressData: UpdateAddressDto
  ) {
    try {
      // Validate required fields for PUT (full replacement)
      if (
        !addressData.address_line_1 ||
        !addressData.city ||
        !addressData.state ||
        !addressData.country
      ) {
        throw new HttpException(
          {
            success: false,
            error:
              'Missing required fields: address_line_1, city, state, and country are required',
          },
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.addressesService.updateBusinessLocationAddress(
        locationId,
        addressData
      );

      return {
        success: true,
        message: 'Business location address updated successfully',
        data: {
          address: result.address,
          warning: result.warning,
        },
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

  @Patch('business-locations/:locationId')
  @ApiOperation({
    summary:
      'Update business location address - partial update (business owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Business location address updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            address: { type: 'object' },
            warning: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Business location not found or access denied',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Business owner access required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async patchBusinessLocationAddress(
    @Param('locationId') locationId: string,
    @Body() addressData: UpdateAddressDto
  ) {
    try {
      const result = await this.addressesService.updateBusinessLocationAddress(
        locationId,
        addressData
      );

      return {
        success: true,
        message: 'Business location address updated successfully',
        data: {
          address: result.address,
          warning: result.warning,
        },
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

  @Delete('business-locations/:locationId')
  @ApiOperation({
    summary: 'Delete business location address (business owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Business location address deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Business location not found or access denied',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Business owner access required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async deleteBusinessLocationAddress(@Param('locationId') locationId: string) {
    try {
      const result = await this.addressesService.deleteBusinessLocationAddress(
        locationId
      );

      return {
        success: result.success,
        message: result.message,
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
