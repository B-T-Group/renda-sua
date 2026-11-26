import { randomUUID } from 'crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { photoSha256, stripPhoto } from './inspection-photo-bytes';
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
  PICKUP_REUSE_BLOCKED_DAMAGE,
  PICKUP_REUSE_UNAVAILABLE,
  baselineReady,
  completeUnitCopies,
  isBeforeRentalStart,
  itemOptInStamps,
  latestReturnsBySlot,
  matchTargetUnit,
  optInCaptureColumns,
  returnIsClean,
  reuseChoice,
  reusedColumns,
  zoneForCountry,
  type CaptureColumns,
} from './inspection-optin';
import { RentalInspectionFlags } from './rental-inspection-flags.service';
import { inspectionRejected } from './rental-inspection.errors';
import {
  INSPECTION_UPLOAD_TTL_SECONDS,
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
    const stamped = await this.stampsForItems([itemId]);
    return stamped.get(itemId) === true;
  }

  async stampsForItems(itemIds: Array<string | null | undefined>): Promise<Map<string, boolean>> {
    const ids = [...new Set(itemIds.filter((id): id is string => !!id))];
    const map = new Map<string, boolean>();
    if (!ids.length) return map;
    const items = await this.optInItems(ids);
    const slots = await this.readySlotsByItem(ids);
    for (const id of ids) map.set(id, this.itemStamps(items.get(id), slots.get(id) ?? []));
    return map;
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
    await this.assertFlag(await this.itemCountry(itemId));
    if (!enabled) return this.writeOptIn(itemId, false, null);
    if (!baselineReady(await this.readySlots(itemId))) this.rejectBaseline();
    return this.writeOptIn(itemId, true, new Date().toISOString());
  }

  async presignBaseline(itemId: string, input: BaselinePresign) {
    await this.ownedItem(itemId);
    await this.assertFlag(await this.itemCountry(itemId));
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
    await this.ownedItem(itemId);
    await this.assertFlag(await this.itemCountry(itemId));
    const row = await this.baselineById(itemId, photoId);
    if (!row) throw new HttpException('Photo not found', HttpStatus.NOT_FOUND);
    if (row.status === 'ready') return { photoId, status: 'ready' };
    const head = await this.aws.headObjectMeta(inspectionEvidenceBucket(), row.object_key);
    this.assertBaselineHead(head, row);
    const raw = await this.aws.readObjectBytes(inspectionEvidenceBucket(), row.object_key);
    const stripped = await stripPhoto(raw, row.content_type || head!.contentType);
    await this.aws.putPrivateObject(inspectionEvidenceBucket(), row.object_key, stripped.bytes, stripped.contentType);
    await this.markBaselineReady(photoId, stripped.bytes.length, stripped.contentType);
    return { photoId, status: 'ready' };
  }

  async summaryIfEnabled(itemId: string) {
    try {
      if (!(await this.flags.optInEnabled(await this.itemCountry(itemId)))) return null;
      return await this.summary(itemId);
    } catch (error: any) {
      return null;
    }
  }

  async reuseStatus(bookingId: string) {
    const booking = await this.bookingRow(bookingId);
    if (!booking) return { available: false, blocked: false, source: null, submittedAt: null, photoCount: 0 };
    const plan = await this.reusePlan(booking);
    const latest = plan.returns[0]?.submittedAt ?? null;
    return {
      available: plan.choice.ok,
      blocked: !plan.choice.ok && plan.choice.code === PICKUP_REUSE_BLOCKED_DAMAGE,
      source: plan.choice.ok ? plan.choice.source : null,
      submittedAt: latest,
      photoCount: plan.photoCount,
    };
  }

  async reuse(bookingId: string, openDraft: () => Promise<unknown>) {
    const booking = await this.ownedBooking(bookingId);
    await this.assertFlag(booking.country);
    this.assertBefore(booking, new Date());
    const plan = await this.reusePlan(booking);
    if (!plan.choice.ok) this.rejectReuse(plan.choice.code);
    await openDraft();
    const grouped = await this.buildCopies(booking, plan);
    if (!grouped.units.some((unit) => unit.reused)) this.rejectReuse(PICKUP_REUSE_UNAVAILABLE);
    const count = await this.applyReuse(booking.id, grouped.kept);
    return {
      reused: grouped.units.every((unit) => unit.reused),
      source: plan.choice.source,
      count,
      units: grouped.units,
    };
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

  private async reusePlan(booking: OptBooking): Promise<ReusePlan> {
    const returns = latestReturnsBySlot(await this.latestReturns(booking)).map((row) => ({
      ...row,
      clean: returnIsClean(row),
    }));
    const choice = reuseChoice({
      returns,
      hasBaseline: baselineReady(await this.readySlots(booking.itemId ?? '')),
    });
    return { choice, returns, photoCount: returns.filter((row) => row.clean).length };
  }

  private async buildCopies(booking: OptBooking, plan: ReusePlan) {
    const targets = await this.targetUnits(booking.id);
    const copies = plan.choice.ok && plan.choice.source === 'return'
      ? await this.returnCopies(booking.id, plan.returns, targets)
      : await this.baselineCopies(booking.id, booking.itemId ?? '', targets);
    return completeUnitCopies(copies, targets);
  }

  private async returnCopies(bookingId: string, returns: CleanReturn[], targets: TargetUnit[]): Promise<ReuseCopy[]> {
    const media = await this.returnMedia(returns.filter((row) => row.clean).map((row) => row.versionId));
    const copies: ReuseCopy[] = [];
    for (const row of media) {
      const unitId = matchTargetUnit(row, targets, returns.length);
      if (!unitId) continue;
      copies.push(await this.strippedCopy(bookingId, row, unitId, row.versionId));
    }
    return copies;
  }

  private async baselineCopies(bookingId: string, itemId: string, targets: TargetUnit[]): Promise<ReuseCopy[]> {
    const rows = await this.baselineReadyRows(itemId);
    const copies: ReuseCopy[] = [];
    for (const target of targets) {
      for (const row of rows) copies.push(await this.strippedCopy(bookingId, row, target.id, null));
    }
    return copies;
  }

  private async strippedCopy(bookingId: string, row: SourcePhoto, unitId: string, versionId: string | null): Promise<ReuseCopy> {
    const raw = await this.aws.readObjectBytes(inspectionEvidenceBucket(), row.objectKey);
    const stripped = await stripPhoto(raw, row.contentType || 'image/jpeg');
    const mediaId = randomUUID();
    const key = inspectionObjectKey(bookingId, mediaId, stripped.ext);
    const view = key.replace(/\.(jpg|png|webp)$/, `.view.${stripped.ext}`);
    await this.aws.putPrivateObject(inspectionEvidenceBucket(), key, stripped.bytes, stripped.contentType, { ifNoneMatch: true });
    await this.aws.putPrivateObject(inspectionEvidenceBucket(), view, stripped.bytes, stripped.contentType, { ifNoneMatch: true });
    const columns = reusedColumns({
      slotKey: row.slotKey,
      capturedAt: row.capturedAt,
      source: row.captureSource,
      atSource: row.capturedAtSource,
    });
    return {
      unitId,
      sourceVersionId: versionId || null,
      sourceMediaId: row.mediaId,
      role: row.role,
      slotIndex: row.slotIndex,
      objectKey: key,
      derivativeKey: view,
      contentType: stripped.contentType,
      byteSize: stripped.bytes.length,
      sha256: photoSha256(stripped.bytes),
      ...columns,
    };
  }

  private async applyReuse(bookingId: string, copies: ReuseCopy[]): Promise<number> {
    try {
      const result = await this.hasura.executeMutation<{ rental_apply_pickup_reuse: Array<{ id: string }> }>(
        `mutation ApplyPickupReuse($bookingId: uuid!, $copies: jsonb!) {
          rental_apply_pickup_reuse(args: { p_booking_id: $bookingId, p_copies: $copies }) { id }
        }`,
        { bookingId, copies }
      );
      const count = result?.rental_apply_pickup_reuse?.length ?? 0;
      if (count < 1) this.rejectReuse(PICKUP_REUSE_UNAVAILABLE);
      return count;
    } catch (error: any) {
      this.rethrowReuse(error);
    }
  }

  private rethrowReuse(error: any): never {
    const text = JSON.stringify(error?.response ?? error?.message ?? error);
    if (text.includes(PICKUP_REUSE_BLOCKED_DAMAGE)) this.rejectReuse(PICKUP_REUSE_BLOCKED_DAMAGE);
    if (text.includes(PICKUP_REUSE_UNAVAILABLE) || text.includes('PICKUP_REUSE_CHANGED')) {
      this.rejectReuse(PICKUP_REUSE_UNAVAILABLE);
    }
    throw error;
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
    if (!start || !isBeforeRentalStart(start, now, zoneForCountry(booking.country))) {
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

  private itemStamps(item: { inspection_opt_in: boolean } | undefined, slots: string[]): boolean {
    if (!item) return false;
    return itemOptInStamps(item.inspection_opt_in === true, baselineReady(slots));
  }

  private async optInItems(ids: string[]) {
    const result = await this.hasura.executeQuery<{
      rental_items: Array<{ id: string; inspection_opt_in: boolean }>;
    }>(
      `query BatchOptIn($ids: [uuid!]!) {
        rental_items(where: { id: { _in: $ids } }) { id inspection_opt_in }
      }`,
      { ids }
    );
    return new Map((result.rental_items ?? []).map((row) => [row.id, row]));
  }

  private async readySlotsByItem(ids: string[]) {
    const result = await this.hasura.executeQuery<{
      rental_item_baseline_photos: Array<{ rental_item_id: string; slot_key: string }>;
    }>(READY_SLOTS, { ids });
    return groupSlots(result.rental_item_baseline_photos ?? []);
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
          id slot_key status object_key content_type byte_size captured_at capture_source captured_at_source
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
        contentType: row.content_type,
        slotIndex: 0,
        label: null,
        versionId: '',
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
            update_columns: [object_key, content_type, byte_size, status, captured_at, captured_at_source, capture_source, exif_captured_at]
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
          exif_captured_at: columns.exif_captured_at,
        },
      }
    );
    return saved?.insert_rental_item_baseline_photos_one?.id ?? photoId;
  }

  private async baselineById(itemId: string, photoId: string) {
    const rows = await this.baselineRows(itemId);
    return rows.find((row) => row.id === photoId) ?? null;
  }

  private async markBaselineReady(photoId: string, bytes: number, contentType: string) {
    await this.hasura.executeMutation(
      `mutation ReadyBaseline($id: uuid!, $bytes: Int!, $type: String!) {
        update_rental_item_baseline_photos_by_pk(
          pk_columns: { id: $id }
          _set: { status: "ready", byte_size: $bytes, content_type: $type }
        ) { id }
      }`,
      { id: photoId, bytes, type: contentType }
    );
  }

  private assertBaselineHead(
    head: { contentLength: number; contentType: string } | null,
    row: BaselineRow
  ): void {
    if (!head) throw new HttpException('Upload was not received', HttpStatus.CONFLICT);
    const type = head.contentType.split(';')[0].trim().toLowerCase();
    if (type !== (row.content_type || '').toLowerCase() || head.contentLength !== row.byte_size) {
      throw new HttpException('Uploaded file does not match the signed type and size', HttpStatus.BAD_REQUEST);
    }
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

  private async latestReturns(booking: OptBooking): Promise<RawReturn[]> {
    if (!booking.listingId) return [];
    const result = await this.hasura.executeQuery<{ rental_inspection_versions: ReturnHit[] }>(LATEST_RETURNS, {
      listingId: booking.listingId,
      bookingId: booking.id,
    });
    return (result.rental_inspection_versions ?? []).flatMap((hit) => hitRows(hit));
  }

  private async returnMedia(versionIds: string[]): Promise<SourcePhoto[]> {
    if (!versionIds.length) return [];
    const media = await this.hasura.executeQuery<{ rental_inspection_media: MediaRow[] }>(RETURN_MEDIA, {
      ids: versionIds,
    });
    return (media.rental_inspection_media ?? [])
      .filter((row) => row.status === 'ready' || row.status === 'locked')
      .filter((row) => (BASELINE_SLOTS as readonly string[]).includes(row.slot_key ?? row.role))
      .map((row) => ({
        mediaId: row.id,
        role: row.slot_key ?? row.role,
        slotKey: row.slot_key ?? row.role,
        objectKey: row.object_key,
        capturedAt: row.captured_at ?? new Date(0).toISOString(),
        captureSource: row.capture_source,
        capturedAtSource: row.captured_at_source,
        contentType: row.content_type,
        slotIndex: row.unit?.slot_index ?? 0,
        label: row.unit?.physical_label ?? null,
        versionId: row.version_id,
      }));
  }

  private async targetUnits(bookingId: string): Promise<TargetUnit[]> {
    const units = await this.hasura.executeQuery<{ rental_booking_units: TargetRow[] }>(
      `query TargetUnits($id: uuid!) {
        rental_booking_units(where: { rental_booking_id: { _eq: $id } }, order_by: { slot_index: asc }) {
          id slot_index physical_label
        }
      }`,
      { id: bookingId }
    );
    const rows = units.rental_booking_units ?? [];
    if (!rows.length) throw new HttpException('Open the draft first', HttpStatus.CONFLICT);
    return rows.map((row) => ({ id: row.id, slotIndex: row.slot_index, label: row.physical_label }));
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
  content_type: string | null;
  byte_size: number | null;
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
  items?: Array<{ condition: string; unit?: { slot_index?: number | null; physical_label?: string | null } | null }>;
  inspection?: {
    rental_booking?: {
      return_resolution?: string | null;
      claimed_damage_amount?: number | null;
      rental_inspection_disputes?: Array<{ decision: string }>;
    } | null;
  } | null;
}

interface MediaRow {
  id: string;
  role: string;
  slot_key: string | null;
  object_key: string;
  content_type: string | null;
  status: string;
  version_id: string;
  captured_at: string | null;
  capture_source: string | null;
  captured_at_source: string | null;
  unit?: { slot_index?: number | null; physical_label?: string | null } | null;
}

interface SourcePhoto {
  mediaId: string | null;
  role: string;
  slotKey: string;
  objectKey: string;
  capturedAt: string;
  captureSource: string | null;
  capturedAtSource: string | null;
  contentType: string | null;
  slotIndex: number;
  label: string | null;
  versionId: string;
}

interface RawReturn {
  slotIndex: number;
  versionId: string;
  submittedAt: string | null;
  resolution: string | null;
  claimed: number | null;
  upheld: boolean;
  reported: boolean;
}

interface CleanReturn extends RawReturn {
  clean: boolean;
}

interface TargetUnit {
  id: string;
  slotIndex: number;
  label: string | null;
}

interface TargetRow {
  id: string;
  slot_index: number;
  physical_label: string | null;
}

interface ReusePlan {
  choice: ReturnType<typeof reuseChoice>;
  returns: CleanReturn[];
  photoCount: number;
}

interface ReuseCopy extends CaptureColumns {
  unitId: string;
  sourceVersionId: string | null;
  sourceMediaId: string | null;
  role: string;
  slotIndex: number;
  objectKey: string;
  derivativeKey: string;
  contentType: string;
  byteSize: number;
  sha256: string;
}

const READY_SLOTS = `query ReadySlots($ids: [uuid!]!) {
  rental_item_baseline_photos(
    where: { rental_item_id: { _in: $ids }, status: { _eq: "ready" } }
  ) { rental_item_id slot_key }
}`;

function groupSlots(rows: Array<{ rental_item_id: string; slot_key: string }>) {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const list = grouped.get(row.rental_item_id) ?? [];
    list.push(row.slot_key);
    grouped.set(row.rental_item_id, list);
  }
  return grouped;
}

