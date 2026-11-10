import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { HasuraUserService } from '../../hasura/hasura-user.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { isActivePersona } from '../../users/persona.util';
import { RentalsService } from '../rentals.service';
import { RentalInspectionEvidenceService } from './rental-inspection-evidence.service';
import { RentalInspectionFlags } from './rental-inspection-flags.service';
import {
  inspectionRejected,
  inspectionUpdateRequired,
  requireInspectionDamageAmount,
} from './rental-inspection.errors';
import {
  DEFAULT_MIN_PHOTOS,
  DEFAULT_REMINDER_HOURS,
  DEFAULT_REVIEW_HOURS,
  buildManifest,
  presentInspection,
  unitDisplayLabel,
  type ManifestUnit,
} from './rental-inspection.policy';

export type InspectionStage = 'pickup' | 'return';

export interface InspectionDraftUnit {
  id: string;
  slotIndex: number;
  displayLabel: string;
  physicalLabel: string | null;
}
type Decision = 'accept' | 'correction' | 'dispute';

const DECIDE_MUTATION = `mutation Decide($id: uuid!, $actor: uuid!, $outcome: String!, $reason: String!, $damage: numeric) {
  rental_apply_inspection_decision(args: {
    p_booking_id: $id, p_actor: $actor, p_outcome: $outcome, p_reason: $reason, p_damage: $damage
  }) { id decision }
}`;

interface BookingRow {
  id: string;
  status: string;
  business_id: string;
  client_id: string;
  units_booked: number;
  allocation_version: number;
  inspection_policy_version: number | null;
  pickup_current_version_id: string | null;
  return_current_version_id: string | null;
  booking_number: string;
  client: { user_id: string };
  business: { user_id: string };
  rental_location_listing?: { rental_item?: { name?: string } | null } | null;
}

interface UnitRow {
  id: string;
  slot_index: number;
  display_label: string;
  physical_label: string | null;
  allocation_version: number;
}

interface ItemInput {
  unitId: string;
  condition: string;
  accessories: Array<{ name?: string; count?: number }>;
  wear: string;
  checklistNote?: string;
  physicalLabel?: string;
}

