import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { PersonaId } from '../users/persona.types';
import { isActivePersona } from '../users/persona.util';
import { RentalStartPinShareService } from './rental-start-pin-share.service';

const ENTITY_TYPE = 'rental_booking';

type BookingMessagingRow = {
  id: string;
  booking_number?: string | null;
  client_id: string;
  business_id: string;
  client?: {
    user_id?: string | null;
    user?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
  business?: {
    user_id?: string | null;
    user?: { first_name?: string | null; last_name?: string | null } | null;
  } | null;
};

export type RentalBookingMessage = {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  message: string;
  created_at: string;
  updated_at: string;
  sender_persona?: PersonaId;
  message_type?: string;
  structured_content?: Record<string, unknown> | null;
  user?: {
    id: string;
    email?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  mention?: {
    mentionedUserId: string;
    persona: PersonaId;
    displayName: string;
  } | null;
};

@Injectable()
export class RentalBookingMessagingService {
  private readonly logger = new Logger(RentalBookingMessagingService.name);

  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly notificationsService: NotificationsService,
    private readonly rentalStartPinShare: RentalStartPinShareService
  ) {}

  async getMessages(bookingId: string): Promise<RentalBookingMessage[]> {
    const user = await this.hasuraUserService.getUser();
    const booking = await this.loadBooking(bookingId);
    this.assertAccess(user, booking);
    const rows = await this.fetchMessageRows(bookingId);
    const viewerPersona = this.resolvePersona(user, booking);
    return rows.map((msg) => this.toMessage(msg, booking, undefined, user.id, viewerPersona));
  }

  async createMessage(
    bookingId: string,
    message: string,
    mentionedUserId?: string
  ): Promise<RentalBookingMessage> {
    const user = await this.hasuraUserService.getUser();
    const booking = await this.loadBooking(bookingId);
    this.assertAccess(user, booking);
    if (!message?.trim()) {
      throw new HttpException('Message cannot be empty', HttpStatus.BAD_REQUEST);
    }
    const senderPersona = this.resolvePersona(user, booking);
    this.assertMentionAllowed(booking, user.id, mentionedUserId);
    const created = await this.insertMessage(user.id, bookingId, message.trim());
    if (mentionedUserId) {
      const persona = this.personaForUser(booking, mentionedUserId);
      await this.insertMention(created.id, mentionedUserId, persona);
    }
    await this.notifyOtherParty(booking, user.id, created.id, created.user);
    return this.toMessage(
      { ...created, mentions: mentionedUserId
        ? [{
            mentioned_user_id: mentionedUserId,
            mentioned_persona: this.personaForUser(booking, mentionedUserId),
          }]
        : [] },
      booking,
      senderPersona
    );
  }

  async getMentionableParticipants(bookingId: string) {
    const user = await this.hasuraUserService.getUser();
    const booking = await this.loadBooking(bookingId);
    this.assertAccess(user, booking);
    return this.participants(booking).filter((p) => p.userId !== user.id);
  }

  async markMessagesRead(
    bookingId: string,
    lastReadMessageId: string
  ): Promise<void> {
    const user = await this.hasuraUserService.getUser();
    const booking = await this.loadBooking(bookingId);
    this.assertAccess(user, booking);
    if (!lastReadMessageId) return;
    const last = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{ created_at: string }>;
    }>(
      `query LastMsg($id: uuid!) {
        user_messages(where: { id: { _eq: $id } }, limit: 1) { created_at }
      }`,
      { id: lastReadMessageId }
    );
    const upTo = last.user_messages?.[0]?.created_at;
    if (!upTo) return;
    const ids = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<{ id: string }>;
    }>(
      `query MsgsToMark($bookingId: uuid!, $entityType: entity_types_enum!, $upTo: timestamptz!) {
        user_messages(
          where: {
            entity_id: { _eq: $bookingId }
            entity_type: { _eq: $entityType }
            created_at: { _lte: $upTo }
          }
        ) { id }
      }`,
      { bookingId, entityType: ENTITY_TYPE, upTo }
    );
    const objects = (ids.user_messages ?? []).map((m) => ({
      message_id: m.id,
      user_id: user.id,
    }));
    if (!objects.length) return;
    await this.hasuraSystemService.executeMutation(
      `mutation MarkRead($objects: [message_reads_insert_input!]!) {
        insert_message_reads(
          objects: $objects
          on_conflict: { constraint: uq_message_reads_message_user, update_columns: [] }
        ) { affected_rows }
      }`,
      { objects }
    );
  }

  private async loadBooking(bookingId: string): Promise<BookingMessagingRow> {
    const r = await this.hasuraSystemService.executeQuery<{
      rental_bookings_by_pk: BookingMessagingRow | null;
    }>(
      `query BookingMsg($id: uuid!) {
        rental_bookings_by_pk(id: $id) {
          id
          booking_number
          client_id
          business_id
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

  private assertAccess(user: any, booking: BookingMessagingRow): void {
    const okClient =
      isActivePersona(user, 'client') &&
      user.client?.id === booking.client_id;
    const okBusiness =
      isActivePersona(user, 'business') &&
      user.business?.id === booking.business_id;
    if (!okClient && !okBusiness) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }
  }

  private resolvePersona(user: any, booking: BookingMessagingRow): PersonaId {
    if (isActivePersona(user, 'client') && user.client?.id === booking.client_id) {
      return 'client';
    }
    return 'business';
  }

  private participants(booking: BookingMessagingRow) {
    const rows: Array<{
      userId: string;
      persona: PersonaId;
      displayName: string;
    }> = [];
    if (booking.client?.user_id) {
      rows.push({
        userId: booking.client.user_id,
        persona: 'client',
        displayName: nameOf(booking.client.user),
      });
    }
    if (booking.business?.user_id) {
      rows.push({
        userId: booking.business.user_id,
        persona: 'business',
        displayName: nameOf(booking.business.user),
      });
    }
    return rows;
  }

  private personaForUser(
    booking: BookingMessagingRow,
    userId: string
  ): PersonaId {
    return (
      this.participants(booking).find((p) => p.userId === userId)?.persona ??
      'client'
    );
  }

  private assertMentionAllowed(
    booking: BookingMessagingRow,
    senderUserId: string,
    mentionedUserId?: string
  ): void {
    if (!mentionedUserId) return;
    const ok = this.participants(booking).some(
      (p) => p.userId === mentionedUserId && p.userId !== senderUserId
    );
    if (!ok) {
      throw new HttpException('Invalid mention', HttpStatus.BAD_REQUEST);
    }
  }

  private async fetchMessageRows(bookingId: string) {
    const r = await this.hasuraSystemService.executeQuery<{
      user_messages: Array<any>;
    }>(
      `query RentalMsgs($bookingId: uuid!, $entityType: entity_types_enum!) {
        user_messages(
          where: {
            entity_id: { _eq: $bookingId }
            entity_type: { _eq: $entityType }
          }
          order_by: { created_at: desc }
        ) {
          id user_id entity_type entity_id message message_type message_payload
          created_at updated_at
          user { id email first_name last_name }
          mentions { mentioned_user_id mentioned_persona }
        }
      }`,
      { bookingId, entityType: ENTITY_TYPE }
    );
    return r.user_messages ?? [];
  }

  private async insertMessage(
    userId: string,
    bookingId: string,
    message: string
  ) {
    const r = await this.hasuraSystemService.executeMutation<{
      insert_user_messages_one: any | null;
    }>(
      `mutation InsertRentalMsg(
        $user_id: uuid!
        $entity_type: entity_types_enum!
        $entity_id: uuid!
        $message: String!
      ) {
        insert_user_messages_one(object: {
          user_id: $user_id
          entity_type: $entity_type
          entity_id: $entity_id
          message: $message
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
      }
    );
    if (!r.insert_user_messages_one) {
      throw new HttpException('Failed to create message', HttpStatus.BAD_GATEWAY);
    }
    return r.insert_user_messages_one;
  }

  private async insertMention(
    messageId: string,
    mentionedUserId: string,
    mentionedPersona: PersonaId
  ): Promise<void> {
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
        mentioned_persona: mentionedPersona,
      }
    );
  }

  private async notifyOtherParty(
    booking: BookingMessagingRow,
    senderUserId: string,
    messageId: string,
    senderUser?: { first_name?: string | null; last_name?: string | null }
  ): Promise<void> {
    const senderName = nameOf(senderUser);
    for (const p of this.participants(booking)) {
      if (p.userId === senderUserId) continue;
      try {
        await this.notificationsService.sendNewRentalBookingMessagePush({
          recipientUserId: p.userId,
          bookingId: booking.id,
          bookingNumber: booking.booking_number ?? '',
          senderName,
          messageId,
        });
      } catch (error: any) {
        this.logger.warn(
          `rental message push failed: ${error?.message ?? String(error)}`
        );
      }
    }
  }

  private toMessage(
    msg: any,
    booking: BookingMessagingRow,
    senderPersonaOverride?: PersonaId,
    viewerUserId?: string,
    viewerPersona?: PersonaId
  ): RentalBookingMessage {
    const senderPersona =
      senderPersonaOverride ??
      this.participants(booking).find((p) => p.userId === msg.user_id)?.persona;
    const rawMention = msg.mentions?.[0];
    const mentionParticipant = rawMention
      ? this.participants(booking).find(
          (p) => p.userId === rawMention.mentioned_user_id
        )
      : undefined;
    let structured_content: Record<string, unknown> | null = null;
    if (
      msg.message_type === 'RENTAL_START_PIN' &&
      msg.message_payload &&
      viewerUserId &&
      (viewerPersona === 'client' || viewerPersona === 'business')
    ) {
      structured_content = this.rentalStartPinShare.enrichPinPayload(
        msg.message_payload,
        viewerUserId,
        viewerPersona,
        booking as any
      );
    }
    return {
      id: msg.id,
      user_id: msg.user_id,
      entity_type: msg.entity_type,
      entity_id: msg.entity_id,
      message: msg.message,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      user: msg.user,
      sender_persona: senderPersona,
      message_type: msg.message_type,
      structured_content,
      mention: rawMention
        ? {
            mentionedUserId: rawMention.mentioned_user_id,
            persona: (rawMention.mentioned_persona as PersonaId) ?? 'client',
            displayName: mentionParticipant?.displayName ?? '',
          }
        : null,
    };
  }
}

function nameOf(user?: {
  first_name?: string | null;
  last_name?: string | null;
} | null): string {
  return `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Someone';
}
