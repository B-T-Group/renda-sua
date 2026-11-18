import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { RentalInspectionFlags } from '../inspection/rental-inspection-flags.service';
import { INSERT_RENTAL_STATUS_HISTORY } from '../rentals-queries';
import { exclusionAllowed } from './decline-ranking.policy';
import { DeclineRankingService } from './decline-ranking.service';
import { ACTOR_ROLES, DECLINE_FOR_EXCLUSION, EXCLUSION_ROWS, SET_EXCLUSION } from './decline-ranking.queries';

const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

interface ExclusionDecline {
  id: string;
  reason: string;
  reason_text?: string | null;
  excluded_at?: string | null;
  exclusion_note?: string | null;
  rental_booking?: {
    id: string;
    booking_number?: string | null;
    status?: string | null;
    business_id?: string;
    client_id?: string;
    business?: { name?: string | null } | null;
    client?: { user?: { first_name?: string | null; last_name?: string | null } | null } | null;
  } | null;
}

interface ExclusionSnapshot {
  rental_condition_declines: ExclusionDecline[];
  rental_condition_decline_counts_90d: Array<{ role: 'renter' | 'business'; party_id: string; decline_count: number }>;
  rental_business_pickup_reach_90d: Array<{ business_id: string; pickups_reached: number }>;
}

export interface ExclusionRow {
  id: string;
  bookingId: string;
  bookingNumber: string;
  businessName: string;
  renterName: string;
  reason: string;
  excluded: boolean;
  note: string;
  businessDeclines: number;
  renterDeclines: number;
}

@Injectable()
export class DeclineExclusionService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly flags: RentalInspectionFlags,
    private readonly ranking: DeclineRankingService
  ) {}

  async list(): Promise<{ rows: ExclusionRow[] }> {
    await this.assertOn();
    const snapshot = await this.hasura.executeQuery<ExclusionSnapshot>(EXCLUSION_ROWS, { since: this.since() });
    return { rows: (snapshot.rental_condition_declines ?? []).map((row) => this.row(row, snapshot)) };
  }

  async set(bookingId: string, userId: string, excluded: boolean, note?: string): Promise<{ excluded: boolean }> {
    await this.assertOn();
    await this.assertSupport(userId);
    const decline = await this.find(bookingId);
    await this.write(decline, userId, excluded, note);
    this.ranking.clearCache();
    return { excluded };
  }

  private async assertOn(): Promise<void> {
    if (!(await this.flags.declineRankingEnabled())) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
  }

  private async assertSupport(userId: string): Promise<void> {
    const result = await this.hasura.executeQuery<{ user_roles: Array<{ role?: { key?: string | null } | null }> }>(
      ACTOR_ROLES,
      { id: userId }
    );
    const roles = (result.user_roles ?? []).map((row) => row.role?.key ?? '').filter(Boolean);
    if (!exclusionAllowed(roles)) throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
  }

  private async find(bookingId: string): Promise<ExclusionDecline> {
    const result = await this.hasura.executeQuery<{ rental_condition_declines: ExclusionDecline[] }>(
      DECLINE_FOR_EXCLUSION,
      { bookingId }
    );
    const decline = result.rental_condition_declines?.[0];
    if (!decline?.rental_booking) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return decline;
  }

  private async write(decline: ExclusionDecline, userId: string, excluded: boolean, note?: string): Promise<void> {
    const now = new Date().toISOString();
    await this.hasura.executeMutation(SET_EXCLUSION, { id: decline.id, set: this.patch(userId, excluded, note, now) });
    await this.hasura.executeMutation(INSERT_RENTAL_STATUS_HISTORY, { object: this.history(decline, userId, excluded, note) });
  }

  private patch(userId: string, excluded: boolean, note: string | undefined, now: string) {
    if (!excluded) return { excluded_by: null, excluded_at: null, exclusion_note: null };
    return { excluded_by: userId, excluded_at: now, exclusion_note: (note ?? '').trim() || null };
  }

  private history(decline: ExclusionDecline, userId: string, excluded: boolean, note?: string) {
    const action = excluded ? 'Support excluded this condition decline' : 'Support restored this condition decline';
    const extra = (note ?? '').trim();
    return {
      rental_booking_id: decline.rental_booking?.id,
      status: decline.rental_booking?.status ?? 'cancelled',
      previous_status: decline.rental_booking?.status ?? 'cancelled',
      changed_by_user_id: userId,
      changed_by_type: 'system',
      notes: extra ? `${action}. ${extra}` : action,
    };
  }

  private row(decline: ExclusionDecline, snapshot: ExclusionSnapshot): ExclusionRow {
    const booking = decline.rental_booking;
    const user = booking?.client?.user;
    return {
      id: decline.id,
      bookingId: booking?.id ?? '',
      bookingNumber: booking?.booking_number ?? '',
      businessName: booking?.business?.name ?? '',
      renterName: [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      reason: decline.reason_text || decline.reason,
      excluded: Boolean(decline.excluded_at),
      note: decline.exclusion_note ?? '',
      businessDeclines: this.count(snapshot, 'business', booking?.business_id),
      renterDeclines: this.count(snapshot, 'renter', booking?.client_id),
    };
  }

  private count(snapshot: ExclusionSnapshot, role: 'business' | 'renter', partyId?: string): number {
    if (!partyId) return 0;
    const row = (snapshot.rental_condition_decline_counts_90d ?? []).find(
      (item) => item.role === role && item.party_id === partyId
    );
    return row?.decline_count ?? 0;
  }

  private since(): string {
    return new Date(Date.now() - WINDOW_MS).toISOString();
  }
}
