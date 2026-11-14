import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AcknowledgeInspectionDto,
  ApplyPickupGuideDto,
  PresignInspectionEvidenceDto,
  SaveInspectionItemsDto,
  SkipPickupSlotDto,
  SubmitInspectionDto,
} from './dto/rental-inspection.dto';
import { RentalInspectionEvidenceService } from './inspection/rental-inspection-evidence.service';
import { PickupPhotoRulesService } from './inspection/pickup-photo-rules.service';
import {
  type InspectionStage,
  RentalInspectionService,
} from './inspection/rental-inspection.service';

@ApiTags('rentals')
@ApiBearerAuth('access-token')
@Controller('rentals/bookings/:bookingId/inspections')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class RentalInspectionsController {
  constructor(
    private readonly inspections: RentalInspectionService,
    private readonly evidence: RentalInspectionEvidenceService,
    private readonly photoRules: PickupPhotoRulesService
  ) {}

  @Get('pickup/photo-rules')
  @ApiOperation({ summary: 'Pickup-day window and last-return guide. Does not open a draft.' })
  photoRulesFor(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.photoRules.getRules(bookingId);
  }

  @Post('pickup/guide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Use the last return as a display-only guide, or start blank' })
  async applyGuide(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: ApplyPickupGuideDto
  ) {
    await this.inspections.openDraft(bookingId, 'pickup');
    return this.photoRules.applyGuide(bookingId, body.mode);
  }

  @Post('pickup/slot-skips')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip an extra guide angle with a reason shown to the renter' })
  skipSlot(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: SkipPickupSlotDto
  ) {
    return this.photoRules.skipSlot(bookingId, body.unitId, body.slotKey, body.reason);
  }

  @Post(':stage/draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open a pickup or return inspection draft (business)' })
  openDraft(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('stage') stage: string
  ) {
    return this.inspections.openDraft(bookingId, this.stage(stage));
  }

  @Put(':stage/items')
  @ApiOperation({ summary: 'Save draft condition, accessories, and wear (business)' })
  saveItems(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('stage') stage: string,
    @Body() body: SaveInspectionItemsDto
  ) {
    return this.inspections.saveItems(bookingId, this.stage(stage), body.items);
  }

  @Post(':stage/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an immutable inspection version (business)' })
  submit(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('stage') stage: string,
    @Body() body: SubmitInspectionDto
  ) {
    return this.inspections.submit(bookingId, this.stage(stage), body?.claimedDamageAmount);
  }

  @Get(':stage')
  @ApiOperation({ summary: 'Current inspection. Clients do not receive version numbers.' })
  getOne(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('stage') stage: string
  ) {
    return this.inspections.getForViewer(bookingId, this.stage(stage));
  }

  @Post(':stage/acknowledgements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept, request a correction, or dispute (client)' })
  acknowledge(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('stage') stage: string,
    @Body() body: AcknowledgeInspectionDto
  ) {
    return this.inspections.acknowledge(
      bookingId,
      this.stage(stage),
      body.versionId,
      body.decision,
      body.reason
    );
  }

  @Post('return/handback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record physical handback at server time (business)' })
  handback(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.inspections.recordHandback(bookingId);
  }

  @Post('evidence/presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Presign a private inspection photo upload' })
  presign(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: PresignInspectionEvidenceDto,
    @Headers('x-rendasua-platform') platform?: string | string[],
    @Headers('x-client-platform') clientPlatform?: string | string[]
  ) {
    // UX gate only. Either header can be spoofed. It is not proof of a camera capture.
    // A missing x-rendasua-platform falls back to x-client-platform. Unknown values are web.
    return this.evidence.presign(bookingId, body, platform ?? clientPlatform);
  }

  @Post('evidence/:mediaId/finalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the upload and store an EXIF-stripped derivative' })
  finalize(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string
  ) {
    return this.evidence.finalize(bookingId, mediaId);
  }

  @Get('evidence/:mediaId/url')
  @ApiOperation({ summary: 'Short-lived presigned GET of the stripped photo' })
  viewUrl(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string
  ) {
    return this.evidence.viewUrl(bookingId, mediaId);
  }

  private stage(stage: string): InspectionStage {
    if (stage !== 'pickup' && stage !== 'return') {
      throw new HttpException('stage must be pickup or return', HttpStatus.BAD_REQUEST);
    }
    return stage;
  }
}
