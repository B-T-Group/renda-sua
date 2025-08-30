import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating as MuiRating,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';

export interface RatingDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  userType: 'client' | 'agent' | 'business';
  orderStatus: string;
  orderData?: any; // Order data to extract entity IDs
  onRatingSubmitted?: () => void; // Callback to refresh ratings
}

interface RatingData {
  orderId: string;
  ratingType: 'client_to_agent' | 'client_to_item' | 'agent_to_client';
  ratedEntityType: 'agent' | 'client' | 'item';
  ratedEntityId: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
}

const RatingDialog: React.FC<RatingDialogProps> = ({
  open,
  onClose,
  orderId,
  orderNumber,
  userType,
  orderStatus,
  orderData,
  onRatingSubmitted,
}) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Rating state
  const [agentRating, setAgentRating] = useState<number>(0);
  const [agentComment, setAgentComment] = useState('');
  const [itemRating, setItemRating] = useState<number>(0);
  const [itemComment, setItemComment] = useState('');
  const [clientRating, setClientRating] = useState<number>(0);
  const [clientComment, setClientComment] = useState('');

  // Extract entity IDs from order data
  const agentId = orderData?.assigned_agent_id || '';
  const itemId = orderData?.order_items?.[0]?.item?.id || '';
  const clientId = orderData?.client?.id || '';

  const canRate = orderStatus === 'complete';

  const handleSubmitRating = async (ratingData: RatingData) => {
    if (!apiClient) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/ratings', ratingData);

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          // Call the callback to refresh ratings
          if (onRatingSubmitted) {
            onRatingSubmitted();
          }
        }, 2000);
      } else {
        setError(response.data.message || 'Failed to submit rating');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAll = async () => {
    const ratings: RatingData[] = [];

    // Client can rate agent and item
    if (userType === 'client') {
      if (agentRating > 0 && agentId) {
        ratings.push({
          orderId,
          ratingType: 'client_to_agent',
          ratedEntityType: 'agent',
          ratedEntityId: agentId,
          rating: agentRating,
          comment: agentComment,
          isPublic: true,
        });
      }

      if (itemRating > 0 && itemId) {
        ratings.push({
          orderId,
          ratingType: 'client_to_item',
          ratedEntityType: 'item',
          ratedEntityId: itemId,
          rating: itemRating,
          comment: itemComment,
          isPublic: true,
        });
      }
    }

    // Agent can rate client
    if (userType === 'agent') {
      if (clientRating > 0 && clientId) {
        ratings.push({
          orderId,
          ratingType: 'agent_to_client',
          ratedEntityType: 'client',
          ratedEntityId: clientId,
          rating: clientRating,
          comment: clientComment,
          isPublic: true,
        });
      }
    }

    // Submit all ratings
    for (const rating of ratings) {
      await handleSubmitRating(rating);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      // Reset form
      setAgentRating(0);
      setAgentComment('');
      setItemRating(0);
      setItemComment('');
      setClientRating(0);
      setClientComment('');
      setError(null);
      setSuccess(false);
    }
  };

  if (!canRate) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {t('rating.dialog.title', 'Rate Your Experience')}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info">
            {t(
              'rating.dialog.orderNotComplete',
              'You can only rate orders that have been completed.'
            )}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('common.close', 'Close')}</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('rating.dialog.title', 'Rate Your Experience')} - Order #
        {orderNumber}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {t('rating.dialog.success', 'Rating submitted successfully!')}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Client can rate agent and item */}
          {userType === 'client' && (
            <>
              {/* Agent Rating */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  {t('rating.dialog.rateAgent', 'Rate the Delivery Agent')}
                </Typography>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
                >
                  <MuiRating
                    value={agentRating}
                    onChange={(_, value) => setAgentRating(value || 0)}
                    size="large"
                  />
                  <Typography variant="body2" color="text.secondary">
                    {agentRating > 0 && `${agentRating}/5`}
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label={t('rating.dialog.comment', 'Comment (optional)')}
                  value={agentComment}
                  onChange={(e) => setAgentComment(e.target.value)}
                  placeholder={t(
                    'rating.dialog.agentCommentPlaceholder',
                    'Share your experience with the delivery agent...'
                  )}
                />
              </Box>

              {/* Item Rating */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  {t('rating.dialog.rateItem', 'Rate the Item')}
                </Typography>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
                >
                  <MuiRating
                    value={itemRating}
                    onChange={(_, value) => setItemRating(value || 0)}
                    size="large"
                  />
                  <Typography variant="body2" color="text.secondary">
                    {itemRating > 0 && `${itemRating}/5`}
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label={t('rating.dialog.comment', 'Comment (optional)')}
                  value={itemComment}
                  onChange={(e) => setItemComment(e.target.value)}
                  placeholder={t(
                    'rating.dialog.itemCommentPlaceholder',
                    'Share your thoughts about the item quality...'
                  )}
                />
              </Box>
            </>
          )}

          {/* Agent can rate client */}
          {userType === 'agent' && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {t('rating.dialog.rateClient', 'Rate the Client')}
              </Typography>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}
              >
                <MuiRating
                  value={clientRating}
                  onChange={(_, value) => setClientRating(value || 0)}
                  size="large"
                />
                <Typography variant="body2" color="text.secondary">
                  {clientRating > 0 && `${clientRating}/5`}
                </Typography>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('rating.dialog.comment', 'Comment (optional)')}
                value={clientComment}
                onChange={(e) => setClientComment(e.target.value)}
                placeholder={t(
                  'rating.dialog.clientCommentPlaceholder',
                  'Share your experience with the client...'
                )}
              />
            </Box>
          )}

          {/* Business users cannot rate */}
          {userType === 'business' && (
            <Alert severity="info">
              {t(
                'rating.dialog.businessNotAllowed',
                'Business users cannot rate orders.'
              )}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        {userType !== 'business' && (
          <Button
            onClick={handleSubmitAll}
            variant="contained"
            disabled={loading || (!agentRating && !itemRating && !clientRating)}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading
              ? t('rating.dialog.submitting', 'Submitting...')
              : t('rating.dialog.submit', 'Submit Rating')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RatingDialog;
