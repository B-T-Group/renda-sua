import type { Theme } from '../../theme';

export type ItemModerationStatus =
  | 'draft'
  | 'pending'
  | 'ai_reviewing'
  | 'proposal_pending'
  | 'approved'
  | 'rejected';

export function itemModerationColors(
  status: string | null | undefined,
  colors: Theme['colors']
): { backgroundColor: string; textColor: string; borderColor: string } {
  switch (status) {
    case 'approved':
      return {
        backgroundColor: colors.success.main + '22',
        textColor: colors.success.dark ?? colors.success.main,
        borderColor: colors.success.main + '55',
      };
    case 'rejected':
      return {
        backgroundColor: colors.error.main + '18',
        textColor: colors.error.main,
        borderColor: colors.error.main + '44',
      };
    case 'proposal_pending':
      return {
        backgroundColor: colors.info.main + '22',
        textColor: colors.info.dark ?? colors.info.main,
        borderColor: colors.info.main + '55',
      };
    case 'draft':
      return {
        backgroundColor: colors.divider,
        textColor: colors.text.secondary,
        borderColor: colors.divider,
      };
    case 'ai_reviewing':
    case 'pending':
    default:
      return {
        backgroundColor: colors.warning.main + '22',
        textColor: colors.warning.dark ?? colors.warning.main,
        borderColor: colors.warning.main + '55',
      };
  }
}

export function itemModerationLabelKey(status: string | null | undefined): string {
  switch (status) {
    case 'approved':
      return 'business.items.moderation.approved';
    case 'rejected':
      return 'business.items.moderation.rejected';
    case 'proposal_pending':
      return 'business.items.moderation.proposalPending';
    case 'ai_reviewing':
      return 'business.items.moderation.aiReviewing';
    case 'draft':
      return 'business.items.moderation.draft';
    case 'pending':
    default:
      return 'business.items.moderation.pending';
  }
}

export function itemModerationDefaultLabel(status: string | null | undefined): string {
  switch (status) {
    case 'approved':
      return 'Live';
    case 'rejected':
      return 'Rejected';
    case 'proposal_pending':
      return 'AI suggestions ready';
    case 'ai_reviewing':
      return 'AI reviewing';
    case 'draft':
      return 'Draft';
    case 'pending':
    default:
      return 'Pending approval';
  }
}

/** Active listing toggle is only allowed after moderation approval. */
export function canToggleItemActive(status: string | null | undefined): boolean {
  return status === 'approved';
}
