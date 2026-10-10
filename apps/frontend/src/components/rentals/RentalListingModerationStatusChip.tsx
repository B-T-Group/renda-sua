import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoReviewLinkChip } from '../business/PhotoReviewLinkChip';
import { usePhotoReviewJobId } from '../../hooks/usePhotoReviewJobId';

export interface RentalListingModerationStatusChipProps {
  status?: string | null;
  rentalImageIds?: string[];
}

const RentalListingModerationStatusChip: React.FC<
  RentalListingModerationStatusChipProps
> = ({ status, rentalImageIds }) => {
  const { t } = useTranslation();
  const s = status || 'pending';
  const photoReviewJobId = usePhotoReviewJobId({
    enabled: s === 'ai_reviewing' && (rentalImageIds?.length ?? 0) > 0,
    rentalImageIds,
  });
  if (s === 'approved') {
    return (
      <Chip
        size="small"
        color="success"
        label={t('business.rentals.moderation.approved', 'Live')}
      />
    );
  }
  if (s === 'rejected') {
    return (
      <Chip
        size="small"
        color="error"
        variant="outlined"
        label={t('business.rentals.moderation.rejected', 'Rejected')}
      />
    );
  }
  if (s === 'draft') {
    return (
      <Chip
        size="small"
        color="default"
        variant="outlined"
        label={t('business.rentals.moderation.draft', 'Draft')}
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
          'business.rentals.moderation.proposalPending',
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
          'business.rentals.moderation.reviewCleanedPhotos',
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
        label={t('business.rentals.moderation.aiReviewing', 'AI reviewing')}
      />
    );
  }
  return (
    <Chip
      size="small"
      color="warning"
      variant="outlined"
      label={t('business.rentals.moderation.pending', 'Pending approval')}
    />
  );
};

export default RentalListingModerationStatusChip;
