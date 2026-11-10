import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isActivePersona } from '../users/persona.util';
import { CreateRentalAvailabilitySubscriptionDto } from './dto/rental-search.dto';
import { parseSearchDateRange } from './rental-search.dates';
import { buildRentalAvailablePush } from '../notifications/rental-push.messages';

const SUBSCRIPTION_TTL_MS = 30 * 86_400_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class RentalAvailabilityService {
  private readonly logger = new Logger(RentalAvailabilityService.name);

  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly users: HasuraUserService,
    private readonly notifications: NotificationsService
  ) {}

  async subscribe(dto: CreateRentalAvailabilitySubscriptionDto) {
    const user = await this.users.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id || !user.id) {
      throw new HttpException('Only clients can subscribe', HttpStatus.FORBIDDEN);
    }
    const range = this.range(dto.start_date, dto.end_date);
    const queryNorm = normalizeQuery(dto.q);
    if (!queryNorm && !dto.category_id) {
      throw new HttpException('A search or category is required', HttpStatus.BAD_REQUEST);
    }
    const existing = await this.findActive(user.id, queryNorm, dto, range);
    if (existing) return existing;
    return this.insert(user.id, user.client.id, queryNorm, dto, range);
  }

  async cancel(id: string) {
    const user = await this.users.getUser();
    if (!user?.id) throw new HttpException('Sign in required', HttpStatus.UNAUTHORIZED);
    const res = await this.hasura.executeMutation<{ update_rental_availability_subscriptions: { affected_rows: number } }>(
      CANCEL,
      { id, userId: user.id }
    );
    if (!res.update_rental_availability_subscriptions?.affected_rows) {
      throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  async deliverDue(): Promise<number> {
    await this.expireOld();
    await this.scanOpen();
    const claimed = await this.claimQueued();
    let sent = 0;
    for (const notice of claimed) {
      if (await this.deliverOne(notice)) sent += 1;
    }
    return sent;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleAvailabilityNotices(): Promise<void> {
    try {
      const sent = await this.deliverDue();
      if (sent > 0) this.logger.log(`Sent ${sent} rental availability notice(s)`);
    } catch (error: any) {
      if (schemaMissing(error)) {
        this.logger.warn('rental availability notices skipped: schema is not applied yet');
        return;
      }
      this.logger.error(error?.message ?? String(error));
    }
  }

  private range(start: string, end: string) {
    try {
      const parsed = parseSearchDateRange(start, end);
      if (!parsed) throw new Error('missing');
      return parsed;
    } catch {
      throw new HttpException('start_date and end_date must be a range of 1 to 30 days', HttpStatus.BAD_REQUEST);
    }
  }

  private async findActive(
    userId: string,
    queryNorm: string,
    dto: CreateRentalAvailabilitySubscriptionDto,
    range: { startMs: number; endMs: number }
  ) {
    const res = await this.hasura.executeQuery<{ rental_availability_subscriptions: SubRow[] }>(FIND_ACTIVE, {
      userId,
      queryNorm,
      start: new Date(range.startMs).toISOString(),
      end: new Date(range.endMs).toISOString(),
    });
    const row = (res.rental_availability_subscriptions ?? []).find((item) =>
      (item.category_id ?? null) === (dto.category_id ?? null)
    );
    return row ? toDto(row) : null;
  }

  private async insert(
    userId: string,
    clientId: string,
    queryNorm: string,
    dto: CreateRentalAvailabilitySubscriptionDto,
    range: { startMs: number; endMs: number; startDate: string; endDate: string }
  ) {
    try {
      const res = await this.hasura.executeMutation<{ insert_rental_availability_subscriptions_one: SubRow }>(
        INSERT_SUB,
        { object: subscriptionObject(userId, clientId, queryNorm, dto, range) }
      );
      return toDto(res.insert_rental_availability_subscriptions_one);
    } catch (error: any) {
      if (!isUnique(error)) throw error;
      const again = await this.findActive(userId, queryNorm, dto, range);
      if (again) return again;
      throw error;
    }
  }

  private async expireOld(): Promise<void> {
    await this.hasura.executeMutation(EXPIRE, { now: new Date().toISOString() });
  }

  private async scanOpen(): Promise<void> {
    await this.hasura.executeMutation(SCAN, {});
  }

  private async claimQueued(): Promise<NoticeRow[]> {
    const queued = await this.hasura.executeQuery<{ rental_availability_notices: NoticeRow[] }>(LIST_QUEUED, {});
    const ids = (queued.rental_availability_notices ?? []).map((row) => row.id);
    if (!ids.length) return [];
    const claimed = await this.hasura.executeMutation<{
      update_rental_availability_notices: { returning: NoticeRow[] };
    }>(CLAIM, { ids });
    return claimed.update_rental_availability_notices?.returning ?? [];
  }

  private async deliverOne(notice: NoticeRow): Promise<boolean> {
    try {
      const detail = await this.loadDetail(notice.id);
      if (!detail) {
        await this.markRetry(notice, 'notice detail missing');
        return false;
      }
      const copy = buildRentalAvailablePush(detail);
      await this.notifications.sendRentalAvailabilityNotice({
        userId: detail.userId,
        listingId: detail.listingId,
        title: copy.title,
        body: copy.body,
      });
      await this.hasura.executeMutation(MARK_SENT, { id: notice.id, now: new Date().toISOString() });
      return true;
    } catch (error: any) {
      await this.markRetry(notice, error?.message ?? String(error));
      return false;
    }
  }

  private async loadDetail(id: string): Promise<NoticeDetail | null> {
    const res = await this.hasura.executeQuery<{ rental_availability_notices_by_pk: DetailRow | null }>(DETAIL, { id });
    const row = res.rental_availability_notices_by_pk;
    if (!row?.listing || !row.subscription) return null;
    return {
      userId: row.user_id,
      listingId: row.listing_id,
      itemName: row.listing.rental_item?.name ?? 'Rental',
      preferredLanguage: row.user?.preferred_language,
      startAt: row.subscription.start_at,
      endAt: row.subscription.end_at,
    };
  }

  private async markRetry(notice: NoticeRow, message: string): Promise<void> {
    const attempts = notice.attempts + 1;
    await this.hasura.executeMutation(MARK_RETRY, {
      id: notice.id,
      attempts,
      status: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued',
      lastError: message.slice(0, 500),
    });
    this.logger.warn(`rental availability notice ${notice.id} failed: ${message}`);
  }
}

function normalizeQuery(value?: string): string {
  return (value ?? '').trim().toLowerCase().replace(/[%_\\]/g, '').slice(0, 80);
}

function subscriptionObject(
  userId: string,
  clientId: string,
  queryNorm: string,
  dto: CreateRentalAvailabilitySubscriptionDto,
  range: { startMs: number; endMs: number }
) {
  return {
    user_id: userId,
    client_id: clientId,
    country_code: dto.country_code?.trim() || null,
    state: dto.state?.trim() || null,
    query_text: (dto.q ?? '').trim().slice(0, 120),
    query_norm: queryNorm,
    category_id: dto.category_id ?? null,
    start_at: new Date(range.startMs).toISOString(),
    end_at: new Date(range.endMs).toISOString(),
    status: 'active',
    expires_at: new Date(Date.now() + SUBSCRIPTION_TTL_MS).toISOString(),
  };
}

function toDto(row: SubRow) {
  return {
    id: row.id,
    status: row.status,
    expiresAt: row.expires_at,
    startAt: row.start_at,
    endAt: row.end_at,
  };
}

function isUnique(error: any): boolean {
  const text = String(error?.message ?? error);
  return text.includes('rental_availability_subs_active_uidx') || text.includes('Uniqueness violation');
}

function schemaMissing(error: any): boolean {
  const text = String(error?.message ?? error);
  return text.includes('rental_availability_') && text.includes('not found');
}

interface SubRow {
  id: string;
  status: string;
  expires_at: string;
  start_at: string;
  end_at: string;
  category_id?: string | null;
}

interface NoticeRow {
  id: string;
  attempts: number;
  user_id: string;
  listing_id: string;
}

interface DetailRow {
  user_id: string;
  listing_id: string;
  user?: { preferred_language?: string | null } | null;
  subscription?: { start_at: string; end_at: string } | null;
  listing?: { rental_item?: { name?: string | null } | null } | null;
}

interface NoticeDetail {
  userId: string;
  listingId: string;
  itemName: string;
  preferredLanguage?: string | null;
  startAt: string;
  endAt: string;
}

const FIND_ACTIVE = `
  query FindRentalAvailabilitySub($userId: uuid!, $queryNorm: String!, $start: timestamptz!, $end: timestamptz!) {
    rental_availability_subscriptions(where: {
      user_id: { _eq: $userId }
      query_norm: { _eq: $queryNorm }
      start_at: { _eq: $start }
      end_at: { _eq: $end }
      status: { _eq: "active" }
    }, limit: 5) {
      id status expires_at start_at end_at category_id
    }
  }
`;

const INSERT_SUB = `
  mutation InsertRentalAvailabilitySub($object: rental_availability_subscriptions_insert_input!) {
    insert_rental_availability_subscriptions_one(object: $object) {
      id status expires_at start_at end_at category_id
    }
  }
`;

const CANCEL = `
  mutation CancelRentalAvailabilitySub($id: uuid!, $userId: uuid!) {
    update_rental_availability_subscriptions(
      where: { id: { _eq: $id }, user_id: { _eq: $userId }, status: { _eq: "active" } }
      _set: { status: "cancelled" }
    ) { affected_rows }
  }
`;

const EXPIRE = `
  mutation ExpireRentalAvailabilitySubs($now: timestamptz!) {
    update_rental_availability_subscriptions(
      where: { status: { _eq: "active" }, expires_at: { _lt: $now } }
      _set: { status: "expired" }
    ) { affected_rows }
  }
`;

const SCAN = `
  mutation ScanRentalAvailability {
    rental_availability_scan { id }
  }
`;

const LIST_QUEUED = `
  query QueuedRentalAvailabilityNotices {
    rental_availability_notices(where: { status: { _eq: "queued" } }, limit: 20, order_by: { created_at: asc }) {
      id attempts user_id listing_id
    }
  }
`;

const CLAIM = `
  mutation ClaimRentalAvailabilityNotices($ids: [uuid!]!) {
    update_rental_availability_notices(
      where: { id: { _in: $ids }, status: { _eq: "queued" } }
      _set: { status: "sending" }
    ) { returning { id attempts user_id listing_id } }
  }
`;

const DETAIL = `
  query RentalAvailabilityNotice($id: uuid!) {
    rental_availability_notices_by_pk(id: $id) {
      user_id
      listing_id
      user { preferred_language }
      subscription { start_at end_at }
      listing { rental_item { name } }
    }
  }
`;

const MARK_SENT = `
  mutation MarkRentalAvailabilitySent($id: uuid!, $now: timestamptz!) {
    update_rental_availability_notices_by_pk(
      pk_columns: { id: $id }
      _set: { status: "sent", sent_at: $now }
    ) { id }
  }
`;

const MARK_RETRY = `
  mutation RetryRentalAvailabilityNotice($id: uuid!, $attempts: Int!, $status: String!, $lastError: String!) {
    update_rental_availability_notices_by_pk(
      pk_columns: { id: $id }
      _set: { status: $status, attempts: $attempts, last_error: $lastError }
    ) { id }
  }
`;
