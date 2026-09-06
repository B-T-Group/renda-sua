export type BroadcastAudienceType =
  | 'everyone'
  | 'business'
  | 'agent'
  | 'client'
  | 'user';
export type BroadcastTemplateKey =
  | 'custom'
  | 'app_upgrade'
  | 'business_account_setup';
export type BroadcastActionType =
  | 'generic'
  | 'app_upgrade'
  | 'business_account_setup';

export interface BroadcastFilters {
  lifecycleStatuses?: string[];
  isStorefrontVisible?: boolean;
  canAcceptOrders?: boolean;
  isAvailable?: boolean;
  countries?: string[];
  userIds?: string[];
  emails?: string[];
}

export interface BroadcastUserOption {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface BroadcastPreviewResult {
  total: number;
  withPushToken: number;
  wouldSkipDedupe: number;
  eligible: number;
}

export interface BroadcastCampaign {
  id: string;
  created_at: string;
  status: string;
  audience_type: string;
  filters?: BroadcastFilters;
  template_key: string;
  action_type: string;
  title_en: string;
  body_en: string;
  title_fr: string;
  body_fr: string;
  source_body: string;
  target_count: number;
  sent_count: number;
  skipped_dedupe_count: number;
  failed_count: number;
}

export interface AdminBroadcastPayload {
  type: 'admin_broadcast';
  campaignId: string;
  actionType: BroadcastActionType;
  messageId: string;
  title?: string;
  body?: string;
  titleEn?: string;
  bodyEn?: string;
  titleFr?: string;
  bodyFr?: string;
}
