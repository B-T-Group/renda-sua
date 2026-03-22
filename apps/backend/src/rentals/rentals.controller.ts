import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { CreateBusinessRentalItemDto } from './dto/create-business-rental-item.dto';
import { CreateBusinessRentalListingDto } from './dto/create-business-rental-listing.dto';
import { UpdateBusinessRentalItemDto } from './dto/update-business-rental-item.dto';
import { UpdateBusinessRentalListingDto } from './dto/update-business-rental-listing.dto';
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

  @Public()
  @Get('listings')
  @ApiOperation({
    summary:
      'List active rental location listings scoped by client country/state (or supported countries); optional sort',
  })
  @ApiQuery({
    name: 'country_code',
    required: false,
    description:
      'ISO country code (anonymous; logged-in users use primary address on server)',
  })
  @ApiQuery({ name: 'state', required: false, description: 'State / region name' })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['relevance', 'newest', 'fastest', 'cheapest', 'expensive'],
    description: 'Sort mode (fastest uses distance when user has a primary address)',
  })
  @ApiResponse({ status: 200, description: 'Listings returned' })
  async listPublicListings(
    @Query('country_code') country_code?: string,
    @Query('state') state?: string,
    @Query('sort') sort?: string
  ) {
    const listings = await this.rentalsService.listPublicRentalListings({
      country_code,
      state,
      sort,
    });
    return { success: true, data: { listings } };
  }

  @Public()
  @Get('listings/:listingId')
  @ApiOperation({
    summary:
      'Get one public rental location listing by id (RLS applies; 404 if not visible)',
  })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiQuery({
    name: 'country_code',
    required: false,
    description: 'Anonymous geo hint; must match listing region when set',
  })
  @ApiQuery({ name: 'state', required: false })
  @ApiResponse({ status: 200, description: 'Listing returned' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async getPublicListing(
    @Param('listingId') listingId: string,
    @Query('country_code') country_code?: string,
    @Query('state') state?: string
  ) {
    const listing = await this.rentalsService.getPublicRentalListingById(
      listingId,
      { country_code, state }
    );
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return { success: true, data: { listing } };
  }

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

  @Get('business/items/:itemId')
  @ApiOperation({ summary: 'Get rental item detail for the current business' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Item returned' })
  @ApiResponse({ status: 403, description: 'Not a business user' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getBusinessItemById(@Param('itemId') itemId: string) {
    const item = await this.rentalsService.getBusinessRentalItemById(itemId);
    return { success: true, data: { item } };
  }

  @Patch('business/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a rental item owned by the current business' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiBody({ type: UpdateBusinessRentalItemDto })
  @ApiResponse({ status: 200, description: 'Item updated' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateBusinessItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBusinessRentalItemDto
  ) {
    await this.rentalsService.updateBusinessRentalItem(itemId, dto);
    return { success: true };
  }

  @Patch('business/listings/:listingId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a rental location listing owned by the current business',
  })
  @ApiParam({ name: 'listingId', format: 'uuid' })
  @ApiBody({ type: UpdateBusinessRentalListingDto })
  @ApiResponse({ status: 200, description: 'Listing updated' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 404, description: 'Listing not found' })
  async updateBusinessListing(
    @Param('listingId') listingId: string,
    @Body() dto: UpdateBusinessRentalListingDto
  ) {
    await this.rentalsService.updateBusinessRentalListing(listingId, dto);
    return { success: true };
  }

  @Get('client/requests')
  @ApiOperation({ summary: 'List rental requests for the current client' })
  @ApiResponse({ status: 200, description: 'Requests returned' })
  @ApiResponse({ status: 403, description: 'Not a client user' })
  async getClientRequests() {
    const requests = await this.rentalsService.getClientRentalRequests();
    return { success: true, data: { requests } };
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

  @Post('requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel own pending rental request (client)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Request cancelled' })
  @ApiResponse({ status: 400, description: 'Request is not pending' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async cancelClientRequest(@Param('id') requestId: string) {
    return this.rentalsService.cancelClientRentalRequest(requestId);
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
