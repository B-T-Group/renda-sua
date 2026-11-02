import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePhotoReviewJobId } from '../../hooks/usePhotoReviewJobId';
import { getRecoveryChipPresentation } from '../../utils/itemRejectionRecovery';
import { PhotoReviewLinkChip } from './PhotoReviewLinkChip';

export interface ItemModerationStatusChipProps {
  status?: string | null;
  itemId?: string | null;
  rejectionCategory?: string | null;
  pendingResubmit?: boolean;
}

const ItemModerationStatusChip: React.FC<ItemModerationStatusChipProps> = ({
  status,
  itemId,
  rejectionCategory,
  pendingResubmit,
}) => {
  const { t } = useTranslation();
  const s = status || 'pending';
  const photoReviewJobId = usePhotoReviewJobId({
    enabled: s === 'ai_reviewing' && !!itemId && !pendingResubmit,
    itemId,
  });
  const recoveryChip = getRecoveryChipPresentation({
    status: s,
    category: rejectionCategory,
    pendingResubmit,
  });
  if (s === 'rejected' || pendingResubmit) {
    return (
      <Chip
        size="small"
        color={recoveryChip.tone === 'error' ? 'error' : 'warning'}
        variant="outlined"
        label={t(recoveryChip.labelKey, recoveryChip.defaultLabel)}
      />
    );
  }
  if (s === 'draft') {
    return (
      <Chip
        size="small"
        color="default"
        variant="outlined"
        label={t('business.items.moderation.draft', 'Draft')}
      />
    );
  }
  if (s === 'proposal_pending') {
    return (
      <Chip
        size="small"
        color="info"
        variant="outlined"
        label={t(
          'business.items.moderation.proposalPending',
          'AI suggestions ready'
        )}
      />
    );
  }
  if (s === 'ai_reviewing' && photoReviewJobId) {
    return (
      <PhotoReviewLinkChip
        jobId={photoReviewJobId}
        label={t(
          'business.items.moderation.reviewCleanedPhotos',
          'Review cleaned photos'
        )}
      />
    );
  }
  if (s === 'ai_reviewing') {
    return (
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        label={t('business.items.moderation.aiReviewing', 'AI reviewing')}
      />
    );
  }
  return (
    <Chip
      size="small"
      color="warning"
      variant="outlined"
      label={t('business.items.moderation.pending', 'Pending approval')}
    />
  );
};

export default ItemModerationStatusChip;
