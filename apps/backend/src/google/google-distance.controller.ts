import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  forwardRef,
} from '@nestjs/common';
import { AddressesService } from '../addresses/addresses.service';
import { GoogleDistanceService } from './google-distance.service';

interface DistanceMatrixRequest {
  destination_address_ids: string[];
  origin_address_id?: string;
  origin_address?: string; // Pre-formatted address string (lat,lng or full address)
}

@Controller('google')
export class GoogleDistanceController {
  constructor(
    private readonly googleDistanceService: GoogleDistanceService,
    @Inject(forwardRef(() => AddressesService))
    private readonly addressesService: AddressesService
  ) {}

  @Post('distance-matrix')
  async getDistanceMatrix(@Body() body: DistanceMatrixRequest) {
    const { destination_address_ids, origin_address_id, origin_address } = body;

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

    // Handle origin address
    let originStr: string;
    let usedOriginId: string | undefined = origin_address_id;

    if (origin_address) {
      // Use the provided pre-formatted address
      originStr = origin_address;
      usedOriginId = undefined; // No origin ID for pre-formatted addresses
    } else if (origin_address_id) {
      // Fetch origin address by ID
      const origins = await this.addressesService.getAddressesByIds([
        origin_address_id,
      ]);
      const originAddress = origins[0] || null;
      if (!originAddress) {
        throw new HttpException(
          'Origin address not found',
          HttpStatus.BAD_REQUEST
        );
      }
      originStr = formatAddressForGoogle(originAddress);
    } else {
      // Use current user's primary address
      const originAddress =
        await this.addressesService.getCurrentUserPrimaryAddress();
      if (!originAddress) {
        return {
          origin_id: null,
          destination_ids: destination_address_ids,
          rows: [],
          status: 'NO_ORIGIN',
        };
      }
      usedOriginId = originAddress.id;
      originStr = formatAddressForGoogle(originAddress);
    }

    // Prepare destination addresses with formatted strings
    const destinationAddressesWithFormatted = destinationAddresses.map(
      (addr) => ({
        id: addr.id,
        formatted: formatAddressForGoogle(addr),
      })
    );

    let matrix;

    if (usedOriginId) {
      // Use caching when we have origin address ID
      matrix = await this.googleDistanceService.getDistanceMatrixWithCaching(
        usedOriginId,
        originStr,
        destinationAddressesWithFormatted
      );
    } else {
      // Fallback to direct Google API call for pre-formatted addresses
      const destinationStrs = destinationAddressesWithFormatted.map(
        (dest) => dest.formatted
      );
      matrix = await this.googleDistanceService.getDistanceMatrix(
        [originStr],
        destinationStrs
      );
    }

    // Return with reference IDs
    return {
      origin_id: usedOriginId,
      destination_ids: destination_address_ids,
      ...matrix,
    };
  }

  @Get('geocode')
  async reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new HttpException(
        'Invalid latitude or longitude parameters',
        HttpStatus.BAD_REQUEST
      );
    }

    if (latitude < -90 || latitude > 90) {
      throw new HttpException(
        'Latitude must be between -90 and 90',
        HttpStatus.BAD_REQUEST
      );
    }

    if (longitude < -180 || longitude > 180) {
      throw new HttpException(
        'Longitude must be between -180 and 180',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const result = await this.googleDistanceService.reverseGeocode(
        latitude,
        longitude
      );

      return {
        success: true,
        result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
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
