import { randomUUID } from 'crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AwsService } from '../../aws/aws.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { isoCountryCode } from '../../orders/delivery-pricing.util';
import { PaymentRoutingService } from '../../stripe-payments/payment-routing.service';
import { isActivePersona } from '../../users/persona.util';
import {
  BASELINE_SLOTS,
  INSPECTION_BASELINE_REQUIRED,
  PICKUP_PHOTO_AFTER_START,
  baselineReady,
  isBeforeRentalStart,
  itemOptInStamps,
  optInCaptureColumns,
  reuseChoice,
  reuseDamage,
  reusedColumns,
  zoneForCountry,
  type CaptureColumns,
  type ReuseBlock,
} from './inspection-optin';
import { RentalInspectionFlags } from './rental-inspection-flags.service';
import { inspectionRejected } from './rental-inspection.errors';
import {
  INSPECTION_UPLOAD_TTL_SECONDS,
  inspectionDerivativeKey,
  inspectionEvidenceBucket,
  inspectionObjectKey,
  resolveInspectionChecksum,
  validateInspectionUpload,
} from './rental-inspection-evidence';

const BASELINE_KEY = /^(dev|prod)\/rental-inspection\/baseline\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

@Injectable()
export class InspectionOptInService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly flags: RentalInspectionFlags,
    private readonly aws: AwsService,
    private readonly payments: PaymentRoutingService
  ) {}

  async stampsNewBooking(itemId: string | null | undefined): Promise<boolean> {
    if (!itemId) return false;
    const item = await this.itemRow(itemId);
    if (!item) return false;
    const ready = baselineReady(await this.readySlots(itemId));
    return itemOptInStamps(item.inspection_opt_in === true, ready);
  }

  async summary(itemId: string) {
    const item = await this.ownedItem(itemId);
    const photos = await this.baselineRows(itemId);
    const country = await this.itemCountry(itemId);
    return {
      enabled: item.inspection_opt_in === true,
      optedInAt: item.inspection_opted_in_at,
      rail: await this.rail(country),
      baselineComplete: baselineReady(photos.filter((row) => row.status === 'ready').map((row) => row.slot_key)),
      photos: photos.map((row) => ({
        id: row.id,
        slotKey: row.slot_key,
        status: row.status,
        capturedAt: row.captured_at,
      })),
    };
  }

  async setOptIn(itemId: string, enabled: boolean) {
    await this.ownedItem(itemId);
    if (!enabled) return this.writeOptIn(itemId, false, null);
    if (!baselineReady(await this.readySlots(itemId))) this.rejectBaseline();
    return this.writeOptIn(itemId, true, new Date().toISOString());
  }

  async presignBaseline(itemId: string, input: BaselinePresign) {
    await this.ownedItem(itemId);
    this.assertSlot(input.slotKey);
    const upload = validateInspectionUpload(input.contentType, input.fileSize);
    const photoId = randomUUID();
    const objectKey = baselineKey(itemId, photoId, upload.ext);
    const columns = optInCaptureColumns({
      slotKey: input.slotKey,
      clock: new Date(),
      timeZone: zoneForCountry(await this.itemCountry(itemId)),
      exif: input.exifDateTime,
      source: input.captureSource,
      platform: input.platform,
    });
    const savedId = await this.upsertBaseline(itemId, photoId, objectKey, upload, columns);
    const signed = await this.aws.generateStrictUploadUrl({
      bucketName: inspectionEvidenceBucket(),
      key: objectKey,
      contentType: upload.contentType,
      contentLength: upload.size,
      checksumSha256: resolveInspectionChecksum(input.sha256),
      expiresIn: INSPECTION_UPLOAD_TTL_SECONDS,
    });
    return { photoId: savedId, objectKey, uploadUrl: signed.url, capturedAt: columns.captured_at };
  }

  async finalizeBaseline(itemId: string, photoId: string) {
    const row = await this.baselineById(itemId, photoId);
    if (!row) throw new HttpException('Photo not found', HttpStatus.NOT_FOUND);
    if (row.status === 'ready') return { photoId, status: 'ready' };
    const head = await this.aws.headObjectMeta(inspectionEvidenceBucket(), row.object_key);
    if (!head) throw new HttpException('Upload was not received', HttpStatus.CONFLICT);
    await this.markBaselineReady(photoId, head.contentLength ?? null);
    return { photoId, status: 'ready' };
  }

  async reuseStatus(bookingId: string) {
    const booking = await this.bookingRow(bookingId);
    if (!booking) return { available: false, blocked: false, source: null, submittedAt: null, photoCount: 0 };
    const found = await this.returnSummary(booking);
    const choice = reuseChoice({
      hasReturn: !!found,
      damage: found?.damage ?? null,
      hasBaseline: baselineReady(await this.readySlots(booking.itemId ?? '')),
    });
    return {
      available: choice.ok,
      blocked: !choice.ok && choice.code === 'PICKUP_REUSE_BLOCKED_DAMAGE',
      source: choice.ok ? choice.source : null,
      submittedAt: found?.submittedAt ?? null,
      photoCount: found?.photoCount ?? 0,
    };
  }

  async reuse(bookingId: string, openDraft: () => Promise<unknown>) {
    const booking = await this.ownedBooking(bookingId);
    await this.assertFlag(booking.country);
    this.assertBefore(booking, new Date());
    const choice = reuseChoice(await this.reuseInput(booking));
    if (!choice.ok) this.rejectReuse(choice.code);
    await openDraft();
    const draft = await this.draft(bookingId);
    const copied = await this.copySources(booking, draft, choice.source);
    return { reused: true, source: choice.source, count: copied };
  }

  captureFor(input: CaptureRequest, country: string | null, clock: Date): CaptureColumns {
    return optInCaptureColumns({ ...input, clock, timeZone: zoneForCountry(country) });
  }

  private async writeOptIn(itemId: string, enabled: boolean, at: string | null) {
    await this.hasura.executeMutation(
      `mutation SetInspectionOptIn($id: uuid!, $on: Boolean!, $at: timestamptz) {
        update_rental_items_by_pk(
          pk_columns: { id: $id }
          _set: { inspection_opt_in: $on, inspection_opted_in_at: $at }
        ) { id }
      }`,
      { id: itemId, on: enabled, at }
    );
    return { enabled };
  }

  private async reuseInput(booking: OptBooking) {
    const found = await this.latestReturn(booking);
    const slots = await this.readySlots(booking.itemId ?? '');
    return {
      hasReturn: !!found,
      damage: found ? found.damage : null,
      hasBaseline: baselineReady(slots),
    };
  }

  private async copySources(booking: OptBooking, draft: DraftRef, source: 'return' | 'baseline') {
    const rows = source === 'return' ? await this.returnPhotos(booking) : await this.baselineReadyRows(booking.itemId ?? '');
    let count = 0;
    for (const row of rows) {
      await this.copyOne(booking.id, draft, row);
      count += 1;
    }
    return count;
  }

  private async copyOne(bookingId: string, draft: DraftRef, row: SourcePhoto) {
    const mediaId = randomUUID();
    const key = inspectionObjectKey(bookingId, mediaId, 'jpg');
    await this.copyBytes(row.objectKey, key);
    const view = inspectionDerivativeKey(key);
    await this.copyBytes(row.objectKey, view);
    const columns = reusedColumns({
      slotKey: row.slotKey,
      capturedAt: row.capturedAt,
      source: row.captureSource,
      atSource: row.capturedAtSource,
    });
    await this.insertCopied(draft, mediaId, key, view, row, columns);
  }

  private async copyBytes(from: string, to: string) {
    const bytes = await this.aws.readObjectBytes(inspectionEvidenceBucket(), from);
    await this.aws.putPrivateObject(inspectionEvidenceBucket(), to, bytes, 'image/jpeg', { ifNoneMatch: true });
  }

  private async insertCopied(
    draft: DraftRef,
    mediaId: string,
    key: string,
    view: string,
    row: SourcePhoto,
    columns: CaptureColumns
  ) {
    await this.hasura.executeMutation(
      `mutation InsertReusedPhoto($object: rental_inspection_media_insert_input!) {
        insert_rental_inspection_media_one(object: $object) { id }
      }`,
      {
        object: {
          id: mediaId,
          inspection_id: draft.inspectionId,
          unit_id: draft.unitId,
          role: row.role,
          object_key: key,
          derivative_key: view,
          content_type: 'image/jpeg',
          status: 'ready',
          reused_from_media_id: row.mediaId,
          ...columns,
        },
      }
    );
  }

  private rejectBaseline(): never {
    throw inspectionRejected(INSPECTION_BASELINE_REQUIRED, 'Add Overview, Other side, and Accessories photos first');
  }

  private rejectReuse(code: string): never {
    const message = code === 'PICKUP_REUSE_BLOCKED_DAMAGE'
      ? 'The last return reported damage, so those photos cannot be reused'
      : 'There is no earlier rental or baseline to reuse';
    throw inspectionRejected(code, message);
  }

  private assertBefore(booking: OptBooking, now: Date): void {
    const start = booking.startAt ? new Date(booking.startAt) : null;
    if (!start || !isBeforeRentalStart(start, now)) {
      throw inspectionRejected(PICKUP_PHOTO_AFTER_START, 'Pickup photos can be added only before the rental starts');
    }
  }

  private assertSlot(slotKey: string): void {
    if (!(BASELINE_SLOTS as readonly string[]).includes(slotKey)) {
      throw inspectionRejected(INSPECTION_BASELINE_REQUIRED, 'Baseline photos use Overview, Other side, or Accessories');
    }
  }

  private async assertFlag(country: string | null) {
    if (!(await this.flags.optInEnabled(country))) {
      throw new HttpException('Inspection opt-in is off', HttpStatus.NOT_FOUND);
    }
  }

  private async rail(country: string | null): Promise<'card' | 'momo'> {
    if (!country) return 'momo';
    const rail = await this.payments.resolveRailForCountry(country);
    return rail === 'stripe' ? 'card' : 'momo';
  }

  private async ownedItem(itemId: string) {
    const user = await this.users.getUser();
    const item = await this.itemRow(itemId);
    const owns = !!item && isActivePersona(user, 'business') && user.business?.id === item.business_id;
    if (!owns || !item) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    return item;
  }

  private async ownedBooking(bookingId: string): Promise<OptBooking> {
    const user = await this.users.getUser();
    const booking = await this.bookingRow(bookingId);
    const owns = !!booking && isActivePersona(user, 'business') && user.business?.id === booking.businessId;
    if (!owns || !booking) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    return booking;
  }

  private async itemRow(itemId: string) {
    const result = await this.hasura.executeQuery<{
      rental_items_by_pk: { id: string; business_id: string; inspection_opt_in: boolean; inspection_opted_in_at: string | null } | null;
    }>(
      `query OptInItem($id: uuid!) {
        rental_items_by_pk(id: $id) { id business_id inspection_opt_in inspection_opted_in_at }
      }`,
      { id: itemId }
    );
    return result.rental_items_by_pk;
  }

  private async readySlots(itemId: string): Promise<string[]> {
    const rows = await this.baselineRows(itemId);
    return rows.filter((row) => row.status === 'ready').map((row) => row.slot_key);
  }

  private async baselineRows(itemId: string) {
    const result = await this.hasura.executeQuery<{
      rental_item_baseline_photos: BaselineRow[];
    }>(
      `query ItemBaseline($id: uuid!) {
        rental_item_baseline_photos(where: { rental_item_id: { _eq: $id } }) {
          id slot_key status object_key captured_at capture_source captured_at_source
        }
      }`,
      { id: itemId }
    );
    return result.rental_item_baseline_photos ?? [];
  }

  private async baselineReadyRows(itemId: string): Promise<SourcePhoto[]> {
    return (await this.baselineRows(itemId))
      .filter((row) => row.status === 'ready')
      .map((row) => ({
        mediaId: null,
        role: row.slot_key,
        slotKey: row.slot_key,
        objectKey: row.object_key,
        capturedAt: row.captured_at ?? new Date().toISOString(),
        captureSource: row.capture_source,
        capturedAtSource: row.captured_at_source,
      }));
  }

  private async itemCountry(itemId: string): Promise<string | null> {
    const result = await this.hasura.executeQuery<{
      rental_location_listings: Array<{ business_location?: { address?: { country?: string | null } | null } | null }>;
    }>(
      `query ItemCountry($id: uuid!) {
        rental_location_listings(where: { rental_item_id: { _eq: $id } }, limit: 1) {
          business_location { address { country } }
        }
      }`,
      { id: itemId }
    );
    return isoCountryCode(result.rental_location_listings?.[0]?.business_location?.address?.country ?? null);
  }

  private async upsertBaseline(
    itemId: string,
    photoId: string,
    objectKey: string,
    upload: { contentType: string; size: number },
    columns: CaptureColumns
  ) {
    if (!BASELINE_KEY.test(objectKey)) throw new HttpException('Invalid evidence key', HttpStatus.BAD_REQUEST);
    const saved = await this.hasura.executeMutation<{
      insert_rental_item_baseline_photos_one: { id: string } | null;
    }>(
      `mutation UpsertBaseline($object: rental_item_baseline_photos_insert_input!) {
        insert_rental_item_baseline_photos_one(
          object: $object
          on_conflict: {
            constraint: rental_item_baseline_photos_slot_uidx
            update_columns: [object_key, content_type, byte_size, status, captured_at, captured_at_source, capture_source]
          }
        ) { id }
      }`,
      {
        object: {
          id: photoId,
          rental_item_id: itemId,
          slot_key: columns.slot_key,
          object_key: objectKey,
          content_type: upload.contentType,
          byte_size: upload.size,
          status: 'pending',
          captured_at: columns.captured_at,
          captured_at_source: columns.captured_at_source,
          capture_source: columns.capture_source,
        },
      }
    );
    return saved?.insert_rental_item_baseline_photos_one?.id ?? photoId;
  }

  private async baselineById(itemId: string, photoId: string) {
    const rows = await this.baselineRows(itemId);
    return rows.find((row) => row.id === photoId) ?? null;
  }

  private async markBaselineReady(photoId: string, bytes: number | null) {
    await this.hasura.executeMutation(
      `mutation ReadyBaseline($id: uuid!, $bytes: Int) {
        update_rental_item_baseline_photos_by_pk(
          pk_columns: { id: $id }
          _set: { status: "ready", byte_size: $bytes }
        ) { id }
      }`,
      { id: photoId, bytes }
    );
  }

  private async bookingRow(bookingId: string): Promise<OptBooking | null> {
    const result = await this.hasura.executeQuery<{ rental_bookings_by_pk: RawBooking | null }>(
      `query OptInBooking($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id start_at status business_id
          rental_location_listing {
            id
            rental_item { id }
            business_location { address { country } }
          }
        }
      }`,
      { id: bookingId }
    );
    const row = result.rental_bookings_by_pk;
    if (!row) return null;
    return {
      id: row.id,
      startAt: row.start_at,
      status: row.status,
      businessId: row.business_id,
      listingId: row.rental_location_listing?.id ?? null,
      itemId: row.rental_location_listing?.rental_item?.id ?? null,
      country: isoCountryCode(row.rental_location_listing?.business_location?.address?.country ?? null),
    };
  }

  private async returnSummary(booking: OptBooking) {
    const found = await this.latestReturn(booking);
    if (!found) return null;
    return found;
  }

  private async latestReturn(booking: OptBooking): Promise<{ damage: ReuseBlock | null; submittedAt: string | null; photoCount: number } | null> {
    if (!booking.listingId) return null;
    const result = await this.hasura.executeQuery<{ rental_inspection_versions: ReturnHit[] }>(
      `query LatestAcceptedReturn($listingId: uuid!, $bookingId: uuid!) {
        rental_inspection_versions(
          where: {
            status: { _eq: "submitted" }
            inspection: {
              stage: { _eq: "return" }
              rental_booking: {
                rental_location_listing_id: { _eq: $listingId }
                id: { _neq: $bookingId }
                return_resolution: { _eq: "accepted" }
              }
            }
          }
          order_by: { submitted_at: desc }
          limit: 1
        ) {
          id
          submitted_at
          items { condition }
          inspection {
            rental_booking {
              claimed_damage_amount
              rental_inspection_disputes(order_by: { created_at: desc }, limit: 1) { decision }
            }
          }
        }
      }`,
      { listingId: booking.listingId, bookingId: booking.id }
    );
    const hit = result.rental_inspection_versions?.[0];
    if (!hit) return null;
    const claim = Number(hit.inspection?.rental_booking?.claimed_damage_amount ?? 0);
    const decision = hit.inspection?.rental_booking?.rental_inspection_disputes?.[0]?.decision;
    return {
      submittedAt: hit.submitted_at ?? null,
      photoCount: (hit.items ?? []).length,
      damage: reuseDamage({
        claimed: Number.isFinite(claim) ? claim : null,
        upheld: decision === 'damage_upheld',
        reported: (hit.items ?? []).some((item) => item.condition === 'damaged'),
      }),
    };
  }

  private async returnPhotos(booking: OptBooking): Promise<SourcePhoto[]> {
    const result = await this.hasura.executeQuery<{ rental_inspection_versions: VersionMedia[] }>(
      `query ReturnPhotos($listingId: uuid!, $bookingId: uuid!) {
        rental_inspection_versions(
          where: {
            status: { _eq: "submitted" }
            inspection: {
              stage: { _eq: "return" }
              rental_booking: {
                rental_location_listing_id: { _eq: $listingId }
                id: { _neq: $bookingId }
                return_resolution: { _eq: "accepted" }
              }
            }
          }
          order_by: { submitted_at: desc }
          limit: 1
        ) {
          id
        }
      }`,
      { listingId: booking.listingId, bookingId: booking.id }
    );
    const versionId = result.rental_inspection_versions?.[0]?.id;
    if (!versionId) return [];
    const media = await this.hasura.executeQuery<{ rental_inspection_media: MediaRow[] }>(
      `query ReturnMedia($id: uuid!) {
        rental_inspection_media(where: { version_id: { _eq: $id }, status: { _eq: "ready" } }) {
          id role slot_key object_key derivative_key captured_at capture_source captured_at_source
        }
      }`,
      { id: versionId }
    );
    return (media.rental_inspection_media ?? [])
      .filter((row) => (BASELINE_SLOTS as readonly string[]).includes(row.slot_key ?? row.role))
      .map((row) => ({
        mediaId: row.id,
        role: row.slot_key ?? row.role,
        slotKey: row.slot_key ?? row.role,
        objectKey: row.derivative_key || row.object_key,
        capturedAt: row.captured_at ?? new Date(0).toISOString(),
        captureSource: row.capture_source,
        capturedAtSource: row.captured_at_source,
      }));
  }

  private async draft(bookingId: string): Promise<DraftRef> {
    const inspection = await this.hasura.executeQuery<{
      rental_inspections: Array<{ id: string }>;
    }>(
      `query PickupDraft($id: uuid!) {
        rental_inspections(where: { rental_booking_id: { _eq: $id }, stage: { _eq: "pickup" } }, limit: 1) { id }
      }`,
      { id: bookingId }
    );
    const inspectionId = inspection.rental_inspections?.[0]?.id;
    const units = await this.hasura.executeQuery<{ rental_booking_units: Array<{ id: string }> }>(
      `query FirstUnit($id: uuid!) {
        rental_booking_units(where: { rental_booking_id: { _eq: $id } }, order_by: { slot_index: asc }, limit: 1) { id }
      }`,
      { id: bookingId }
    );
    const unitId = units.rental_booking_units?.[0]?.id;
    if (!inspectionId || !unitId) throw new HttpException('Open the draft first', HttpStatus.CONFLICT);
    return { inspectionId, unitId };
  }
}

