import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppModal } from '../common/AppModal';
import { DeliveryCompleteSuccessView } from './DeliveryCompleteSuccessView';
import { useTheme } from '../../contexts/ThemeContext';
import { agentApi } from '../../services/agentApi';
import type { Order } from '../../types/agent';
import { clientDisplayName } from '../../utils/orderCardHelpers';
import {
  clientQuickCommentsForStars,
  composeRatingComment,
  labelsForSelectedComments,
  pruneQuickCommentIds,
  toggleQuickCommentId,
} from '../../utils/ratingQuickComments';

export interface DeliveryCompleteSuccessModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}

async function createClientRating(input: {
  orderId: string;
  ratedClientId: string;
  rating: number;
  comment: string;
  failedMessage: string;
}): Promise<void> {
  const res = await agentApi.ratings.create({
    orderId: input.orderId,
    ratingType: 'agent_to_client',
    ratedEntityType: 'client',
    ratedEntityId: input.ratedClientId,
    rating: input.rating,
    comment: input.comment || undefined,
    isPublic: true,
  });
  if (!res.success) throw new Error(res.message ?? input.failedMessage);
}

export function DeliveryCompleteSuccessModal({
  visible,
  order,
  onClose,
}: DeliveryCompleteSuccessModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [animToken, setAnimToken] = useState(0);
  const [stars, setStars] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !order) return;
    setStars(0);
    setSelectedIds([]);
    setComment('');
    setSubmitError(null);
    setAnimToken((n) => n + 1);
  }, [visible, order?.id]);

  const quickComments = useMemo(() => clientQuickCommentsForStars(stars), [stars]);

  const handleStarsChange = useCallback((n: number) => {
    setStars(n);
    setSelectedIds((prev) => pruneQuickCommentIds(prev, clientQuickCommentsForStars(n)));
  }, []);

  const persistRating = useCallback(
    async (orderId: string, ratedClientId: string) => {
      const chipText = labelsForSelectedComments(selectedIds, quickComments, (key, fallback) =>
        t(key, fallback)
      );
      setSubmitting(true);
      setSubmitError(null);
      try {
        await createClientRating({
          orderId,
          ratedClientId,
          rating: stars,
          comment: composeRatingComment(chipText, comment),
          failedMessage: t('orders.deliverySuccess.ratingFailed', 'Could not save rating.'),
        });
        onClose();
      } catch (e: unknown) {
        setSubmitError(e instanceof Error ? e.message : String(e));
      } finally {
        setSubmitting(false);
      }
    },
    [comment, onClose, quickComments, selectedIds, stars, t]
  );

  const submitRating = useCallback(async () => {
    if (!order || stars < 1) return;
    const ratedClientId = order.client?.id ?? order.client_id;
    if (!ratedClientId) {
      setSubmitError(
        t('orders.deliverySuccess.ratingMissingClient', 'Client information is missing; cannot submit rating.')
      );
      return;
    }
    await persistRating(order.id, ratedClientId);
  }, [order, persistRating, stars, t]);

  return (
    <AppModal
      visible={visible && !!order}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={submitting ? undefined : onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, width, height, backgroundColor: colors.pageBackground }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <DeliveryCompleteSuccessView
          animToken={animToken}
          orderNumber={order?.order_number ?? ''}
          clientName={order ? clientDisplayName(order.client) : ''}
          stars={stars}
          onStarsChange={handleStarsChange}
          quickComments={quickComments}
          selectedIds={selectedIds}
          onToggleChip={(id) => setSelectedIds((prev) => toggleQuickCommentId(prev, id))}
          comment={comment}
          onCommentChange={setComment}
          submitError={submitError}
          submitting={submitting}
          insetTop={insets.top}
          insetBottom={insets.bottom}
          onClose={onClose}
          onSubmit={() => void submitRating()}
        />
      </KeyboardAvoidingView>
    </AppModal>
  );
}
