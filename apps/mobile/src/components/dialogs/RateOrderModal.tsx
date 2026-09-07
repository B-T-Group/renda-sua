import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { AppModal } from '../common/AppModal';
import { StarRatingInput } from '../common/StarRatingInput';
import { useTheme } from '../../contexts/ThemeContext';
import { agentApi } from '../../services/agentApi';
import type {
  CreateRatingBody,
  OrderRatingEligibility,
} from '../../types/ratingsApi';

export type RateOrderMode = 'agent' | 'item';

export interface RateOrderModalProps {
  visible: boolean;
  mode: RateOrderMode;
  orderId: string;
  orderNumber: string;
  eligibility: OrderRatingEligibility | null;
  onClose: () => void;
  onSubmitted: () => void;
}

interface RatingEntry {
  rating: number;
  comment: string;
}

const EMPTY_ENTRY: RatingEntry = { rating: 0, comment: '' };

/** Client rates the delivery agent (immediately) or the order items (after the unlock delay). */
export function RateOrderModal({
  visible,
  mode,
  orderId,
  orderNumber,
  eligibility,
  onClose,
  onSubmitted,
}: RateOrderModalProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [agentEntry, setAgentEntry] = useState<RatingEntry>(EMPTY_ENTRY);
  const [itemEntries, setItemEntries] = useState<Record<string, RatingEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Items saved during this session so a retry after a partial failure never
  // resubmits (and never double-rates) already-saved items.
  const [savedItemIds, setSavedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setAgentEntry(EMPTY_ENTRY);
    setItemEntries({});
    setSavedItemIds(new Set());
    setSubmitError(null);
  }, [visible, mode]);

  const unratedItems = (eligibility?.items ?? []).filter(
    (i) => !i.rated && !savedItemIds.has(i.id)
  );

  const buildBodies = useCallback((): CreateRatingBody[] => {
    if (mode === 'agent') {
      if (!eligibility?.agentId || agentEntry.rating < 1) return [];
      return [
        {
          orderId,
          ratingType: 'client_to_agent',
          ratedEntityType: 'agent',
          ratedEntityId: eligibility.agentId,
          rating: agentEntry.rating,
          comment: agentEntry.comment.trim() || undefined,
          isPublic: true,
        },
      ];
    }
    return unratedItems
      .map((item) => ({ item, entry: itemEntries[item.id] ?? EMPTY_ENTRY }))
      .filter(({ entry }) => entry.rating > 0)
      .map(({ item, entry }) => ({
        orderId,
        ratingType: 'client_to_item' as const,
        ratedEntityType: 'item' as const,
        ratedEntityId: item.id,
        rating: entry.rating,
        comment: entry.comment.trim() || undefined,
        isPublic: true,
      }));
  }, [agentEntry, eligibility, itemEntries, mode, orderId, unratedItems]);

  const canSubmit = buildBodies().length > 0;

  const isDuplicateRatingError = (message: string): boolean =>
    /already (rated|exists)|duplicate/i.test(message);

  const submitOne = useCallback(
    async (body: CreateRatingBody): Promise<{ ok: boolean; message: string }> => {
      try {
        const res = await agentApi.ratings.create(body);
        if (res.success) return { ok: true, message: '' };
        const message = res.message ?? '';
        // Already-saved ratings (e.g. from a previous partial submit) count as done.
        return { ok: isDuplicateRatingError(message), message };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { ok: isDuplicateRatingError(message), message };
      }
    },
    []
  );

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);

    // Submit every rating independently: one failure must not abort the rest,
    // and successes are tracked so a retry only resends what actually failed.
    const failures: string[] = [];
    for (const body of buildBodies()) {
      const { ok, message } = await submitOne(body);
      if (ok && mode === 'item') {
        setSavedItemIds((prev) => new Set(prev).add(body.ratedEntityId));
      }
      if (!ok) failures.push(message);
    }
    setSubmitting(false);

    if (failures.length > 0) {
      setSubmitError(
        failures[0] || t('rating.submitFailed', 'Could not save rating.')
      );
      return;
    }
    onSubmitted();
    onClose();
  }, [buildBodies, mode, onClose, onSubmitted, submitOne, t]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    // Some item ratings may have been saved before a partial failure; let the
    // parent refresh eligibility so the UI reflects them.
    const hadPartialSave = savedItemIds.size > 0;
    onClose();
    if (hadPartialSave) onSubmitted();
  }, [onClose, onSubmitted, savedItemIds, submitting]);

  const setItemEntry = (itemId: string, patch: Partial<RatingEntry>) => {
    setItemEntries((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? EMPTY_ENTRY), ...patch },
    }));
  };

  const title =
    mode === 'agent'
      ? t('rating.rateAgentTitle', 'Rate your delivery agent')
      : t('rating.rateItemsTitle', 'Rate your items');

  return (
    <AppModal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.dimTap}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', 'Close')}
        />
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                borderColor: colors.divider,
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
            >
              <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
                {title}
              </Text>
              <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.text.secondary }]}>
                {t('rating.orderRef', 'Order #{{orderNumber}}', { orderNumber })}
              </Text>

              {mode === 'agent' ? (
                <View style={[styles.block, { borderColor: colors.divider, borderRadius: borderRadius.md }]}>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 12 }}>
                    {t('rating.rateAgentHint', 'How was your delivery experience?')}
                  </Text>
                  <StarRatingInput
                    value={agentEntry.rating}
                    onChange={(rating) => setAgentEntry((prev) => ({ ...prev, rating }))}
                    disabled={submitting}
                  />
                  <TextInput
                    mode="outlined"
                    label={t('rating.commentLabel', 'Comment (optional)')}
                    value={agentEntry.comment}
                    onChangeText={(comment) => setAgentEntry((prev) => ({ ...prev, comment }))}
                    multiline
                    numberOfLines={3}
                    disabled={submitting}
                    style={{ marginTop: 12 }}
                  />
                </View>
              ) : unratedItems.length === 0 ? (
                <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
                  {t('rating.allItemsRated', 'You have already rated all items in this order.')}
                </Text>
              ) : (
                unratedItems.map((item) => {
                  const entry = itemEntries[item.id] ?? EMPTY_ENTRY;
                  return (
                    <View
                      key={item.id}
                      style={[styles.block, { borderColor: colors.divider, borderRadius: borderRadius.md }]}
                    >
                      <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: 8 }} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <StarRatingInput
                        value={entry.rating}
                        onChange={(rating) => setItemEntry(item.id, { rating })}
                        disabled={submitting}
                        size={30}
                      />
                      <TextInput
                        mode="outlined"
                        label={t('rating.commentLabel', 'Comment (optional)')}
                        value={entry.comment}
                        onChangeText={(comment) => setItemEntry(item.id, { comment })}
                        multiline
                        numberOfLines={2}
                        disabled={submitting}
                        style={{ marginTop: 12 }}
                      />
                    </View>
                  );
                })
              )}

              {submitError ? (
                <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 8 }}>
                  {submitError}
                </Text>
              ) : null}

              <View style={styles.actions}>
                <Button mode="text" onPress={handleClose} disabled={submitting}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={() => void submit()}
                  loading={submitting}
                  disabled={!canSubmit || submitting}
                >
                  {t('rating.submit', 'Submit rating')}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dimTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    zIndex: 2,
  },
  sheet: {
    maxHeight: '88%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  scroll: { padding: 22, paddingBottom: 28 },
  title: { textAlign: 'center', marginTop: 4 },
  subtitle: { textAlign: 'center', marginTop: 8, marginBottom: 16 },
  block: { borderWidth: 1, padding: 16, marginBottom: 12 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
});