function baselineKey(itemId: string, photoId: string, ext: string): string {
  const root = inspectionObjectKey(itemId, photoId, ext).split('/')[0];
  return `${root}/rental-inspection/baseline/${itemId.toLowerCase()}/${photoId.toLowerCase()}.${ext}`;
}

export interface BaselinePresign {
  slotKey: string;
  contentType: string;
  fileSize: number;
  sha256?: string;
  exifDateTime?: string;
  captureSource?: string;
  platform?: string | string[];
}

interface CaptureRequest {
  slotKey?: string | null;
  exif?: string | null;
  source?: string | null;
  platform?: string | string[];
}

interface BaselineRow {
  id: string;
  slot_key: string;
  status: string;
  object_key: string;
  captured_at: string | null;
  capture_source: string | null;
  captured_at_source: string | null;
}

interface OptBooking {
  id: string;
  startAt: string | null;
  status: string;
  businessId: string;
  listingId: string | null;
  itemId: string | null;
  country: string | null;
}

interface RawBooking {
  id: string;
  start_at: string | null;
  status: string;
  business_id: string;
  rental_location_listing?: {
    id: string;
    rental_item?: { id: string } | null;
    business_location?: { address?: { country?: string | null } | null } | null;
  } | null;
}

interface ReturnHit {
  id: string;
  submitted_at?: string | null;
  items?: Array<{ condition: string }>;
  inspection?: {
    rental_booking?: {
      claimed_damage_amount?: number | null;
      rental_inspection_disputes?: Array<{ decision: string }>;
    } | null;
  } | null;
}

interface VersionMedia {
  id: string;
}

interface MediaRow {
  id: string;
  role: string;
  slot_key: string | null;
  object_key: string;
  derivative_key: string | null;
  captured_at: string | null;
  capture_source: string | null;
  captured_at_source: string | null;
}

interface SourcePhoto {
  mediaId: string | null;
  role: string;
  slotKey: string;
  objectKey: string;
  capturedAt: string;
  captureSource: string | null;
  capturedAtSource: string | null;
}

interface DraftRef {
  inspectionId: string;
  unitId: string;
}