@Injectable()
export class RentalInspectionService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly flags: RentalInspectionFlags,
    private readonly notices: NotificationsService,
    private readonly rentals: RentalsService,
    private readonly evidence: RentalInspectionEvidenceService
  ) {}

  async openDraft(bookingId: string, stage: InspectionStage) {
    const booking = await this.requireBusiness(bookingId);
    this.assertStageOpen(booking, stage);
    const units = await this.ensureUnits(booking);
    const inspection = await this.ensureInspection(booking, stage, units, booking.actorId);
    if (stage === 'pickup' && booking.status === 'reserved') await this.markPending(bookingId);
    return {
      inspectionId: inspection.id,
      allocationVersion: inspection.allocation_version,
      units: units.map((unit) => this.publicUnit(unit)),
    };
  }

  async saveItems(bookingId: string, stage: InspectionStage, items: ItemInput[]) {
    const booking = await this.requireBusiness(bookingId);
    this.assertStageOpen(booking, stage);
    const inspection = await this.inspectionFor(bookingId, stage);
    if (!inspection) throw new HttpException('Open the draft first', HttpStatus.CONFLICT);
    for (const item of items) await this.upsertItem(booking, inspection.id, item);
    return { success: true };
  }

  async submit(bookingId: string, stage: InspectionStage, claimedDamageAmount?: number) {
    const booking = await this.requireBusiness(bookingId);
    const inspection = await this.inspectionFor(bookingId, stage);
    if (!inspection) throw new HttpException('Open the draft first', HttpStatus.CONFLICT);
    if (stage === 'return') await this.storeClaimedDamage(bookingId, inspection.id, claimedDamageAmount);
    const manifest = await this.manifestFor(booking, inspection.id, stage);
    const minPhotos = await this.flags.numberConfig(
      'rental_inspection_min_photos',
      null,
      DEFAULT_MIN_PHOTOS
    );
    const version = await this.callSubmit(bookingId, stage, booking, manifest, minPhotos);
    await this.notice(
      booking,
      stage === 'pickup' ? 'review_pickup' : 'review_return',
      booking.client.user_id,
      'client'
    );
    return { versionId: version.id, versionNo: version.version_no };
  }

  async getForViewer(bookingId: string, stage: InspectionStage) {
    const viewer = await this.viewer(bookingId);
    const inspection = await this.inspectionFor(bookingId, stage);
    const body = await this.viewOf(bookingId, inspection, viewer.audience);
    const presented = presentInspection(body, viewer.audience);
    const minPhotos = await this.minPhotoCount();
    const claimedDamageAmount = await this.claimedDamage(bookingId);
    if (viewer.audience === 'client') return { ...presented, minPhotos, claimedDamageAmount };
    return { ...presented, minPhotos, claimedDamageAmount, correctionReason: body.correctionReason };
  }

  async acknowledge(bookingId: string, stage: InspectionStage, versionId: string, decision: Decision, reason?: string) {
    const booking = await this.requireClient(bookingId);
    const current = stage === 'pickup' ? booking.pickup_current_version_id : booking.return_current_version_id;
    if (current !== versionId) {
      throw new HttpException('That report changed. Review it again.', HttpStatus.CONFLICT);
    }
    if (decision !== 'accept' && !reason?.trim()) {
      throw new HttpException('A written reason is required', HttpStatus.BAD_REQUEST);
    }
    if (stage === 'pickup' && decision === 'dispute') {
      throw new HttpException('Request a correction before the rental starts', HttpStatus.BAD_REQUEST);
    }
    if (decision === 'accept' && stage === 'pickup') return this.acceptPickup(booking, versionId);
    if (decision === 'accept') return this.acceptReturn(booking, versionId);
    if (decision === 'dispute') return this.disputeReturn(booking, versionId, reason!.trim());
    return this.requestCorrection(booking, stage, versionId, reason!.trim());
  }

  async recordHandback(bookingId: string) {
    const booking = await this.requireBusiness(bookingId);
    const row = await this.one(
      'rental_record_handback',
      `mutation Handback($id: uuid!, $actor: uuid!, $note: String) {
        rental_record_handback(args: { p_booking_id: $id, p_actor: $actor, p_note: $note }) { id status return_resolution }
      }`,
      { id: bookingId, actor: booking.actorId, note: null }
    );
    if (!row) throw new HttpException('Every unit needs a return report first', HttpStatus.CONFLICT);
    if (booking.status === 'active' && row.status === 'awaiting_return') {
      await this.rentals.noteInspectionHandback(bookingId, booking.actorId);
    }
    if (row.return_resolution === 'accepted' || row.return_resolution === 'admin_cleared') {
      await this.rentals.settleEnrolledRental(bookingId);
    }
    return { handedBack: true, serverAt: new Date().toISOString() };
  }

  async recordHandbackAsAdmin(bookingId: string, actorId: string, reason: string) {
    const note = reason?.trim();
    if (!note) throw new HttpException('A reason is required', HttpStatus.BAD_REQUEST);
    const before = await this.booking(bookingId);
    const row = await this.one(
      'rental_record_handback',
      `mutation AdminHandback($id: uuid!, $actor: uuid!, $note: String!) {
        rental_record_handback(args: { p_booking_id: $id, p_actor: $actor, p_note: $note }) {
          id status return_resolution
        }
      }`,
      { id: bookingId, actor: actorId, note }
    );
    if (!row) throw new HttpException('Every unit needs a return report first', HttpStatus.CONFLICT);
    await this.rentals.noteInspectionHandback(
      bookingId,
      actorId,
      `Admin recorded physical handback. ${note}`,
      'system',
      before.status
    );
    if (row.return_resolution === 'accepted' || row.return_resolution === 'admin_cleared') {
      await this.rentals.settleEnrolledRental(bookingId);
    }
    return { handedBack: true, serverAt: new Date().toISOString() };
  }

  async decide(bookingId: string, actorId: string, outcome: string, reason: string, damageAmount?: number) {
    if (!reason?.trim()) throw new HttpException('A reason is required', HttpStatus.BAD_REQUEST);
    const damage = requireInspectionDamageAmount(outcome, damageAmount);
    await this.applyDecision(bookingId, actorId, outcome, reason.trim(), damage);
    await this.afterDecision(bookingId);
    return { decided: true, outcome };
  }

  private async applyDecision(
    bookingId: string,
    actorId: string,
    outcome: string,
    reason: string,
    damage: number | null
  ) {
    try {
      const dispute = await this.one('rental_apply_inspection_decision', DECIDE_MUTATION, {
        id: bookingId,
        actor: actorId,
        outcome,
        reason,
        damage,
      });
      if (!dispute) throw new HttpException('No open review for this rental', HttpStatus.CONFLICT);
      return dispute;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw this.decisionError(error);
    }
  }

  private async afterDecision(bookingId: string) {
    const booking = await this.booking(bookingId);
    await this.notice(booking, 'decided', booking.client.user_id, 'client');
    await this.notice(booking, 'decided', booking.business.user_id, 'business');
    await this.rentals.settleEnrolledRental(bookingId);
  }

  private decisionError(error: any): HttpException {
    const text = JSON.stringify(error?.response ?? error?.message ?? error);
    if (text.includes('rental_inspection_damage_amount')) {
      return inspectionRejected(
        'RENTAL_INSPECTION_DAMAGE_AMOUNT',
        'Upholding damage requires a positive damage amount'
      );
    }
    if (text.includes('rental_inspection_decision_missing')) {
      return new HttpException('No open review for this rental', HttpStatus.CONFLICT);
    }
    if (text.includes('rental_inspection_decision')) {
      return inspectionRejected('RENTAL_INSPECTION_DECISION', 'That review decision is not valid');
    }
    return new HttpException('Review could not be decided', HttpStatus.CONFLICT);
  }

  async listOpenDisputes() {
    const result = await this.hasura.executeQuery<{
      rental_inspection_disputes: Array<Record<string, unknown>>;
    }>(
      `query OpenInspectionDisputes {
        rental_inspection_disputes(
          where: { status: { _in: ["open", "escalated"] } }
          order_by: { sla_due_at: asc }
        ) {
          id rental_booking_id version_id status reason opened_at sla_due_at escalated_at
          rental_booking {
            booking_number status settlement_attention return_resolution currency
            rental_location_listing { rental_item { name } }
          }
        }
      }`,
      {}
    );
    return result.rental_inspection_disputes ?? [];
  }

  async getAdminCase(bookingId: string) {
    const booking = await this.adminBooking(bookingId);
    const pickup = await this.stageForAdmin(bookingId, 'pickup');
    const returnReport = await this.stageForAdmin(bookingId, 'return');
    const disputes = await this.disputesFor(bookingId);
    return { booking, pickup, returnReport, disputes };
  }

  async remindAndEscalate(): Promise<number> {
    const reminderHours = await this.flags.numberConfig('rental_inspection_return_reminder_hours', null, DEFAULT_REMINDER_HOURS);
    const reviewHours = await this.flags.numberConfig('rental_inspection_return_review_hours', null, DEFAULT_REVIEW_HOURS);
    const reminded = await this.remind(reminderHours);
    const escalated = await this.escalate(reviewHours);
    return reminded + escalated;
  }

  private publicUnit(unit: UnitRow): InspectionDraftUnit {
    return {
      id: unit.id,
      slotIndex: unit.slot_index,
      displayLabel: unit.display_label,
      physicalLabel: unit.physical_label,
    };
  }

  private async acceptPickup(booking: BookingRow & { actorId: string }, versionId: string) {
    await this.oneAck(
      'rental_accept_pickup_version',
      `mutation AcceptPickup($id: uuid!, $version: uuid!, $actor: uuid!) {
        rental_accept_pickup_version(args: { p_booking_id: $id, p_version_id: $version, p_actor: $actor }) { id }
      }`,
      { id: booking.id, version: versionId, actor: booking.actorId },
      'That report changed. Review it again.'
    );
    await this.notice(booking, 'pickup_accepted', booking.business.user_id, 'business');
    return { accepted: true };
  }

  private async acceptReturn(booking: BookingRow & { actorId: string }, versionId: string) {
    await this.oneAck(
      'rental_accept_return_version',
      `mutation AcceptReturn($id: uuid!, $version: uuid!, $actor: uuid!) {
        rental_accept_return_version(args: { p_booking_id: $id, p_version_id: $version, p_actor: $actor }) { id }
      }`,
      { id: booking.id, version: versionId, actor: booking.actorId },
      'That report changed. Review it again.'
    );
    await this.rentals.settleEnrolledRental(booking.id);
    return { accepted: true };
  }

  private async disputeReturn(booking: BookingRow & { actorId: string }, versionId: string, reason: string) {
    const hours = await this.flags.numberConfig('rental_inspection_return_review_hours', null, DEFAULT_REVIEW_HOURS);
    await this.oneAck(
      'rental_open_return_dispute',
      `mutation Dispute($id: uuid!, $version: uuid!, $actor: uuid!, $reason: String!, $hours: Int!) {
        rental_open_return_dispute(args: {
          p_booking_id: $id, p_version_id: $version, p_actor: $actor, p_reason: $reason, p_review_hours: $hours
        }) { id }
      }`,
      { id: booking.id, version: versionId, actor: booking.actorId, reason, hours: Math.round(hours) },
      'That report can no longer be disputed'
    );
    await this.notice(booking, 'disputed', booking.business.user_id, 'business');
    return { disputed: true };
  }

  private async requestCorrection(booking: BookingRow & { actorId: string }, stage: InspectionStage, versionId: string, reason: string) {
    await this.oneAck(
      'rental_request_correction',
      `mutation RequestCorrection($id: uuid!, $stage: String!, $version: uuid!, $actor: uuid!, $reason: String!) {
        rental_request_correction(args: {
          p_booking_id: $id, p_stage: $stage, p_version_id: $version, p_actor: $actor, p_reason: $reason
        }) { id }
      }`,
      { id: booking.id, stage, version: versionId, actor: booking.actorId, reason },
      'That report changed. Review it again.'
    );
    await this.notice(booking, 'correction', booking.business.user_id, 'business');
    return { correctionRequested: true };
  }

  private async oneAck(
    field: string,
    mutation: string,
    variables: Record<string, unknown>,
    conflict: string
  ): Promise<Record<string, unknown>> {
    try {
      const row = await this.one(field, mutation, variables);
      if (!row) throw new HttpException(conflict, HttpStatus.CONFLICT);
      return row;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      if (this.ackAlreadyRecorded(error)) throw new HttpException(conflict, HttpStatus.CONFLICT);
      throw error;
    }
  }

  private ackAlreadyRecorded(error: any): boolean {
    const text = JSON.stringify(error?.response ?? error?.message ?? error);
    return (
      text.includes('rental_inspection_ack_conflict') ||
      text.includes('rental_inspection_correction_conflict') ||
      text.includes('pickup_accept_conflict') ||
      text.includes('return_accept_conflict') ||
      text.includes('Uniqueness violation') ||
      text.includes('rental_inspection_acks_version_id_persona_key')
    );
  }

  private async ensureUnits(booking: BookingRow): Promise<UnitRow[]> {
    const existing = await this.units(booking.id);
    if (existing.length === booking.units_booked) return existing;
    const objects = Array.from({ length: booking.units_booked }, (_, index) => ({
      rental_booking_id: booking.id,
      slot_index: index + 1,
      display_label: unitDisplayLabel(index + 1),
      allocation_version: 1,
    }));
    await this.hasura.executeMutation(
      `mutation AllocateUnits($objects: [rental_booking_units_insert_input!]!) {
        insert_rental_booking_units(
          objects: $objects
          on_conflict: { constraint: rental_booking_units_rental_booking_id_slot_index_key, update_columns: [] }
        ) { affected_rows }
      }`,
      { objects }
    );
    await this.hasura.executeMutation(
      `mutation StampAllocation($id: uuid!) {
        update_rental_bookings(where: { id: { _eq: $id }, allocation_version: { _eq: 0 } }, _set: { allocation_version: 1 }) { affected_rows }
      }`,
      { id: booking.id }
    );
    return this.units(booking.id);
  }

  private async ensureInspection(booking: BookingRow, stage: InspectionStage, units: UnitRow[], actorId: string) {
    const found = await this.inspectionFor(booking.id, stage);
    if (found) return found;
    const allocation = Math.max(1, booking.allocation_version || units[0]?.allocation_version || 1);
    const inserted = await this.hasura.executeMutation<{
      insert_rental_inspections_one: { id: string; allocation_version: number } | null;
    }>(
      `mutation OpenInspection($object: rental_inspections_insert_input!) {
        insert_rental_inspections_one(
          object: $object
          on_conflict: { constraint: rental_inspections_rental_booking_id_stage_key, update_columns: [] }
        ) { id allocation_version }
      }`,
      { object: { rental_booking_id: booking.id, stage, status: 'draft', allocation_version: allocation, created_by: actorId } }
    );
    return inserted.insert_rental_inspections_one ?? (await this.inspectionFor(booking.id, stage))!;
  }

  private async upsertItem(booking: BookingRow, inspectionId: string, item: ItemInput) {
    const wear = item.wear?.trim();
    if (!wear) throw new HttpException('Wear must be recorded, or "none"', HttpStatus.BAD_REQUEST);
    if (!Array.isArray(item.accessories)) {
      throw new HttpException('List accessories, or an empty list for none', HttpStatus.BAD_REQUEST);
    }
    const accessories = item.accessories.map((row) => ({
      name: String(row.name ?? '').trim(),
      count: Number(row.count),
    }));
    if (accessories.some((row) => !row.name || !Number.isInteger(row.count) || row.count < 1)) {
      throw new HttpException('Each accessory needs a name and a count', HttpStatus.BAD_REQUEST);
    }
    if (item.physicalLabel != null) await this.relabel(booking.id, item.unitId, item.physicalLabel);
    const set = { condition: item.condition, accessories, wear, checklist_note: item.checklistNote?.trim() || null };
    const updated = await this.hasura.executeMutation<{ update_rental_inspection_items: { affected_rows: number } }>(
      `mutation SaveDraftItem($inspectionId: uuid!, $unitId: uuid!, $set: rental_inspection_items_set_input!) {
        update_rental_inspection_items(
          where: { inspection_id: { _eq: $inspectionId }, unit_id: { _eq: $unitId }, version_id: { _is_null: true } }
          _set: $set
        ) { affected_rows }
      }`,
      { inspectionId, unitId: item.unitId, set }
    );
    if ((updated.update_rental_inspection_items?.affected_rows ?? 0) > 0) return;
    await this.hasura.executeMutation(
      `mutation InsertDraftItem($object: rental_inspection_items_insert_input!) {
        insert_rental_inspection_items_one(object: $object) { id }
      }`,
      { object: { inspection_id: inspectionId, unit_id: item.unitId, ...set } }
    );
  }

  private async relabel(bookingId: string, unitId: string, label: string) {
    await this.hasura.executeMutation(
      `mutation Relabel($bookingId: uuid!, $unitId: uuid!, $label: String!) {
        rental_relabel_unit(args: { p_booking_id: $bookingId, p_unit_id: $unitId, p_label: $label }) { id }
      }`,
      { bookingId, unitId, label }
    );
  }

  private async manifestFor(booking: BookingRow, inspectionId: string, stage: InspectionStage) {
    const units = await this.units(booking.id);
    const items = await this.draftItems(inspectionId);
    const media = await this.readyMedia(inspectionId);
    const manifestUnits: ManifestUnit[] = units.map((unit) => {
      const item = items.find((row) => row.unit_id === unit.id);
      const photos = media
        .filter((row) => row.unit_id === unit.id && row.role !== 'counter')
        .map((row) => ({ id: row.id, role: row.role, sha256: row.sha256, bytes: row.byte_size }));
      return {
        unitId: unit.id,
        slotIndex: unit.slot_index,
        displayLabel: unit.display_label,
        physicalLabel: unit.physical_label,
        condition: item?.condition ?? '',
        accessories: item?.accessories ?? [],
        wear: item?.wear ?? '',
        photos,
      };
    });
    const allocation = Math.max(booking.allocation_version, 1);
    return buildManifest({ stage, allocationVersion: allocation, units: manifestUnits });
  }

  private async callSubmit(
    bookingId: string,
    stage: InspectionStage,
    booking: BookingRow & { actorId?: string },
    manifest: { text: string; sha256: string },
    minPhotos: number
  ) {
    try {
      const result = await this.hasura.executeMutation<{
        rental_submit_inspection: Array<{ id: string; version_no: number }>;
      }>(
        `mutation SubmitInspection($id: uuid!, $stage: String!, $actor: uuid!, $text: String!, $hash: String!, $min: Int!) {
          rental_submit_inspection(args: {
            p_booking_id: $id, p_stage: $stage, p_actor: $actor,
            p_manifest_text: $text, p_manifest_sha256: $hash, p_min_photos: $min
          }) { id version_no }
        }`,
        {
          id: bookingId,
          stage,
          actor: booking.actorId,
          text: manifest.text,
          hash: manifest.sha256,
          min: Math.max(DEFAULT_MIN_PHOTOS, Math.round(minPhotos)),
        }
      );
      const version = result.rental_submit_inspection?.[0];
      if (!version) throw new HttpException('Report could not be submitted', HttpStatus.CONFLICT);
      return version;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw this.submitError(error);
    }
  }

  private submitError(error: any): HttpException {
    const text = JSON.stringify(error?.response ?? error?.message ?? error);
    if (text.includes('rental_inspection_manifest_stale')) {
      return new HttpException('A photo changed. Review the report and submit again.', HttpStatus.CONFLICT);
    }
    if (text.includes('rental_inspection_photos')) {
      return new HttpException('Each unit needs overview, other side, and accessories photos', HttpStatus.BAD_REQUEST);
    }
    if (text.includes('rental_inspection_items_incomplete')) {
      return new HttpException('Record condition, accessories, and wear for every unit', HttpStatus.BAD_REQUEST);
    }
    return new HttpException('Report could not be submitted', HttpStatus.CONFLICT);
  }

  private async viewOf(
    bookingId: string,
    inspection: { id: string; status: string } | null,
    audience: 'client' | 'business' | 'admin'
  ) {
    if (!inspection) {
      return audience === 'client' ? { ...this.emptyView(), status: 'not_ready' } : this.emptyView();
    }
    const current = await this.currentVersion(inspection.id);
    if (audience === 'client' && !current) {
      return { ...this.emptyView(), status: 'not_ready' };
    }
    const editingDraft = inspection.status === 'correction_requested' && audience !== 'client';
    const units = await this.versionUnits(
      bookingId,
      inspection.id,
      editingDraft ? null : current?.id ?? null
    );
    const decision = current ? await this.clientDecision(current.id) : null;
    const correctionReason =
      audience === 'client' || !current ? null : await this.correctionReason(current.id);
    return {
      versionId: editingDraft ? null : current?.id ?? null,
      versionNo: audience === 'client' ? null : current?.version_no ?? null,
      allocationVersion: audience === 'client' ? null : current?.allocation_version ?? null,
      submittedAt: editingDraft ? null : current?.submitted_at ?? null,
      status: inspection.status,
      units,
      yourDecision: decision,
      correctionReason,
    };
  }

  private emptyView() {
    return {
      versionId: null,
      versionNo: null,
      allocationVersion: null,
      submittedAt: null,
      status: 'draft',
      units: [],
      yourDecision: null,
      correctionReason: null as string | null,
    };
  }

  private async minPhotoCount(): Promise<number> {
    const configured = await this.flags.numberConfig(
      'rental_inspection_min_photos',
      null,
      DEFAULT_MIN_PHOTOS
    );
    return Math.max(DEFAULT_MIN_PHOTOS, Math.round(configured));
  }

  private async correctionReason(versionId: string): Promise<string | null> {
    const result = await this.hasura.executeQuery<{
      rental_inspection_acks: Array<{ reason: string | null }>;
    }>(
      `query CorrectionReason($id: uuid!) {
        rental_inspection_acks(
          where: { version_id: { _eq: $id }, persona: { _eq: "client" }, decision: { _eq: "correction" } }
          limit: 1
        ) { reason }
      }`,
      { id: versionId }
    );
    return result.rental_inspection_acks?.[0]?.reason ?? null;
  }

  private async remind(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
    const result = await this.hasura.executeMutation<{
      update_rental_bookings: { returning: Array<{ id: string }> };
    }>(
      `mutation RemindReturns($cutoff: timestamptz!, $now: timestamptz!) {
        update_rental_bookings(
          where: {
            inspection_policy_version: { _is_null: false }
            return_resolution: { _eq: "pending" }
            return_handed_back_at: { _lte: $cutoff }
            return_reminder_sent_at: { _is_null: true }
            settlement_claimed_at: { _is_null: true }
          }
          _set: { return_reminder_sent_at: $now }
        ) { returning { id } }
      }`,
      { cutoff, now: new Date().toISOString() }
    );
    const rows = result.update_rental_bookings?.returning ?? [];
    for (const row of rows) {
      const booking = await this.booking(row.id);
      await this.notice(booking, 'return_reminder', booking.client.user_id, 'client');
    }
    return rows.length;
  }

  private async escalate(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
    const due = await this.hasura.executeQuery<{ rental_bookings: Array<{ id: string }> }>(
      `query DueReviews($cutoff: timestamptz!) {
        rental_bookings(where: {
          inspection_policy_version: { _is_null: false }
          return_resolution: { _eq: "pending" }
          return_handed_back_at: { _lte: $cutoff }
          settlement_claimed_at: { _is_null: true }
        }) { id }
      }`,
      { cutoff }
    );
    let count = 0;
    for (const row of due.rental_bookings ?? []) {
      const opened = await this.one(
        'rental_escalate_return_review',
        `mutation Escalate($id: uuid!, $hours: Int!) {
          rental_escalate_return_review(args: { p_booking_id: $id, p_review_hours: $hours }) { id }
        }`,
        { id: row.id, hours: Math.round(hours) }
      );
      if (!opened) continue;
      count += 1;
      const booking = await this.booking(row.id);
      await this.notice(booking, 'escalated', booking.client.user_id, 'client');
      await this.notice(booking, 'escalated', booking.business.user_id, 'business');
    }
    return count;
  }

  private async notice(
    booking: BookingRow,
    kind: Parameters<NotificationsService['sendRentalInspectionNotice']>[0]['kind'],
    userId: string,
    persona: 'client' | 'business'
  ) {
    await this.notices.sendRentalInspectionNotice({
      userId,
      kind,
      persona,
      rentalItemName: booking.rental_location_listing?.rental_item?.name ?? 'Rental',
      bookingId: booking.id,
    });
  }

  private assertStageOpen(booking: BookingRow, stage: InspectionStage) {
    if (booking.inspection_policy_version == null) throw inspectionUpdateRequired();
    const pickup = stage === 'pickup' && ['reserved', 'confirmed'].includes(booking.status);
    const back = stage === 'return' && ['active', 'awaiting_return'].includes(booking.status);
    if (!pickup && !back) throw new HttpException('This inspection is closed', HttpStatus.CONFLICT);
  }

  private async requireBusiness(bookingId: string) {
    const user = await this.users.getUser();
    const booking = await this.booking(bookingId);
    if (!isActivePersona(user, 'business') || user.business?.id !== booking.business_id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    return { ...booking, actorId: user.id };
  }

  private async requireClient(bookingId: string) {
    const user = await this.users.getUser();
    const booking = await this.booking(bookingId);
    if (!isActivePersona(user, 'client') || user.client?.id !== booking.client_id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (booking.inspection_policy_version == null) throw inspectionUpdateRequired();
    return { ...booking, actorId: user.id };
  }

  private async viewer(bookingId: string) {
    const user = await this.users.getUser();
    const booking = await this.booking(bookingId);
    if (isActivePersona(user, 'client') && user.client?.id === booking.client_id) {
      return { audience: 'client' as const };
    }
    if (isActivePersona(user, 'business') && user.business?.id === booking.business_id) {
      return { audience: 'business' as const };
    }
    throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
  }

  private async storeClaimedDamage(bookingId: string, inspectionId: string, claimedDamageAmount?: number) {
    const damaged = await this.draftDamaged(inspectionId);
    if (!damaged) {
      await this.writeClaim(bookingId, null);
      return;
    }
    const amount = Number(claimedDamageAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw inspectionRejected(
        'RENTAL_INSPECTION_DAMAGE_AMOUNT',
        'A damage report needs the amount you are claiming'
      );
    }
    await this.writeClaim(bookingId, amount);
  }

  private async draftDamaged(inspectionId: string): Promise<boolean> {
    const result = await this.hasura.executeQuery<{ rental_inspection_items: Array<{ id: string }> }>(
      `query DraftDamage($id: uuid!) {
        rental_inspection_items(
          where: { inspection_id: { _eq: $id }, version_id: { _is_null: true }, condition: { _eq: "damaged" } }
          limit: 1
        ) { id }
      }`,
      { id: inspectionId }
    );
    return (result.rental_inspection_items?.length ?? 0) > 0;
  }

  private async writeClaim(bookingId: string, amount: number | null) {
    await this.hasura.executeMutation(
      `mutation SetClaimedDamage($id: uuid!, $amount: numeric) {
        update_rental_bookings_by_pk(pk_columns: { id: $id }, _set: { claimed_damage_amount: $amount }) { id }
      }`,
      { id: bookingId, amount }
    );
  }

  private async claimedDamage(bookingId: string): Promise<number | null> {
    const result = await this.hasura.executeQuery<{
      rental_bookings_by_pk: { claimed_damage_amount: number | null } | null;
    }>(
      `query ClaimedDamage($id: uuid!) {
        rental_bookings_by_pk(id: $id) { claimed_damage_amount }
      }`,
      { id: bookingId }
    );
    const amount = result.rental_bookings_by_pk?.claimed_damage_amount;
    return amount == null ? null : Number(amount);
  }

  private async markPending(bookingId: string) {
    await this.hasura.executeMutation(
      `mutation PauseReserved($id: uuid!) {
        update_rental_bookings(
          where: { id: { _eq: $id }, status: { _eq: reserved } }
          _set: { pickup_inspection_pending: true }
        ) { affected_rows }
      }`,
      { id: bookingId }
    );
  }

  private async booking(id: string): Promise<BookingRow> {
    const result = await this.hasura.executeQuery<{ rental_bookings_by_pk: BookingRow | null }>(
      `query InspectionBooking($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id status business_id client_id units_booked allocation_version
          inspection_policy_version pickup_current_version_id return_current_version_id
          booking_number
          client { user_id }
          business { user_id }
          rental_location_listing { rental_item { name } }
        }
      }`,
      { id }
    );
    const booking = result.rental_bookings_by_pk;
    if (!booking) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    return booking;
  }

  private async units(bookingId: string): Promise<UnitRow[]> {
    const result = await this.hasura.executeQuery<{ rental_booking_units: UnitRow[] }>(
      `query InspectionUnits($id: uuid!) {
        rental_booking_units(where: { rental_booking_id: { _eq: $id } }, order_by: { slot_index: asc }) {
          id slot_index display_label physical_label allocation_version
        }
      }`,
      { id: bookingId }
    );
    return result.rental_booking_units ?? [];
  }

  private async inspectionFor(bookingId: string, stage: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspections: Array<{ id: string; status: string; allocation_version: number }>;
    }>(
      `query OneInspection($id: uuid!, $stage: String!) {
        rental_inspections(where: { rental_booking_id: { _eq: $id }, stage: { _eq: $stage } }, limit: 1) {
          id status allocation_version
        }
      }`,
      { id: bookingId, stage }
    );
    return result.rental_inspections?.[0] ?? null;
  }

  private async draftItems(inspectionId: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspection_items: Array<{ unit_id: string; condition: string; accessories: unknown; wear: string }>;
    }>(
      `query DraftItems($id: uuid!) {
        rental_inspection_items(where: { inspection_id: { _eq: $id }, version_id: { _is_null: true } }) {
          unit_id condition accessories wear
        }
      }`,
      { id: inspectionId }
    );
    return result.rental_inspection_items ?? [];
  }

  private async readyMedia(inspectionId: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspection_media: Array<{ id: string; unit_id: string; role: string; sha256: string; byte_size: number }>;
    }>(
      `query ReadyMedia($id: uuid!) {
        rental_inspection_media(where: { inspection_id: { _eq: $id }, version_id: { _is_null: true }, status: { _eq: "ready" } }) {
          id unit_id role sha256 byte_size
        }
      }`,
      { id: inspectionId }
    );
    return result.rental_inspection_media ?? [];
  }

  private async currentVersion(inspectionId: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspection_versions: Array<{ id: string; version_no: number; allocation_version: number; submitted_at: string }>;
    }>(
      `query CurrentVersion($id: uuid!) {
        rental_inspection_versions(
          where: { inspection_id: { _eq: $id }, status: { _eq: "submitted" } }
          order_by: { version_no: desc }
          limit: 1
        ) { id version_no allocation_version submitted_at }
      }`,
      { id: inspectionId }
    );
    return result.rental_inspection_versions?.[0] ?? null;
  }

  private async clientDecision(versionId: string) {
    const result = await this.hasura.executeQuery<{ rental_inspection_acks: Array<{ decision: string }> }>(
      `query ClientAck($id: uuid!) {
        rental_inspection_acks(where: { version_id: { _eq: $id }, persona: { _eq: "client" } }, limit: 1) { decision }
      }`,
      { id: versionId }
    );
    return result.rental_inspection_acks?.[0]?.decision ?? null;
  }

  private async versionUnits(bookingId: string, inspectionId: string, versionId: string | null) {
    const units = await this.units(bookingId);
    const items = versionId ? await this.versionItems(versionId) : await this.draftItems(inspectionId);
    const media = versionId ? await this.versionMedia(versionId) : await this.readyMedia(inspectionId);
    return units.map((unit) => {
      const item = items.find((row) => row.unit_id === unit.id);
      return {
        unitId: unit.id,
        slotIndex: unit.slot_index,
        displayLabel: unit.display_label,
        physicalLabel: unit.physical_label,
        condition: item?.condition ?? '',
        accessories: item?.accessories ?? [],
        wear: item?.wear ?? '',
        photos: media.filter((row) => row.unit_id === unit.id).map((row) => ({ id: row.id, role: row.role })),
      };
    });
  }

  private async versionItems(versionId: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspection_items: Array<{ unit_id: string; condition: string; accessories: unknown; wear: string }>;
    }>(
      `query VersionItems($id: uuid!) {
        rental_inspection_items(where: { version_id: { _eq: $id } }) { unit_id condition accessories wear }
      }`,
      { id: versionId }
    );
    return result.rental_inspection_items ?? [];
  }

  private async versionMedia(versionId: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspection_media: Array<{ id: string; unit_id: string; role: string; sha256: string; byte_size: number }>;
    }>(
      `query VersionMedia($id: uuid!) {
        rental_inspection_media(where: { version_id: { _eq: $id } }) { id unit_id role sha256 byte_size }
      }`,
      { id: versionId }
    );
    return result.rental_inspection_media ?? [];
  }

  private async stageForAdmin(bookingId: string, stage: InspectionStage) {
    const inspection = await this.inspectionFor(bookingId, stage);
    const body = await this.viewOf(bookingId, inspection, 'admin');
    const presented = presentInspection(body, 'admin');
    const units = await this.withPhotoUrls(bookingId, body.units);
    return { ...presented, minPhotos: await this.minPhotoCount(), correctionReason: body.correctionReason, units };
  }

  private async withPhotoUrls(
    bookingId: string,
    units: Array<{ photos: Array<{ id: string; role: string }> }>
  ) {
    return Promise.all(
      units.map(async (unit) => ({
        ...unit,
        photos: await Promise.all(
          unit.photos.map(async (photo) => {
            try {
              const signed = await this.evidence.signForStaff(bookingId, photo.id);
              return { ...photo, url: signed.url, expiresAt: signed.expiresAt };
            } catch {
              return photo;
            }
          })
        ),
      }))
    );
  }

  private async adminBooking(bookingId: string) {
    const result = await this.hasura.executeQuery<{
      rental_bookings_by_pk: {
        id: string;
        booking_number: string;
        status: string;
        currency: string;
        units_booked: number;
        payment_timing: string | null;
        payment_status: string | null;
        security_deposit_amount: number | null;
        authorized_amount: number | null;
        inspection_policy_version: number | null;
        return_resolution: string | null;
        return_handed_back_at: string | null;
        settlement_attention: string | null;
        rental_location_listing?: { rental_item?: { name?: string } | null } | null;
      } | null;
    }>(
      `query AdminInspectionBooking($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id booking_number status currency units_booked
          payment_timing payment_status security_deposit_amount authorized_amount
          inspection_policy_version return_resolution return_handed_back_at settlement_attention
          rental_location_listing { rental_item { name } }
        }
      }`,
      { id: bookingId }
    );
    const row = result.rental_bookings_by_pk;
    if (!row) throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    return {
      id: row.id,
      bookingNumber: row.booking_number,
      status: row.status,
      currency: row.currency,
      unitsBooked: row.units_booked,
      paymentTiming: row.payment_timing,
      paymentStatus: row.payment_status,
      securityDepositAmount: row.security_deposit_amount,
      authorizedAmount: row.authorized_amount,
      inspectionPolicyVersion: row.inspection_policy_version,
      returnResolution: row.return_resolution,
      returnHandedBackAt: row.return_handed_back_at,
      settlementAttention: row.settlement_attention,
      itemName: row.rental_location_listing?.rental_item?.name ?? null,
    };
  }

  private async disputesFor(bookingId: string) {
    const result = await this.hasura.executeQuery<{
      rental_inspection_disputes: Array<Record<string, unknown>>;
    }>(
      `query BookingInspectionDisputes($id: uuid!) {
        rental_inspection_disputes(
          where: { rental_booking_id: { _eq: $id } }
          order_by: { opened_at: desc }
        ) {
          id version_id status reason opened_at sla_due_at escalated_at
          decision decision_reason damage_amount decided_at
        }
      }`,
      { id: bookingId }
    );
    return result.rental_inspection_disputes ?? [];
  }

  private async one<T extends Record<string, unknown>>(
    field: string,
    mutation: string,
    variables: Record<string, unknown>
  ): Promise<T | null> {
    const result = await this.hasura.executeMutation<Record<string, T[]>>(mutation, variables);
    return result[field]?.[0] ?? null;
  }
}
