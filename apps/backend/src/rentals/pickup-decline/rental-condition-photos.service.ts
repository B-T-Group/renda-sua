import { HttpException, HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { AwsService } from '../../aws/aws.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { isActivePersona } from '../../users/persona.util';
import { baselineReady } from '../inspection/inspection-optin';
import {
  INSPECTION_VIEW_TTL_SECONDS,
  inspectionEvidenceBucket,
  validateInspectionUpload,
} from '../inspection/rental-inspection-evidence';
import { RentalInspectionFlags } from '../inspection/rental-inspection-flags.service';
import { RentalsService } from '../rentals.service';
import { declineGuard, MAX_DECLINE_PHOTOS } from './pickup-decline.policy';
import { declineFinalKey, declinePendingKey, isPublicBaselineKey } from './pickup-decline.keys';
import * as Q from './pickup-decline.queries';

export interface PublicConditionPhoto {
  slotKey: string;
  capturedAt: string | null;
  url: string;
  expiresAt: string;
}

interface DeclineEvidencePhoto {
  id: string;
  url: string;
  expiresAt: string;
  capturedAt: string;
}

interface BaselineRow {
  id: string;
  slot_key: string;
  object_key: string;
  captured_at: string | null;
  status: string;
}

interface ListingItem {
  id?: string;
}

@Injectable()
export class RentalConditionPhotosService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly flags: RentalInspectionFlags,
    private readonly aws: AwsService,
    @Inject(forwardRef(() => RentalsService)) private readonly rentals: RentalsService
  ) {}

  async forListing(listingId: string): Promise<{ photos: PublicConditionPhoto[] }> {
    const listing = await this.rentals.getPublicRentalListingById(listingId);
    const country = listing?.business_location?.address?.country ?? null;
    if (!(await this.flags.pickupDeclineEnabled(country))) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const itemId = (listing?.rental_item as ListingItem | undefined)?.id;
    if (!listing || !itemId || !(await this.optedIn(itemId))) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    return { photos: await this.publicBaseline(itemId) };
  }

  async presign(
    bookingId: string,
    body: { contentType: string; fileSize: number; captureSource: string; sha256?: string }
  ) {
    const booking = await this.openBooking(bookingId);
    await this.assertRoom(booking.id);
    const upload = validateInspectionUpload(body.contentType, body.fileSize);
    const photoId = randomUUID();
    const key = declinePendingKey(booking.id, photoId, upload.ext);
    await this.insertPending(booking.id, photoId, key, upload, body.captureSource);
    const signed = await this.aws.generateStrictUploadUrl({
      bucketName: inspectionEvidenceBucket(),
      key,
      contentType: upload.contentType,
      contentLength: upload.size,
      expiresIn: INSPECTION_VIEW_TTL_SECONDS,
      checksumSha256: body.sha256,
    });
    return { photoId, uploadUrl: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  async finalize(bookingId: string, photoId: string): Promise<{ photoId: string; status: 'ready' }> {
    await this.openBooking(bookingId);
    const row = await this.pendingRow(bookingId, photoId);
    const bytes = await this.readPending(row.object_key);
    const jpeg = await sharp(bytes).rotate().jpeg({ quality: 82 }).toBuffer();
    const key = declineFinalKey(bookingId, photoId, 'jpg');
    await this.aws.putPrivateObject(inspectionEvidenceBucket(), key, jpeg, 'image/jpeg');
    await this.markReady(photoId, key, jpeg.length);
    await this.dropOriginal(row.object_key, key);
    return { photoId, status: 'ready' };
  }

  async signedForDecline(declineId: string): Promise<DeclineEvidencePhoto[]> {
    const result = await this.hasura.executeQuery<{
      rental_condition_decline_photos: Array<{ id: string; object_key: string; created_at: string }>;
    }>(Q.DECLINE_PHOTO_ROWS, { declineId });
    const rows = (result.rental_condition_decline_photos ?? []).filter((row) => this.evidenceKey(row.object_key));
    const signed = [];
    for (const row of rows) signed.push(await this.evidencePhoto(row));
    return signed;
  }

  private async publicBaseline(itemId: string): Promise<PublicConditionPhoto[]> {
    const result = await this.hasura.executeQuery<{ rental_item_baseline_photos: BaselineRow[] }>(
      Q.BASELINE_PHOTOS,
      { itemId }
    );
    const safe = (result.rental_item_baseline_photos ?? []).filter((row) =>
      isPublicBaselineKey(row.object_key, itemId)
    );
    if (!baselineReady(safe.map((row) => row.slot_key))) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const photos = [];
    for (const row of safe) photos.push(await this.signPublic(row));
    return photos;
  }

  private async signPublic(row: BaselineRow): Promise<PublicConditionPhoto> {
    const signed = await this.aws.generatePresignedDownloadUrl({
      bucketName: inspectionEvidenceBucket(),
      key: row.object_key,
      expiresIn: INSPECTION_VIEW_TTL_SECONDS,
    });
    return {
      slotKey: row.slot_key,
      capturedAt: row.captured_at,
      url: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
    };
  }

  private evidenceKey(key: string): boolean {
    return key.includes('/decline/') && !key.includes('/pending/');
  }

  private async evidencePhoto(row: { id: string; object_key: string; created_at: string }): Promise<DeclineEvidencePhoto> {
    const signed = await this.signPrivate(row.id, row.object_key);
    return { ...signed, capturedAt: row.created_at };
  }

  private async signPrivate(id: string, key: string) {
    const signed = await this.aws.generatePresignedDownloadUrl({
      bucketName: inspectionEvidenceBucket(),
      key,
      expiresIn: INSPECTION_VIEW_TTL_SECONDS,
    });
    return { id, url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  private async optedIn(itemId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery<{
      rental_items_by_pk: { inspection_opt_in?: boolean | null } | null;
    }>(Q.ITEM_OPT_IN, { id: itemId });
    return result.rental_items_by_pk?.inspection_opt_in === true;
  }

  private async openBooking(bookingId: string) {
    const result = await this.hasura.executeQuery<{ rental_bookings_by_pk: any }>(Q.DECLINE_BOOKING, {
      id: bookingId,
    });
    const booking = result.rental_bookings_by_pk;
    if (!booking) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    const country = booking.rental_location_listing?.business_location?.address?.country;
    if (!(await this.flags.pickupDeclineEnabled(country))) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const user = await this.users.getUser();
    if (!isActivePersona(user, 'client') || user.client?.id !== booking.client_id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    const version = booking.pickup_current_version_id as string | null;
    if (!version || declineGuard(booking, version) !== 'ok') {
      throw new HttpException('This pickup can no longer be photographed', HttpStatus.CONFLICT);
    }
    return booking as { id: string };
  }

  private async assertRoom(bookingId: string): Promise<void> {
    const result = await this.hasura.executeQuery<{
      rental_condition_decline_photos_aggregate?: { aggregate?: { count?: number } };
    }>(Q.PHOTO_COUNT, { bookingId });
    const count = result.rental_condition_decline_photos_aggregate?.aggregate?.count ?? 0;
    if (count >= MAX_DECLINE_PHOTOS) {
      throw new HttpException('You can add up to 6 photos', HttpStatus.CONFLICT);
    }
  }

  private async dropOriginal(pendingKey: string, finalKey: string): Promise<void> {
    if (!pendingKey || pendingKey === finalKey) return;
    try {
      await this.aws.deleteObject(inspectionEvidenceBucket(), pendingKey);
    } catch (error: any) {
      void error;
    }
  }

  private async insertPending(
    bookingId: string,
    photoId: string,
    key: string,
    upload: { contentType: string; size: number },
    captureSource: string
  ): Promise<void> {
    const user = await this.users.getUser();
    await this.hasura.executeMutation(Q.INSERT_PENDING_PHOTO, {
      object: {
        id: photoId,
        rental_booking_id: bookingId,
        object_key: key,
        content_type: upload.contentType,
        expected_byte_size: upload.size,
        capture_source: captureSource,
        status: 'pending',
        created_by: user.id,
      },
    });
  }

  private async pendingRow(bookingId: string, photoId: string) {
    const result = await this.hasura.executeQuery<{
      rental_condition_decline_photos: Array<{ object_key: string; status: string }>;
    }>(Q.PHOTO_BY_ID, { id: photoId, bookingId });
    const row = result.rental_condition_decline_photos?.[0];
    if (!row || row.status !== 'pending') {
      throw new HttpException('Photo is not waiting for upload', HttpStatus.BAD_REQUEST);
    }
    return row;
  }

  private async readPending(key: string): Promise<Buffer> {
    try {
      return await this.aws.readObjectBytes(inspectionEvidenceBucket(), key);
    } catch (error: any) {
      throw new HttpException(error?.message ? 'Photo upload was not found' : 'Photo upload was not found', HttpStatus.BAD_REQUEST);
    }
  }

  private async markReady(photoId: string, key: string, bytes: number): Promise<void> {
    await this.hasura.executeMutation(Q.MARK_PHOTO_READY, { id: photoId, key, bytes });
  }
}
