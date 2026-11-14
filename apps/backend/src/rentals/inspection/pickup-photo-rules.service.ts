import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AwsService } from '../../aws/aws.service';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { isoCountryCode } from '../../orders/delivery-pricing.util';
import { isActivePersona } from '../../users/persona.util';
import { inspectionRejected } from './rental-inspection.errors';
import { RentalInspectionFlags } from './rental-inspection-flags.service';
import {
  INSPECTION_VIEW_TTL_SECONDS,
  inspectionEvidenceBucket,
} from './rental-inspection-evidence';
import {
  PICKUP_GUIDE_RETAKE_REQUIRED,
  PICKUP_GUIDE_SKIP_REASON,
  PICKUP_GUIDE_SLOT_REQUIRED,
  PICKUP_PHOTO_APP_ONLY,
  PICKUP_PHOTO_NOT_PICKUP_DAY,
  PICKUP_PHOTO_SLOT_REQUIRED,
  assignGuideSlots,
  canonicalUnitId,
  captureOutsidePickupDay,
  cleanSkipReason,
  completeGuideSlots,
  guideChecklist,
  isPickupPhotoDay,
  listingTimeZone,
  missingGuideSlots,
  skipDecision,
  slotMatchesRole,
  uploadPlatform,
  type GuidePhoto,
  type GuideSlot,
} from './pickup-photo-rules';

interface BookingContext {
  id: string;
  start_at: string | null;
  status: string;
  business_id: string;
  rental_location_listing_id: string | null;
  country: string | null;
}

interface InspectionRow {
  id: string;
  pickup_guide_mode: 'guide' | 'blank' | null;
  pickup_guide_version_id: string | null;
}

interface ReadyPhoto {
  unitId: string;
  slotKey: string | null;
  status: string;
  capturedAt: string | null;
}

interface SkipRow {
  unitId: string;
  slotKey: string;
  reason: string;
}

export interface UploadGate {
  bookingId: string;
  role: string;
  platform?: string | string[];
  slotKey?: string | null;
}

