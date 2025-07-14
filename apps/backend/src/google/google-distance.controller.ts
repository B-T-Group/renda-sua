import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AddressesService } from '../addresses/addresses.service';
import { GoogleDistanceService } from './google-distance.service';

interface DistanceMatrixRequest {
  destination_address_ids: string[];
  origin_address_id?: string;
}

@Controller('distance-matrix')
export class GoogleDistanceController {
  constructor(
    private readonly googleDistanceService: GoogleDistanceService,
    private readonly addressesService: AddressesService
  ) {}

  @Post()
  async getDistanceMatrix(@Body() body: DistanceMatrixRequest) {
    const { destination_address_ids, origin_address_id } = body;
    if (
      !destination_address_ids ||
      !Array.isArray(destination_address_ids) ||
      destination_address_ids.length === 0
    ) {
      throw new HttpException(
        'destination_address_ids is required and must be a non-empty array',
        HttpStatus.BAD_REQUEST
      );
    }
    // Fetch destination addresses
    const destinationAddresses = await this.addressesService.getAddressesByIds(
      destination_address_ids
    );
    if (destinationAddresses.length !== destination_address_ids.length) {
      throw new HttpException(
        'Some destination addresses not found',
        HttpStatus.BAD_REQUEST
      );
    }
    // Fetch origin address
    let originAddress = null;
    let usedOriginId = origin_address_id;
    if (origin_address_id) {
      const origins = await this.addressesService.getAddressesByIds([
        origin_address_id,
      ]);
      originAddress = origins[0] || null;
    } else {
      originAddress =
        await this.addressesService.getCurrentUserPrimaryAddress();
      usedOriginId = originAddress?.id;
    }
    if (!originAddress) {
      return {
        origin_id: null,
        destination_ids: destination_address_ids,
        rows: [],
        status: 'NO_ORIGIN',
      };
    }
    // Format for Google API
    const originStr = formatAddressForGoogle(originAddress);
    const destinationStrs = destinationAddresses.map(formatAddressForGoogle);
    // Call Google API
    const matrix = await this.googleDistanceService.getDistanceMatrix(
      [originStr],
      destinationStrs
    );
    // Return with reference IDs
    return {
      origin_id: usedOriginId,
      destination_ids: destination_address_ids,
      ...matrix,
    };
  }
}

function formatAddressForGoogle(address: any): string {
  // Use lat/lng if available, else full address string
  if (address.latitude && address.longitude) {
    return `${address.latitude},${address.longitude}`;
  }
  // Fallback to full address string
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
}
