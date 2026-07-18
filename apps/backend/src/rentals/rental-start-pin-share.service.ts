import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { DeliveryPinService } from '../delivery-pin/delivery-pin.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isActivePersona } from '../users/persona.util';
import type { DeliveryPinPayloadV1 } from '../messaging/structured/structured-message.types';
import type { RentalBookingMessage } from './rental-booking-messaging.service';

const ENTITY_TYPE = 'rental_booking';
const MESSAGE_TYPE = 'RENTAL_START_PIN';
const SHARE_RATE_LIMIT_MS = 10 * 60 * 1000;
const MAX_SHARES_PER_WINDOW = 3;

type BookingRow = {
  id: string;
  booking_number?: string | null;
  status: string;
  client_id: string;
  business_id: string;
  rental_start_pin_hash?: string | null;
  client?: { user_id?: string | null; user?: { first_name?: string | null; last_name?: string | null } | null } | null;
  business?: { user_id?: string | null; user?: { first_name?: string | null; last_name?: string | null } | null } | null;
};

@Injectable()
export class RentalStartPinShareService {
  private readonly logger = new Logger(RentalStartPinShareService.name);
  private readonly recentShareTimestamps = new Map<string, number[]>();

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly deliveryPinService: DeliveryPinService,
    private readonly notificationsService: NotificationsService
  ) {}

  async shareStartPin(bookingId: string): Promise<RentalBookingMessage> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'client') || !user.client?.id) {
      throw new HttpException('Only clients can share the start PIN', HttpStatus.FORBIDDEN);
    }
    const booking = await this.loadBooking(bookingId);
    if (booking.client_id !== user.client.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (booking.status !== 'confirmed') {
      throw new HttpException(
        'Start PIN can only be shared for confirmed bookings',
        HttpStatus.BAD_REQUEST
      );
    }
    const businessUserId = booking.business?.user_id;
    if (!businessUserId) {
      throw new HttpException('Business user not found', HttpStatus.BAD_REQUEST);
    }
    this.assertRateLimit(bookingId);
    const pin = await this.deliveryPinService.getPinForClient(bookingId);
    if (!pin) {
      throw new HttpException('Start PIN is not available', HttpStatus.NOT_FOUND);
    }
    const pinVersion = await this.nextPinVersion(bookingId);
    await this.supersedeActive(bookingId);
    const payload = this.buildPayload(pin, businessUserId, pinVersion);
    const businessName = nameOf(booking.business?.user);
    const displayMessage = JSON.stringify({
      i18nKey: 'rentals.messaging.startPin.shared',
      params: { businessName },
    });
    const created = await this.insertPinMessage(user.id, bookingId, displayMessage, payload);
    await this.insertMention(created.id, businessUserId);
    await this.notifyBusiness(booking, user.id, created.id, created.user);
    return this.toSharedMessage(created, payload, pin, 'client');
  }

  async getActiveStartPinForBusiness(bookingId: string): Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null> {
    const user = await this.hasuraUserService.getUser();
    if (!isActivePersona(user, 'business') || !user.business?.id) {
      throw new HttpException('Business only', HttpStatus.FORBIDDEN);
    }
    const booking = await this.loadBooking(bookingId);
    if (booking.business_id !== user.business.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
    if (booking.status !== 'confirmed') return null;
    const message = await this.findLatestActive(bookingId);
    if (!message) return null;
    const payload = message.message_payload as DeliveryPinPayloadV1;
    if (payload.sharedToUserId !== user.id || payload.status !== 'active') {
      return null;
    }
    const pin = this.deliveryPinService.decryptPinFromMessage(payload.pinCiphertext);
    if (!pin) return null;
    if (
      booking.rental_start_pin_hash &&
      !this.deliveryPinService.verifyPin(
        bookingId,
        pin,
        booking.rental_start_pin_hash
      )
    ) {
      await this.markSuperseded(message.id);
      return null;
    }
    return {
      messageId: message.id,
      pin,
      pinVersion: payload.pinVersion,
      sharedAt: message.created_at,
    };
  }

  async resolvePinForVerify(
    bookingId: string,
    businessUserId: string,
    options: { pinMessageId?: string; useLatestSharedPin?: boolean }
  ): Promise<string | null> {
    if (!options.useLatestSharedPin && !options.pinMessageId) return null;
    const message = options.pinMessageId
      ? await this.findMessageById(bookingId, options.pinMessageId)
      : await this.findLatestActive(bookingId);
    if (!message) return null;
    const payload = message.message_payload as DeliveryPinPayloadV1;
    if (payload.status !== 'active' || payload.sharedToUserId !== businessUserId) {
      return null;
    }
    return this.deliveryPinService.decryptPinFromMessage(payload.pinCiphertext);
  }

  enrichPinPayload(
    payload: Record<string, unknown>,
    viewerUserId: string,
    viewerPersona: 'client' | 'business',
    booking: BookingRow
  ): Record<string, unknown> | null {
    const p = payload as DeliveryPinPayloadV1;
    if (p.version !== 1) return null;
    const base = {
      status: p.status,
      pinVersion: p.pinVersion,
      sharedToUserId: p.sharedToUserId,
      sharedToDisplayName: nameOf(booking.business?.user),
      maskedDisplay: p.maskedDisplay ?? '****',
      supersededByMessageId: p.supersededByMessageId,
      revokedAt: p.revokedAt,
      revokedReason: p.revokedReason,
    };
    const canSee =
      p.status === 'active' &&
      ((viewerPersona === 'business' && viewerUserId === p.sharedToUserId) ||
        (viewerPersona === 'client' &&
          viewerUserId === booking.client?.user_id));
    if (!canSee) return base;
    const pin = this.deliveryPinService.decryptPinFromMessage(p.pinCiphertext);
    return pin ? { ...base, pin } : base;
  }

  private buildPayload(
    pin: string,
    sharedToUserId: string,
    pinVersion: number
  ): DeliveryPinPayloadV1 {
    return {
      version: 1,
      status: 'active',
      pinVersion,
      sharedToUserId,
      pinCiphertext: this.deliveryPinService.encryptPinForMessage(pin),
      maskedDisplay: '****',
    };
  }

  private async loadBooking(bookingId: string): Promise<BookingRow> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_by_pk: BookingRow | null;
    }>(
      `query BookingPinShare($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id booking_number status client_id business_id rental_start_pin_hash
          client { user_id user { first_name last_name } }
          business { user_id user { first_name last_name } }
        }
      }`,
      { id: bookingId }
    );
    if (!r.rental_bookings_by_pk) {
      throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
    }
    return r.rental_bookings_by_pk;
  }

  private assertRateLimit(bookingId: string): void {
    const now = Date.now();
    const prev = (this.recentShareTimestamps.get(bookingId) ?? []).filter(
      (ts) => now - ts < SHARE_RATE_LIMIT_MS
    );
    if (prev.length >= MAX_SHARES_PER_WINDOW) {
      throw new HttpException(
        'Too many PIN shares. Try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    prev.push(now);
    this.recentShareTimestamps.set(bookingId, prev);
  }

  private async nextPinVersion(bookingId: string): Promise<number> {
    const r = await this.hasuraSystemService.executeQuery<{
      user_messages_aggregate: { aggregate: { count: number } };
    }>(
      `query PinVersion($bookingId: uuid!, $entityType: entity_types_enum!) {
        user_messages_aggregate(
          where: {
            entity_id: { _eq: $bookingId }
            entity_type: { _eq: $entityType }
            message_type: { _eq: "${MESSAGE_TYPE}" }
          }
        ) { aggregate { count } }
      }`,
      { bookingId, entityType: ENTITY_TYPE }
    );
    return (r.user_messages_aggregate?.aggregate?.count ?? 0) + 1;
  }

  private async supersedeActive(bookingId: string): Promise<void> {
    const active = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{ id: string; message_payload: DeliveryPinPayloadV1 }>;
    }>(
      `query ActivePins($bookingId: uuid!, $entityType: entity_types_enum!) {
        user_messages(
          where: {
            entity_id: { _eq: $bookingId }
            entity_type: { _eq: $entityType }
            message_type: { _eq: "${MESSAGE_TYPE}" }
          }
        ) { id message_payload }
      }`,
      { bookingId, entityType: ENTITY_TYPE }
    );
    for (const msg of active.user_messages ?? []) {
      if (msg.message_payload?.status !== 'active') continue;
      await this.markSuperseded(msg.id);
    }
  }

  private async markSuperseded(messageId: string): Promise<void> {
    const r = await this.hasuraSystemService.executeQuery<{
      user_messages_by_pk: { message_payload: DeliveryPinPayloadV1 } | null;
    }>(
      `query Msg($id: uuid!) {
        user_messages_by_pk(id: $id) { message_payload }
      }`,
      { id: messageId }
    );
    const payload = r.user_messages_by_pk?.message_payload;
    if (!payload || payload.status !== 'active') return;
    await this.hasuraSystemService.executeMutation(
      `mutation Supersede($id: uuid!, $payload: jsonb!) {
        update_user_messages_by_pk(
          pk_columns: { id: $id }
          _set: { message_payload: $payload }
        ) { id }
      }`,
      {
        id: messageId,
        payload: {
          ...payload,
          status: 'superseded',
          revokedReason: 'manual_resend',
        },
      }
    );
  }

  private async insertPinMessage(
    userId: string,
    bookingId: string,
    message: string,
    payload: DeliveryPinPayloadV1
  ) {
    const r = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: any | null;
    }>(
      `mutation InsertRentalStartPin(
        $user_id: uuid!
        $entity_type: entity_types_enum!
        $entity_id: uuid!
        $message: String!
        $message_payload: jsonb!
      ) {
        insert_user_messages_one(object: {
          user_id: $user_id
          entity_type: $entity_type
          entity_id: $entity_id
          message: $message
          message_type: ${MESSAGE_TYPE}
          message_payload: $message_payload
          is_immutable: true
        }) {
          id user_id entity_type entity_id message created_at updated_at
          user { id email first_name last_name }
        }
      }`,
      {
        user_id: userId,
        entity_type: ENTITY_TYPE,
        entity_id: bookingId,
        message,
        message_payload: payload,
      }
    );
    if (!r.insert_user_messages_one) {
      throw new HttpException('Failed to create PIN message', HttpStatus.BAD_GATEWAY);
    }
    return r.insert_user_messages_one;
  }

  private async insertMention(messageId: string, mentionedUserId: string) {
    await this.hasuraSystemService.executeMutation(
      `mutation InsertMention(
        $message_id: uuid!
        $mentioned_user_id: uuid!
        $mentioned_persona: String!
      ) {
        insert_message_mentions_one(object: {
          message_id: $message_id
          mentioned_user_id: $mentioned_user_id
          mentioned_persona: $mentioned_persona
        }) { id }
      }`,
      {
        message_id: messageId,
        mentioned_user_id: mentionedUserId,
        mentioned_persona: 'business',
      }
    );
  }

  private async findLatestActive(bookingId: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{
        id: string;
        created_at: string;
        message_payload: DeliveryPinPayloadV1;
      }>;
    }>(
      `query LatestActivePin($bookingId: uuid!, $entityType: entity_types_enum!) {
        user_messages(
          where: {
            entity_id: { _eq: $bookingId }
            entity_type: { _eq: $entityType }
            message_type: { _eq: "${MESSAGE_TYPE}" }
          }
          order_by: { created_at: desc }
          limit: 20
        ) { id created_at message_payload }
      }`,
      { bookingId, entityType: ENTITY_TYPE }
    );
    return (
      (r.user_messages ?? []).find((m) => m.message_payload?.status === 'active') ??
      null
    );
  }

  private async findMessageById(bookingId: string, messageId: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{
        id: string;
        created_at: string;
        message_payload: DeliveryPinPayloadV1;
      }>;
    }>(
      `query PinMsg($bookingId: uuid!, $messageId: uuid!, $entityType: entity_types_enum!) {
        user_messages(
          where: {
            id: { _eq: $messageId }
            entity_id: { _eq: $bookingId }
            entity_type: { _eq: $entityType }
            message_type: { _eq: "${MESSAGE_TYPE}" }
          }
          limit: 1
        ) { id created_at message_payload }
      }`,
      { bookingId, messageId, entityType: ENTITY_TYPE }
    );
    return r.user_messages?.[0] ?? null;
  }

  private async notifyBusiness(
    booking: BookingRow,
    senderUserId: string,
    messageId: string,
    senderUser?: { first_name?: string | null; last_name?: string | null }
  ): Promise<void> {
    const recipientUserId = booking.business?.user_id;
    if (!recipientUserId || recipientUserId === senderUserId) return;
    try {
      await this.notificationsService.sendRentalStartPinSharedPush({
        recipientUserId,
        bookingId: booking.id,
        bookingNumber: booking.booking_number ?? '',
        senderName: nameOf(senderUser),
        messageId,
      });
    } catch (error: any) {
      this.logger.warn(
        `rental start pin push failed: ${error?.message ?? String(error)}`
      );
    }
  }

  private toSharedMessage(
    created: any,
    payload: DeliveryPinPayloadV1,
    pin: string,
    senderPersona: 'client'
  ): RentalBookingMessage {
    return {
      id: created.id,
      user_id: created.user_id,
      entity_type: created.entity_type,
      entity_id: created.entity_id,
      message: created.message,
      created_at: created.created_at,
      updated_at: created.updated_at,
      user: created.user,
      sender_persona: senderPersona,
      message_type: MESSAGE_TYPE,
      structured_content: {
        status: payload.status,
        pinVersion: payload.pinVersion,
        sharedToUserId: payload.sharedToUserId,
        maskedDisplay: '****',
        pin,
      },
      mention: {
        mentionedUserId: payload.sharedToUserId,
        persona: 'business',
        displayName: '',
      },
    };
  }
}

function nameOf(user?: {
  first_name?: string | null;
  last_name?: string | null;
} | null): string {
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Someone';
}