@Injectable()
export class PickupPhotoRulesService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly flags: RentalInspectionFlags,
    private readonly aws: AwsService
  ) {}

  async assertUpload(input: UploadGate, now = new Date()): Promise<void> {
    if (input.role === 'counter') return;
    const booking = await this.loadBooking(input.bookingId);
    if (!this.pickupOpen(booking.status)) return;
    if (!(await this.enabled(booking))) return;
    this.rejectClosedUpload(booking, input, now);
  }

  async assertSubmit(bookingId: string, stage: string, now = new Date()): Promise<void> {
    if (stage !== 'pickup') return;
    const booking = await this.loadBooking(bookingId);
    if (!(await this.enabled(booking))) return;
    const start = this.startAt(booking);
    const zone = listingTimeZone(booking.country);
    if (!start || !isPickupPhotoDay(start, now, zone)) this.rejectDay();
    await this.assertFresh(booking, start!, zone);
  }

  async getRules(bookingId: string, now = new Date()) {
    const booking = await this.requireBusiness(bookingId);
    if (!(await this.enabled(booking))) return this.disabledRules(booking);
    return this.enabledRules(booking, now);
  }

  async applyGuide(
    bookingId: string,
    mode: 'guide' | 'blank',
    platform?: string | string[],
    openDraft?: () => Promise<unknown>
  ) {
    const booking = await this.requireBusiness(bookingId);
    if (!(await this.enabled(booking))) this.rejectOff();
    this.assertApp(platform);
    if (openDraft) await openDraft();
    const inspection = await this.inspection(bookingId);
    if (!inspection) throw new HttpException('Open the draft first', HttpStatus.CONFLICT);
    if (mode === 'blank') return this.storeBlank(booking, inspection.id);
    return this.storeGuide(booking, inspection.id);
  }

  async skipSlot(bookingId: string, unitId: string, slotKey: string, reason: string, platform?: string | string[]) {
    const booking = await this.requireBusiness(bookingId);
    if (!(await this.enabled(booking))) this.rejectOff();
    this.assertApp(platform);
    const inspection = await this.inspection(bookingId);
    if (!inspection || inspection.pickup_guide_mode !== 'guide') this.rejectSlot();
    const allowed = await this.extraKeys(booking, inspection.pickup_guide_version_id);
    const decision = skipDecision(slotKey, reason, allowed);
    if (decision === 'required') this.rejectSlot();
    if (decision === 'reason') this.rejectReason();
    await this.assertUnit(bookingId, unitId);
    await this.writeSkip(inspection.id, unitId, slotKey.trim(), cleanSkipReason(reason));
    return { saved: true };
  }

  async clearSlot(bookingId: string, unitId: string, slotKey: string, platform?: string | string[]) {
    const booking = await this.requireBusiness(bookingId);
    if (!(await this.enabled(booking))) this.rejectOff();
    this.assertApp(platform);
    const inspection = await this.inspection(bookingId);
    if (!inspection) return { cleared: false };
    await this.assertUnit(bookingId, unitId);
    await this.deleteSkip(inspection.id, unitId, slotKey.trim());
    return { cleared: true };
  }

  async viewerExtras(bookingId: string, audience: 'client' | 'business' | 'admin') {
    const booking = await this.findBooking(bookingId);
    if (!booking || !(await this.enabled(booking))) return { slotSkips: [] as SkipRow[] };
    const inspection = await this.inspection(bookingId);
    const slotSkips = inspection ? await this.skipRows(inspection.id) : [];
    if (audience === 'client') return { slotSkips };
    return { slotSkips, pickupPhotoRules: await this.enabledRules(booking, new Date()) };
  }

  private rejectClosedUpload(booking: BookingContext, input: UploadGate, now: Date): void {
    const start = this.startAt(booking);
    if (!start || !isPickupPhotoDay(start, now, listingTimeZone(booking.country))) this.rejectDay();
    if (uploadPlatform(input.platform) !== 'app') this.rejectApp();
    if (input.slotKey && !slotMatchesRole(input.slotKey, input.role)) this.rejectSlotPhoto();
  }

  private async assertFresh(booking: BookingContext, start: Date, zone: string): Promise<void> {
    const inspection = await this.inspection(booking.id);
    const photos = inspection ? await this.readyPhotos(inspection.id) : [];
    if (inspection?.pickup_guide_mode === 'guide') await this.assertRetaken(booking, inspection, photos);
    if (captureOutsidePickupDay(photos, start, zone)) this.rejectDay();
  }

  private async assertRetaken(booking: BookingContext, inspection: InspectionRow, photos: ReadyPhoto[]) {
    const slots = await this.slotsFor(booking, inspection.pickup_guide_version_id);
    const missing = missingGuideSlots(slots, photos, await this.skipRows(inspection.id), await this.unitIds(booking.id));
    if (missing.length) {
      throw inspectionRejected(PICKUP_GUIDE_RETAKE_REQUIRED, 'Retake all photos before sending', { missing });
    }
  }

  private async storeBlank(booking: BookingContext, inspectionId: string) {
    await this.setMode(inspectionId, 'blank', null);
    await this.clearTags(inspectionId);
    return this.enabledRules(booking, new Date());
  }

  private async storeGuide(booking: BookingContext, inspectionId: string) {
    const found = await this.latestReturn(booking);
    if (!found) throw new HttpException('No return report to use as a guide', HttpStatus.CONFLICT);
    const checklist = guideChecklist(found.item);
    await this.setMode(inspectionId, 'guide', found.versionId);
    if (checklist) await this.copyChecklist(inspectionId, await this.unitIds(booking.id), checklist.set);
    return this.enabledRules(booking, new Date());
  }

  private async copyChecklist(inspectionId: string, unitIds: string[], set: Record<string, unknown>) {
    for (const unitId of unitIds) await this.upsertGuideItem(inspectionId, unitId, set);
  }

  private async upsertGuideItem(inspectionId: string, unitId: string, set: Record<string, unknown>) {
    const updated = await this.hasura.executeMutation<{ update_rental_inspection_items: { affected_rows: number } }>(
      `mutation SaveGuideItem($inspectionId: uuid!, $unitId: uuid!, $set: rental_inspection_items_set_input!) {
        update_rental_inspection_items(
          where: { inspection_id: { _eq: $inspectionId }, unit_id: { _eq: $unitId }, version_id: { _is_null: true } }
          _set: $set
        ) { affected_rows }
      }`,
      { inspectionId, unitId, set }
    );
    if ((updated.update_rental_inspection_items?.affected_rows ?? 0) > 0) return;
    await this.insertGuideItem(inspectionId, unitId, set);
  }

  private async insertGuideItem(inspectionId: string, unitId: string, set: Record<string, unknown>) {
    await this.hasura.executeMutation(
      `mutation InsertGuideItem($object: rental_inspection_items_insert_input!) {
        insert_rental_inspection_items_one(object: $object) { id }
      }`,
      { object: { inspection_id: inspectionId, unit_id: unitId, ...set } }
    );
  }

  private async enabledRules(booking: BookingContext, now: Date) {
    const inspection = await this.inspection(booking.id);
    const guide = await this.guidePayload(booking, inspection?.pickup_guide_version_id ?? null);
    return {
      enabled: true,
      pickupDay: this.onPickupDay(booking, now),
      timezone: listingTimeZone(booking.country),
      startAt: booking.start_at,
      guideMode: inspection?.pickup_guide_mode ?? null,
      guide,
    };
  }

  private disabledRules(booking: BookingContext) {
    return {
      enabled: false,
      pickupDay: true,
      timezone: listingTimeZone(booking.country),
      startAt: booking.start_at,
      guideMode: null,
      guide: null,
    };
  }

  private async guidePayload(booking: BookingContext, versionId: string | null) {
    const listingId = booking.rental_location_listing_id;
    const found = versionId ? await this.versionBundle(versionId, listingId) : await this.latestReturn(booking);
    if (!found) return null;
    const slots = await this.signedSlots(found.photos, found.keys);
    const checklist = guideChecklist(found.item);
    return {
      versionId: found.versionId,
      submittedAt: found.submittedAt,
      photoCount: found.photos.length,
      checkCount: checklist?.checkCount ?? 0,
      slots,
    };
  }

  private async slotsFor(booking: BookingContext, versionId: string | null): Promise<GuideSlot[]> {
    if (!versionId) return completeGuideSlots([]);
    const found = await this.versionBundle(versionId, booking.rental_location_listing_id);
    if (!found) return completeGuideSlots([]);
    return completeGuideSlots(assignGuideSlots(found.photos));
  }

  private async extraKeys(booking: BookingContext, versionId: string | null): Promise<string[]> {
    const slots = await this.slotsFor(booking, versionId);
    return slots.filter((slot) => !slot.required).map((slot) => slot.slotKey);
  }

  private async signedSlots(photos: GuidePhoto[], keys: Map<string, string | null>) {
    const slots = completeGuideSlots(assignGuideSlots(photos));
    const signed = [];
    for (const slot of slots) signed.push({ ...slot, url: await this.signOne(keys.get(slot.mediaId) ?? null) });
    return signed;
  }

  private async signOne(key: string | null): Promise<string | null> {
    if (!key) return null;
    try {
      const signed = await this.aws.generatePresignedDownloadUrl({
        bucketName: inspectionEvidenceBucket(),
        key,
        expiresIn: INSPECTION_VIEW_TTL_SECONDS,
      });
      return signed.url ?? null;
    } catch (error: any) {
      return null;
    }
  }

  private async latestReturn(booking: BookingContext) {
    if (!booking.rental_location_listing_id) return null;
    const result = await this.hasura.executeQuery<{ rental_inspection_versions: VersionHit[] }>(
      `query LatestReturnGuide($listingId: uuid!, $bookingId: uuid!) {
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
          id submitted_at
          items { unit_id condition accessories wear checklist_note unit { slot_index } }
        }
      }`,
      { listingId: booking.rental_location_listing_id, bookingId: booking.id }
    );
    const version = result.rental_inspection_versions?.[0];
    if (!version) return null;
    return this.versionBundle(version.id, booking.rental_location_listing_id, version);
  }

  private async versionBundle(versionId: string, listingId: string | null, known?: VersionHit) {
    const version = known ?? (await this.versionById(versionId, listingId));
    if (!version) return null;
    const media = await this.guideMedia(version.id);
    const unitId = canonicalUnitId(unitPhotoCounts(version.items, media));
    const item = version.items.find((row) => row.unit_id === unitId) ?? version.items[0];
    const photos = media
      .filter((row) => row.unit_id === unitId)
      .map((row) => ({ id: row.id, role: row.role, createdAt: row.created_at }));
    return { versionId: version.id, submittedAt: version.submitted_at, item, photos, keys: keyMap(media) };
  }

  private async versionById(versionId: string, listingId: string | null): Promise<VersionHit | null> {
    if (!listingId) return null;
    const result = await this.hasura.executeQuery<{ rental_inspection_versions: VersionHit[] }>(
      `query GuideVersion($id: uuid!, $listingId: uuid!) {
        rental_inspection_versions(
          where: {
            id: { _eq: $id }
            inspection: { rental_booking: { rental_location_listing_id: { _eq: $listingId } } }
          }
          limit: 1
        ) {
          id submitted_at
          items { unit_id condition accessories wear checklist_note unit { slot_index } }
        }
      }`,
      { id: versionId, listingId }
    );
    return result.rental_inspection_versions?.[0] ?? null;
  }

  private async guideMedia(versionId: string): Promise<MediaHit[]> {
    const result = await this.hasura.executeQuery<{ rental_inspection_media: MediaHit[] }>(
      `query GuideMedia($id: uuid!) {
        rental_inspection_media(
          where: { version_id: { _eq: $id }, role: { _neq: "counter" }, status: { _in: ["ready", "locked"] } }
          order_by: [{ created_at: asc }, { id: asc }]
        ) { id unit_id role created_at derivative_key object_key }
      }`,
      { id: versionId }
    );
    return result.rental_inspection_media ?? [];
  }

  private async requireBusiness(bookingId: string): Promise<BookingContext> {
    const user = await this.users.getUser();
    const booking = await this.loadBooking(bookingId);
    const owns = isActivePersona(user, 'business') && user.business?.id === booking.business_id;
    if (!owns) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    return booking;
  }

  private async findBooking(id: string): Promise<BookingContext | null> {
    try {
      return await this.loadBooking(id);
    } catch (error: any) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.NOT_FOUND) return null;
      throw error;
    }
  }

  private async loadBooking(id: string): Promise<BookingContext> {
    const result = await this.hasura.executeQuery<{ rental_bookings_by_pk: RawBooking | null }>(
      `query PickupRulesBooking($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id start_at status business_id rental_location_listing_id inspection_policy_version
          rental_location_listing { business_location { address { country } } }
        }
      }`,
      { id }
    );
    const row = result.rental_bookings_by_pk;
    if (!row?.inspection_policy_version) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    return {
      id: row.id,
      start_at: row.start_at,
      status: row.status,
      business_id: row.business_id,
      rental_location_listing_id: row.rental_location_listing_id,
      country: row.rental_location_listing?.business_location?.address?.country ?? null,
    };
  }

  private async inspection(bookingId: string): Promise<InspectionRow | null> {
    const result = await this.hasura.executeQuery<{ rental_inspections: InspectionRow[] }>(
      `query PickupRulesInspection($id: uuid!) {
        rental_inspections(where: { rental_booking_id: { _eq: $id }, stage: { _eq: "pickup" } }, limit: 1) {
          id pickup_guide_mode pickup_guide_version_id
        }
      }`,
      { id: bookingId }
    );
    return result.rental_inspections?.[0] ?? null;
  }

  private async readyPhotos(inspectionId: string): Promise<ReadyPhoto[]> {
    const result = await this.hasura.executeQuery<{ rental_inspection_media: RawPhoto[] }>(
      `query PickupReadyPhotos($id: uuid!) {
        rental_inspection_media(
          where: { inspection_id: { _eq: $id }, version_id: { _is_null: true }, status: { _eq: "ready" }, role: { _neq: "counter" } }
        ) { unit_id slot_key captured_at status }
      }`,
      { id: inspectionId }
    );
    return (result.rental_inspection_media ?? []).map((row) => ({
      unitId: row.unit_id,
      slotKey: row.slot_key,
      status: row.status,
      capturedAt: row.captured_at,
    }));
  }

  private async skipRows(inspectionId: string): Promise<SkipRow[]> {
    const result = await this.hasura.executeQuery<{ rental_inspection_slot_skips: RawSkip[] }>(
      `query PickupSlotSkips($id: uuid!) {
        rental_inspection_slot_skips(where: { inspection_id: { _eq: $id } }) { unit_id slot_key reason }
      }`,
      { id: inspectionId }
    );
    return (result.rental_inspection_slot_skips ?? []).map((row) => ({
      unitId: row.unit_id,
      slotKey: row.slot_key,
      reason: row.reason,
    }));
  }

  private async unitIds(bookingId: string): Promise<string[]> {
    const result = await this.hasura.executeQuery<{ rental_booking_units: Array<{ id: string }> }>(
      `query PickupRulesUnits($id: uuid!) {
        rental_booking_units(where: { rental_booking_id: { _eq: $id } }, order_by: { slot_index: asc }) { id }
      }`,
      { id: bookingId }
    );
    return (result.rental_booking_units ?? []).map((row) => row.id);
  }

  private async assertUnit(bookingId: string, unitId: string): Promise<void> {
    const ids = await this.unitIds(bookingId);
    if (!ids.includes(unitId)) throw new HttpException('Unit not found', HttpStatus.NOT_FOUND);
  }

  private async setMode(inspectionId: string, mode: string, versionId: string | null) {
    await this.hasura.executeMutation(
      `mutation SetPickupGuideMode($id: uuid!, $mode: String!, $version: uuid) {
        update_rental_inspections_by_pk(
          pk_columns: { id: $id }
          _set: { pickup_guide_mode: $mode, pickup_guide_version_id: $version }
        ) { id }
      }`,
      { id: inspectionId, mode, version: versionId }
    );
    await this.hasura.executeMutation(
      `mutation ClearPickupSkips($id: uuid!) {
        delete_rental_inspection_slot_skips(where: { inspection_id: { _eq: $id } }) { affected_rows }
      }`,
      { id: inspectionId }
    );
  }

  private async clearTags(inspectionId: string) {
    await this.hasura.executeMutation(
      `mutation ClearGuideTags($id: uuid!) {
        update_rental_inspection_items(
          where: { inspection_id: { _eq: $id }, version_id: { _is_null: true } }
          _set: { guide_unconfirmed: [] }
        ) { affected_rows }
      }`,
      { id: inspectionId }
    );
  }

  private async deleteSkip(inspectionId: string, unitId: string, slotKey: string) {
    await this.hasura.executeMutation(
      `mutation ClearSlotSkip($inspectionId: uuid!, $unitId: uuid!, $slotKey: String!) {
        delete_rental_inspection_slot_skips(where: {
          inspection_id: { _eq: $inspectionId }, unit_id: { _eq: $unitId }, slot_key: { _eq: $slotKey }
        }) { affected_rows }
      }`,
      { inspectionId, unitId, slotKey }
    );
  }

  private async writeSkip(inspectionId: string, unitId: string, slotKey: string, reason: string) {
    await this.hasura.executeMutation(
      `mutation InsertSlotSkip($object: rental_inspection_slot_skips_insert_input!) {
        insert_rental_inspection_slot_skips_one(
          object: $object
          on_conflict: { constraint: rental_inspection_slot_skips_slot_uidx, update_columns: [reason] }
        ) { id }
      }`,
      { object: { inspection_id: inspectionId, unit_id: unitId, slot_key: slotKey, reason } }
    );
  }

  private async enabled(booking: BookingContext): Promise<boolean> {
    return this.flags.pickupPhotoRulesEnabled(isoCountryCode(booking.country));
  }

  private pickupOpen(status: string): boolean {
    return status === 'reserved' || status === 'confirmed';
  }

  private startAt(booking: BookingContext): Date | null {
    if (!booking.start_at) return null;
    const start = new Date(booking.start_at);
    return Number.isNaN(start.getTime()) ? null : start;
  }

  private onPickupDay(booking: BookingContext, now: Date): boolean {
    const start = this.startAt(booking);
    return !!start && isPickupPhotoDay(start, now, listingTimeZone(booking.country));
  }

  private rejectDay(): never {
    throw inspectionRejected(PICKUP_PHOTO_NOT_PICKUP_DAY, 'Pickup photos can be taken only on pickup day');
  }

  private assertApp(platform?: string | string[]): void {
    if (uploadPlatform(platform) !== 'app') this.rejectApp();
  }

  private rejectApp(): never {
    throw inspectionRejected(PICKUP_PHOTO_APP_ONLY, 'Take pickup photos in the Rendasua app');
  }

  private rejectSlotPhoto(): never {
    throw inspectionRejected(PICKUP_PHOTO_SLOT_REQUIRED, 'This photo needs its angle');
  }

  private rejectSlot(): never {
    throw inspectionRejected(PICKUP_GUIDE_SLOT_REQUIRED, 'This angle is required');
  }

  private rejectReason(): never {
    throw inspectionRejected(PICKUP_GUIDE_SKIP_REASON, 'Skip needs a short reason');
  }

  private rejectOff(): never {
    throw new HttpException(
      { success: false, code: 'PICKUP_PHOTO_RULES_DISABLED', message: 'Pickup photo rules are off' },
      HttpStatus.NOT_FOUND
    );
  }
}

