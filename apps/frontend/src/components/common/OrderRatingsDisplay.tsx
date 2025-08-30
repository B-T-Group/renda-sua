import {
  Box,
  Card,
  CardContent,
  Chip,
  Rating as MuiRating,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { OrderRating } from '../../hooks/useOrderRatings';

interface OrderRatingsDisplayProps {
  ratings: OrderRating[];
  userType: 'client' | 'agent' | 'business';
}

const OrderRatingsDisplay: React.FC<OrderRatingsDisplayProps> = ({
  ratings,
  userType,
}) => {
  const { t } = useTranslation();

  if (!ratings || ratings.length === 0) {
    return null;
  }

  const getRatingTypeLabel = (ratingType: string) => {
    switch (ratingType) {
      case 'client_to_agent':
        return t('rating.types.clientToAgent', 'Client → Agent');
      case 'client_to_item':
        return t('rating.types.clientToItem', 'Client → Item');
      case 'agent_to_client':
        return t('rating.types.agentToClient', 'Agent → Client');
      default:
        return ratingType;
    }
  };

  const getRatingTypeColor = (ratingType: string) => {
    switch (ratingType) {
      case 'client_to_agent':
        return 'primary';
      case 'client_to_item':
        return 'secondary';
      case 'agent_to_client':
        return 'info';
      default:
        return 'default';
    }
  };

  const canViewRating = (rating: OrderRating) => {
    // Business users can view all ratings
    if (userType === 'business') return true;

    // Public ratings can be viewed by anyone
    if (rating.is_public) return true;

    // Users can view their own ratings
    // Note: This would need to be enhanced with actual user ID comparison
    // For now, we'll show public ratings only
    return false;
  };

  const visibleRatings = ratings.filter(canViewRating);

  if (visibleRatings.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('rating.orderRatings', 'Order Ratings')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleRatings.map((rating) => (
            <Box
              key={rating.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 1,
                }}
              >
                <Chip
                  label={getRatingTypeLabel(rating.rating_type)}
                  color={getRatingTypeColor(rating.rating_type) as any}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary">
                  {new Date(rating.created_at).toLocaleDateString()}
                </Typography>
              </Box>

              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <MuiRating value={rating.rating} readOnly size="small" />
                <Typography variant="body2">{rating.rating}/5</Typography>
              </Box>

              {rating.comment && (
                <Typography variant="body2" color="text.secondary">
                  "{rating.comment}"
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default OrderRatingsDisplay;
