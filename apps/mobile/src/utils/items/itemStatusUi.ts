import type { Theme } from '../../theme';
import { getRecoveryChipPresentation } from '../itemRejectionRecovery';

export type ItemModerationStatus =
  | 'draft'
  | 'pending'
  | 'ai_reviewing'
  | 'proposal_pending'
  | 'approved'
  | 'rejected';

export type ItemModerationDisplayOptions = {
  category?: string | null;
  pendingResubmit?: boolean;
};

export function itemModerationColors(
  status: string | null | undefined,
  colors: Theme['colors'],
  options?: ItemModerationDisplayOptions
): { backgroundColor: string; textColor: string; borderColor: string } {
  const recovery = getRecoveryChipPresentation({
    status,
    category: options?.category,
    pendingResubmit: options?.pendingResubmit,
  });
  if (status === 'rejected' || options?.pendingResubmit) {
    const tone = recovery.tone === 'error' ? colors.error.main : colors.warning.main;
    return {
      backgroundColor: tone + '18',
      textColor: tone,
      borderColor: tone + '44',
    };
  }
  switch (status) {
    case 'approved':
      return {
        backgroundColor: colors.success.main + '22',
        textColor: colors.success.dark ?? colors.success.main,
        borderColor: colors.success.main + '55',
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

export function itemModerationLabelKey(
  status: string | null | undefined,
  options?: ItemModerationDisplayOptions
): string {
  if (status === 'rejected' || options?.pendingResubmit) {
    return getRecoveryChipPresentation({
      status,
      category: options?.category,
      pendingResubmit: options?.pendingResubmit,
    }).labelKey;
  }
  switch (status) {
    case 'approved':
      return 'business.items.moderation.approved';
    case 'rejected':
      return 'business.items.recovery.status.needsChanges';
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

export function itemModerationDefaultLabel(
  status: string | null | undefined,
  options?: ItemModerationDisplayOptions
): string {
  if (status === 'rejected' || options?.pendingResubmit) {
    return getRecoveryChipPresentation({
      status,
      category: options?.category,
      pendingResubmit: options?.pendingResubmit,
    }).defaultLabel;
  }
  switch (status) {
    case 'approved':
      return 'Live';
    case 'rejected':
      return 'Needs changes';
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
