import { Box, Rating as MuiRating, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityRatingAggregate } from '../../hooks/useEntityRatingAggregate';

export interface UserRatingSummaryProps {
  entityType: 'agent' | 'client';
  entityId: string;
}

/**
 * Compact stars + count summary of ratings received by the current persona.
 * Renders nothing until the entity has at least one rating.
 */
const UserRatingSummary: React.FC<UserRatingSummaryProps> = ({
  entityType,
  entityId,
}) => {
  const { t } = useTranslation();
  const { aggregate } = useEntityRatingAggregate(entityType, entityId);

  if (!aggregate || aggregate.total_ratings === 0) return null;

  const average = Number(aggregate.average_rating);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <MuiRating value={average} precision={0.1} size="small" readOnly />
      <Typography variant="caption" color="text.secondary">
        {t('rating.summary.compact', {
          defaultValue: '{{avg}} ({{count}})',
          avg: average.toFixed(1),
          count: aggregate.total_ratings,
        })}
      </Typography>
    </Box>
  );
};

export default UserRatingSummary;
