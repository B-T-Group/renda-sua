import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HasuraSystemService } from '../../hasura/hasura-system.service';
import type {
  PatchNotificationPreferencesDto,
  UserNotificationPreferences,
} from './notification.types';

interface PrefRow {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  whatsapp_opted_in_at: string | null;
  whatsapp_informational_enabled: boolean;
  marketing_enabled: boolean;
  order_updates: boolean;
  chat: boolean;
  marketplace: boolean;
  reminders: boolean;
}

interface UserPhoneRow {
  id: string;
  phone_number?: string | null;
  phone_number_verified?: boolean | null;
}

@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(private readonly hasura: HasuraSystemService) {}

  async getPreferences(userId: string): Promise<UserNotificationPreferences> {
    const [prefs, user] = await Promise.all([
      this.ensurePrefsRow(userId),
      this.fetchUserPhone(userId),
    ]);
    return this.toDto(prefs, user);
  }

  async patchPreferences(
    userId: string,
    patch: PatchNotificationPreferencesDto
  ): Promise<UserNotificationPreferences> {
    await this.ensurePrefsRow(userId);
    if (patch.whatsappEnabled === true) {
      await this.assertWhatsAppOptInAllowed(userId);
    }
    const set = this.buildSetClause(patch);
    if (Object.keys(set).length === 0) {
      return this.getPreferences(userId);
    }
    set.updated_at = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation U($userId: uuid!, $set: user_notification_preferences_set_input!) {
        update_user_notification_preferences_by_pk(pk_columns: { user_id: $userId }, _set: $set) {
          user_id
        }
      }`,
      { userId, set }
    );
    return this.getPreferences(userId);
  }

  async disableWhatsApp(userId: string): Promise<void> {
    const at = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation D($userId: uuid!, $at: timestamptz!) {
        insert_user_notification_preferences_one(
          object: {
            user_id: $userId
            whatsapp_enabled: false
            whatsapp_opted_in_at: $at
          }
          on_conflict: {
            constraint: user_notification_preferences_pkey
            update_columns: [whatsapp_enabled, whatsapp_opted_in_at, updated_at]
          }
        ) { user_id }
      }`,
      { userId, at }
    );
  }

  async findUserIdByPhoneE164(phoneE164: string): Promise<string | null> {
    const normalized = phoneE164.replace(/^\+/, '').trim();
    if (!normalized) return null;
    const withPlus = `+${normalized}`;
    const res = await this.hasura.executeQuery<{ users: UserPhoneRow[] }>(
      `query P($a: String!, $b: String!) {
        users(where: { _or: [
          { phone_number: { _eq: $a } },
          { phone_number: { _eq: $b } }
        ]}, limit: 1) { id }
      }`,
      { a: normalized, b: withPlus }
    );
    return res.users?.[0]?.id ?? null;
  }

  isWhatsAppEligible(prefs: UserNotificationPreferences): boolean {
    return prefs.whatsappEnabled && !!prefs.phoneNumber?.trim();
  }

  isCategoryEnabled(
    prefs: UserNotificationPreferences,
    category: 'orderUpdates' | 'chat' | 'marketplace' | 'reminders' | 'marketing'
  ): boolean {
    if (category === 'marketing') return prefs.marketingEnabled;
    return prefs[category];
  }

  private async assertWhatsAppOptInAllowed(userId: string): Promise<void> {
    const user = await this.fetchUserPhone(userId);
    if (!user?.phone_number?.trim()) {
      throw new BadRequestException(
        'Add a phone number before enabling WhatsApp notifications'
      );
    }
  }

  private buildSetClause(
    patch: PatchNotificationPreferencesDto
  ): Record<string, unknown> {
    const set: Record<string, unknown> = {};
    if (patch.pushEnabled !== undefined) set.push_enabled = patch.pushEnabled;
    if (patch.emailEnabled !== undefined) set.email_enabled = patch.emailEnabled;
    if (patch.smsEnabled !== undefined) set.sms_enabled = patch.smsEnabled;
    if (patch.whatsappInformationalEnabled !== undefined) {
      set.whatsapp_informational_enabled = patch.whatsappInformationalEnabled;
    }
    if (patch.marketingEnabled !== undefined) {
      set.marketing_enabled = patch.marketingEnabled;
    }
    if (patch.orderUpdates !== undefined) set.order_updates = patch.orderUpdates;
    if (patch.chat !== undefined) set.chat = patch.chat;
    if (patch.marketplace !== undefined) set.marketplace = patch.marketplace;
    if (patch.reminders !== undefined) set.reminders = patch.reminders;
    if (patch.whatsappEnabled !== undefined) {
      set.whatsapp_enabled = patch.whatsappEnabled;
      if (patch.whatsappEnabled) {
        set.whatsapp_opted_in_at = new Date().toISOString();
      }
    }
    return set;
  }

  private async ensurePrefsRow(userId: string): Promise<PrefRow> {
    const existing = await this.fetchPrefs(userId);
    if (existing) return this.maybeDefaultWhatsAppOn(userId, existing);
    const user = await this.fetchUserPhone(userId);
    const hasPhone = !!user?.phone_number?.trim();
    try {
      await this.hasura.executeMutation(
        `mutation I(
          $userId: uuid!
          $whatsappEnabled: Boolean!
          $optedInAt: timestamptz
        ) {
          insert_user_notification_preferences_one(
            object: {
              user_id: $userId
              whatsapp_enabled: $whatsappEnabled
              whatsapp_opted_in_at: $optedInAt
            }
            on_conflict: { constraint: user_notification_preferences_pkey, update_columns: [] }
          ) { user_id }
        }`,
        {
          userId,
          whatsappEnabled: hasPhone,
          optedInAt: hasPhone ? new Date().toISOString() : null,
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `ensurePrefsRow insert: ${error?.message ?? String(error)}`
      );
    }
    const row = await this.fetchPrefs(userId);
    if (!row) {
      return this.defaultPrefs(userId, hasPhone);
    }
    return row;
  }

  private async maybeDefaultWhatsAppOn(
    userId: string,
    existing: PrefRow
  ): Promise<PrefRow> {
    if (existing.whatsapp_enabled || existing.whatsapp_opted_in_at) {
      return existing;
    }
    const user = await this.fetchUserPhone(userId);
    if (!user?.phone_number?.trim()) return existing;
    const at = new Date().toISOString();
    await this.hasura.executeMutation(
      `mutation E($userId: uuid!, $at: timestamptz!) {
        update_user_notification_preferences_by_pk(
          pk_columns: { user_id: $userId },
          _set: { whatsapp_enabled: true, whatsapp_opted_in_at: $at, updated_at: $at }
        ) { user_id }
      }`,
      { userId, at }
    );
    return (await this.fetchPrefs(userId)) ?? {
      ...existing,
      whatsapp_enabled: true,
      whatsapp_opted_in_at: at,
    };
  }

  private async fetchPrefs(userId: string): Promise<PrefRow | null> {
    const res = await this.hasura.executeQuery<{
      user_notification_preferences_by_pk: PrefRow | null;
    }>(
      `query G($userId: uuid!) {
        user_notification_preferences_by_pk(user_id: $userId) {
          user_id push_enabled email_enabled sms_enabled
          whatsapp_enabled whatsapp_opted_in_at whatsapp_informational_enabled
          marketing_enabled order_updates chat marketplace reminders
        }
      }`,
      { userId }
    );
    return res.user_notification_preferences_by_pk ?? null;
  }

  private async fetchUserPhone(userId: string): Promise<UserPhoneRow | null> {
    const res = await this.hasura.executeQuery<{ users_by_pk: UserPhoneRow | null }>(
      `query U($id: uuid!) {
        users_by_pk(id: $id) { id phone_number phone_number_verified }
      }`,
      { id: userId }
    );
    return res.users_by_pk ?? null;
  }

  private defaultPrefs(userId: string, hasPhone = false): PrefRow {
    return {
      user_id: userId,
      push_enabled: true,
      email_enabled: true,
      sms_enabled: true,
      whatsapp_enabled: hasPhone,
      whatsapp_opted_in_at: hasPhone ? new Date().toISOString() : null,
      whatsapp_informational_enabled: false,
      marketing_enabled: false,
      order_updates: true,
      chat: true,
      marketplace: true,
      reminders: true,
    };
  }

  private toDto(
    prefs: PrefRow,
    user: UserPhoneRow | null
  ): UserNotificationPreferences {
    return {
      userId: prefs.user_id,
      pushEnabled: prefs.push_enabled,
      emailEnabled: prefs.email_enabled,
      smsEnabled: prefs.sms_enabled,
      whatsappEnabled: prefs.whatsapp_enabled,
      whatsappOptedInAt: prefs.whatsapp_opted_in_at,
      whatsappInformationalEnabled: prefs.whatsapp_informational_enabled,
      marketingEnabled: prefs.marketing_enabled,
      orderUpdates: prefs.order_updates,
      chat: prefs.chat,
      marketplace: prefs.marketplace,
      reminders: prefs.reminders,
      phoneNumber: user?.phone_number ?? null,
      phoneNumberVerified: user?.phone_number_verified === true,
    };
  }
}
