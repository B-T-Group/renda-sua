import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import type { CreateAddressDto } from './addresses.service';
import { AddressesService } from './addresses.service';

@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  async createAddress(@Body() addressData: CreateAddressDto) {
    try {
      // Validate required fields
      if (
        !addressData.address_line_1 ||
        !addressData.city ||
        !addressData.state ||
        !addressData.postal_code ||
        !addressData.country
      ) {
        throw new HttpException(
          {
            success: false,
            error:
              'Missing required fields: address_line_1, city, state, postal_code, and country are required',
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
}
