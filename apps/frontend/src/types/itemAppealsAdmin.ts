import type {
  ItemAppeal,
  ItemRejection,
  ItemSnapshot,
  RejectionCategory,
} from './itemRejectionRecovery';

export type AppealQueueStatus = 'pending' | 'upheld' | 'overturned' | 'withdrawn';

export interface AppealQueueItem extends ItemAppeal {
  item: {
    id: string;
    name: string;
    moderationStatus: string;
    imageUrl: string | null;
  };
  business: { id: string; name: string } | null;
  rejection: ItemRejection | null;
}

export interface AppealQueueResult {
  total: number;
  appeals: AppealQueueItem[];
}

export interface AppealQueueQuery {
  status?: AppealQueueStatus;
  category?: RejectionCategory | '';
  businessId?: string;
  limit?: number;
  offset?: number;
}

export interface AppealQueueCounts {
  pending: number;
  breached: number;
}

export interface AppealHistoryAudit {
  id?: string;
  action?: string;
  details?: Record<string, unknown> | null;
  actor_user_id?: string | null;
  created_at?: string;
}

export interface AppealDetail {
  appeal: ItemAppeal;
  rejection: (ItemRejection & { itemSnapshot?: ItemSnapshot | null }) | null;
  item: ItemSnapshot | null;
  business: { id: string; name: string } | null;
  editedSinceRejection: boolean;
  selfReview: boolean;
  history: {
    audit: AppealHistoryAudit[];
    rejections: ItemRejection[];
  };
}

export interface DecideAppealBody {
  decision: 'uphold' | 'overturn';
  note?: string;
  overturnTo?: 'approve' | 're_review';
  correctedCategory?: RejectionCategory;
}

export interface DecideAppealResult {
  appealId: string;
  status: 'upheld' | 'overturned';
  itemModerationStatus: 'rejected' | 'approved' | 'pending';
  warnings: string[];
}
