import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import { RentalInspectionFlags } from '../inspection/rental-inspection-flags.service';
import { DECLINE_FLAG_THRESHOLD, renterPartyName } from './pickup-decline.policy';
import * as Q from './pickup-decline.queries';

const EMPTY = '00000000-0000-0000-0000-000000000000';

export interface DeclineCountRow {
  id: string;
  role: 'renter' | 'business';
  partyId: string;
  name: string;
  declineCount: number;
  pickupsReached: number | null;
  lastDeclineAt: string | null;
  flagged: boolean;
}

interface CountRow {
  id: string;
  role: 'renter' | 'business';
  party_id: string;
  decline_count: number;
  last_decline_at: string | null;
}

@Injectable()
export class RentalDeclineCountsService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly flags: RentalInspectionFlags
  ) {}

  async list(): Promise<{ threshold: number; parties: DeclineCountRow[] }> {
    if (!(await this.flags.pickupDeclineEnabled())) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const counts = await this.hasura.executeQuery<{
      rental_condition_decline_counts_90d: CountRow[];
      rental_business_pickup_reach_90d: Array<{ business_id: string; pickups_reached: number }>;
    }>(Q.COUNTS_90, {});
    const rows = counts.rental_condition_decline_counts_90d ?? [];
    const names = await this.names(rows);
    const reached = new Map(
      (counts.rental_business_pickup_reach_90d ?? []).map((row) => [row.business_id, row.pickups_reached])
    );
    return { threshold: DECLINE_FLAG_THRESHOLD, parties: rows.map((row) => this.party(row, names, reached)) };
  }

  async forBusiness(businessId: string): Promise<{ conditionDeclines90d: number; pickupsReached90d: number } | null> {
    if (!(await this.flags.pickupDeclineEnabled())) return null;
    try {
      const result = await this.hasura.executeQuery<{
        rental_condition_decline_counts_90d: Array<{ decline_count: number }>;
        rental_business_pickup_reach_90d: Array<{ pickups_reached: number }>;
      }>(Q.BUSINESS_DECLINE_STAT, { id: businessId });
      return {
        conditionDeclines90d: result.rental_condition_decline_counts_90d?.[0]?.decline_count ?? 0,
        pickupsReached90d: result.rental_business_pickup_reach_90d?.[0]?.pickups_reached ?? 0,
      };
    } catch (error: any) {
      void error;
      return null;
    }
  }

  private party(
    row: CountRow,
    names: Map<string, string>,
    reached: Map<string, number>
  ): DeclineCountRow {
    return {
      id: row.id,
      role: row.role,
      partyId: row.party_id,
      name: names.get(`${row.role}:${row.party_id}`) ?? '',
      declineCount: row.decline_count,
      pickupsReached: row.role === 'business' ? reached.get(row.party_id) ?? 0 : null,
      lastDeclineAt: row.last_decline_at,
      flagged: row.decline_count >= DECLINE_FLAG_THRESHOLD,
    };
  }

  private async names(rows: CountRow[]): Promise<Map<string, string>> {
    const clients = rows.filter((row) => row.role === 'renter').map((row) => row.party_id);
    const businesses = rows.filter((row) => row.role === 'business').map((row) => row.party_id);
    const result = await this.hasura.executeQuery<{
      clients: Array<{ id: string; user?: { first_name?: string | null; last_name?: string | null } }>;
      businesses: Array<{ id: string; name?: string | null }>;
    }>(Q.PARTY_NAMES, {
      clients: clients.length > 0 ? clients : [EMPTY],
      businesses: businesses.length > 0 ? businesses : [EMPTY],
    });
    const names = new Map<string, string>();
    for (const client of result.clients ?? []) {
      names.set(
        `renter:${client.id}`,
        renterPartyName(client.user?.first_name, client.user?.last_name, client.id)
      );
    }
    for (const business of result.businesses ?? []) names.set(`business:${business.id}`, business.name ?? '');
    return names;
  }
}