interface RawBooking {
  id: string;
  start_at: string | null;
  status: string;
  business_id: string;
  rental_location_listing_id: string | null;
  inspection_policy_version: number | null;
  rental_location_listing?: { business_location?: { address?: { country?: string | null } | null } | null } | null;
}

interface VersionItem {
  unit_id: string;
  condition: string;
  accessories: unknown;
  wear: string;
  checklist_note: string | null;
  unit?: { slot_index: number } | null;
}

interface VersionHit {
  id: string;
  submitted_at: string;
  items: VersionItem[];
}

interface MediaHit {
  id: string;
  unit_id: string;
  role: string;
  created_at: string;
  derivative_key: string | null;
  object_key: string | null;
}

interface RawPhoto {
  unit_id: string;
  slot_key: string | null;
  captured_at: string | null;
  status: string;
}

interface RawSkip {
  unit_id: string;
  slot_key: string;
  reason: string;
}

function unitPhotoCounts(items: VersionItem[], media: MediaHit[]) {
  const ids = new Set([...items.map((row) => row.unit_id), ...media.map((row) => row.unit_id)]);
  return [...ids].map((unitId) => ({
    unitId,
    slotIndex: items.find((row) => row.unit_id === unitId)?.unit?.slot_index ?? 0,
    photoCount: media.filter((row) => row.unit_id === unitId).length,
  }));
}

/** Prefer the stripped derivative. The original stays a private signed GET, never a public URL. */
function keyMap(media: MediaHit[]): Map<string, string | null> {
  return new Map(media.map((row) => [row.id, row.derivative_key || row.object_key]));
}
