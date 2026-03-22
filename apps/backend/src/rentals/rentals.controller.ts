import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateBusinessRentalItemDto } from './dto/create-business-rental-item.dto';
import { CreateBusinessRentalListingDto } from './dto/create-business-rental-listing.dto';
import { CreateRentalBookingDto } from './dto/create-rental-booking.dto';
import { CreateRentalRequestDto } from './dto/create-rental-request.dto';
import { RespondRentalRequestDto } from './dto/respond-rental-request.dto';
import { VerifyRentalStartPinDto } from './dto/verify-rental-start-pin.dto';
import { RentalsService } from './rentals.service';

@ApiTags('rentals')
@ApiBearerAuth('access-token')
@Controller('rentals')
@Throttle({ short: { limit: 60, ttl: 60000 } })
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Get('business/items')
  @ApiOperation({ summary: 'List rental catalog items for the current business' })
  @ApiResponse({ status: 200, description: 'Items returned' })
  @ApiResponse({ status: 403, description: 'Not a business user' })
  async getBusinessItems() {
    const items = await this.rentalsService.getBusinessRentalItems();
    return { success: true, data: { items } };
  }

  @Get('business/requests')
  @ApiOperation({
    summary: 'List rental requests for listings owned by the current business',
  })
  @ApiResponse({ status: 200, description: 'Requests returned' })
  @ApiResponse({ status: 403, description: 'Not a business user' })
  async getBusinessRequests() {
    const requests = await this.rentalsService.getBusinessRentalRequests();
    return { success: true, data: { requests } };
  }

  @Post('business/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a rental item for the current business' })
  @ApiBody({ type: CreateBusinessRentalItemDto })
  @ApiResponse({ status: 201, description: 'Item created' })
  async createBusinessItem(@Body() dto: CreateBusinessRentalItemDto) {
    const id = await this.rentalsService.createBusinessRentalItem(dto);
    return { success: true, data: { id } };
  }

  @Post('business/listings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a location listing for a rental item' })
  @ApiBody({ type: CreateBusinessRentalListingDto })
  @ApiResponse({ status: 201, description: 'Listing created' })
  async createBusinessListing(@Body() dto: CreateBusinessRentalListingDto) {
    const id = await this.rentalsService.createBusinessRentalListing(dto);
    return { success: true, data: { id } };
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a rental request (client)' })
  @ApiResponse({ status: 201, description: 'Request created' })
  async createRequest(@Body() dto: CreateRentalRequestDto) {
    return this.rentalsService.createRentalRequest(dto);
  }

  @Post('requests/:id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Respond to rental request (business)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RespondRentalRequestDto })
  @ApiResponse({ status: 200, description: 'Response recorded' })
  async respond(
    @Param('id') requestId: string,
    @Body() dto: RespondRentalRequestDto
  ) {
    return this.rentalsService.respondToRentalRequest(requestId, dto);
  }

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book from an available request (client)' })
  @ApiResponse({ status: 201, description: 'Booking created' })
  async createBooking(@Body() dto: CreateRentalBookingDto) {
    return this.rentalsService.createRentalBooking(dto);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel confirmed booking (client or business)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cancelled' })
  async cancelBooking(@Param('id') bookingId: string) {
    return this.rentalsService.cancelRentalBooking(bookingId);
  }

  @Get('bookings/:id/start-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get rental start PIN (client)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'PIN returned' })
  async getStartPin(@Param('id') bookingId: string) {
    return this.rentalsService.getStartPinForClient(bookingId);
  }

  @Post('bookings/:id/verify-start-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify start PIN or overwrite (business)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Rental started' })
  async verifyStartPin(
    @Param('id') bookingId: string,
    @Body() body: VerifyRentalStartPinDto
  ) {
    return this.rentalsService.verifyRentalStartPin(bookingId, body);
  }

  @Post('bookings/:id/start-overwrite-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate start overwrite code (business)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Code returned once' })
  async generateOverwrite(@Param('id') bookingId: string) {
    return this.rentalsService.generateStartOverwriteCode(bookingId);
  }

  @Post('bookings/:id/confirm-return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm return after period ended (business)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Completed and settled' })
  async confirmReturn(@Param('id') bookingId: string) {
    return this.rentalsService.confirmRentalReturn(bookingId);
  }
}
