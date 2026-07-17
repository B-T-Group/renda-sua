import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Rating as MuiRating,
  Stack,
  Typography,
} from '@mui/material';
import { Star } from '@mui/icons-material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityRatingAggregate } from '../../hooks/useEntityRatingAggregate';
import { useEntityRatings } from '../../hooks/useEntityRatings';

export interface MyRatingsSectionProps {
  entityType: 'agent' | 'client';
  entityId: string;
}

/**
 * Self-contained ratings section for the current persona (profile page):
 * aggregate summary plus a paginated list of public reviews received.
 */
const MyRatingsSection: React.FC<MyRatingsSectionProps> = ({
  entityType,
  entityId,
}) => {
  const { t } = useTranslation();
  const { aggregate } = useEntityRatingAggregate(entityType, entityId);
  const { ratings, loading, hasMore, loadMore } = useEntityRatings(
    entityType,
    entityId
  );

  const average = aggregate ? Number(aggregate.average_rating) : 0;
  const total = aggregate?.total_ratings ?? 0;

  return (
    <Card variant="outlined" id="ratings" sx={{ overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, pb: 0 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1,
            bgcolor: 'action.selected',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2,
          }}
        >
          <Star sx={{ color: 'primary.main', fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('rating.myRatings.title', 'My Ratings')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {entityType === 'agent'
              ? t(
                  'rating.myRatings.agentSubtitle',
                  'What clients say about your deliveries'
                )
              : t(
                  'rating.myRatings.clientSubtitle',
                  'What delivery agents say about working with you'
                )}
          </Typography>
        </Box>
      </Box>
      <CardContent sx={{ pt: 1.5, px: 2, pb: 2 }}>
        {total > 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="h5" fontWeight={700}>
              {average.toFixed(1)}
            </Typography>
            <MuiRating value={average} precision={0.1} readOnly />
            <Typography variant="body2" color="text.secondary">
              {t('rating.myRatings.count', {
                defaultValue: '{{count}} rating(s)',
                count: total,
              })}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t(
              'rating.myRatings.empty',
              'No ratings yet. Ratings appear here after completed orders.'
            )}
          </Typography>
        )}

        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {ratings.map((rating) => (
            <Box key={rating.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MuiRating value={rating.rating} size="small" readOnly />
                <Typography variant="caption" color="text.secondary">
                  {new Date(rating.created_at).toLocaleDateString()}
                </Typography>
              </Box>
              {rating.comment && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {rating.comment}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={22} />
          </Box>
        )}
        {hasMore && !loading && (
          <Button size="small" onClick={() => loadMore()} sx={{ mt: 1.5 }}>
            {t('rating.myRatings.loadMore', 'Load more reviews')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default MyRatingsSection;
