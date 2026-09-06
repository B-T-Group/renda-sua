import type {
  AdminBroadcastPayload,
  BroadcastActionType,
} from '../types/adminBroadcast';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parseAdminBroadcastPayload(
  data: Record<string, unknown> | undefined | null
): AdminBroadcastPayload | null {
  if (!data || data.type !== 'admin_broadcast') return null;
  const campaignId = asString(data.campaignId);
  const messageId = asString(data.messageId);
  const actionRaw = asString(data.actionType) ?? 'generic';
  if (!campaignId || !messageId) return null;
  const actionType = (
    ['generic', 'app_upgrade', 'business_account_setup'].includes(actionRaw)
      ? actionRaw
      : 'generic'
  ) as BroadcastActionType;
  return {
    type: 'admin_broadcast',
    campaignId,
    messageId,
    actionType,
    title: asString(data.title),
    body: asString(data.body),
    titleEn: asString(data.titleEn) ?? asString(data.title_en),
    bodyEn: asString(data.bodyEn) ?? asString(data.body_en),
    titleFr: asString(data.titleFr) ?? asString(data.title_fr),
    bodyFr: asString(data.bodyFr) ?? asString(data.body_fr),
  };
}

/** Merge Expo notification title/body when data payload omits copy. */
export function parseAdminBroadcastFromNotification(content: {
  title?: unknown;
  body?: unknown;
  data?: Record<string, unknown> | undefined | null;
}): AdminBroadcastPayload | null {
  const parsed = parseAdminBroadcastPayload(content.data ?? null);
  if (!parsed) return null;
  return {
    ...parsed,
    title: parsed.title || asString(content.title),
    body: parsed.body || asString(content.body),
  };
}