const LATEST_RETURNS = `query LatestUnitReturns($listingId: uuid!, $bookingId: uuid!) {
  rental_inspection_versions(
    where: {
      status: { _eq: "submitted" }
      inspection: {
        stage: { _eq: "return" }
        rental_booking: { rental_location_listing_id: { _eq: $listingId }, id: { _neq: $bookingId } }
      }
    }
    order_by: { submitted_at: desc }
  ) {
    id
    submitted_at
    items { condition unit { slot_index physical_label } }
    inspection {
      rental_booking {
        return_resolution
        claimed_damage_amount
        rental_inspection_disputes(order_by: { created_at: desc }, limit: 1) { decision }
      }
    }
  }
}`;

const RETURN_MEDIA = `query ReturnUnitMedia($ids: [uuid!]!) {
  rental_inspection_media(where: { version_id: { _in: $ids }, status: { _in: ["ready", "locked"] } }) {
    id role slot_key object_key content_type status version_id captured_at capture_source captured_at_source
    unit { slot_index physical_label }
  }
}`;

function hitRows(hit: ReturnHit): RawReturn[] {
  const booking = hit.inspection?.rental_booking;
  const claim = Number(booking?.claimed_damage_amount ?? 0);
  const facts = {
    versionId: hit.id,
    submittedAt: hit.submitted_at ?? null,
    resolution: booking?.return_resolution ?? null,
    claimed: Number.isFinite(claim) ? claim : null,
    upheld: booking?.rental_inspection_disputes?.[0]?.decision === 'damage_upheld',
  };
  return (hit.items ?? []).map((item) => ({
    ...facts,
    slotIndex: item.unit?.slot_index ?? 0,
    reported: item.condition === 'damaged',
  }));
}

