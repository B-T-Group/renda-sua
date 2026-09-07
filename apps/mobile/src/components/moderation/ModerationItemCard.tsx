import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { ModerationImagePreview } from './ModerationImagePreview';
import { useTheme } from '../../contexts/ThemeContext';
import type { AdminItemModerationRow } from '../../types/adminItems';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  itemModerationColors,
  itemModerationDefaultLabel,
  itemModerationLabelKey,
} from '../../utils/items/itemStatusUi';

export type ModerationItemCardProps = {
  item: AdminItemModerationRow;
  actionBusy: boolean;
  onApprove: (item: AdminItemModerationRow) => void;
  onReject: (item: AdminItemModerationRow) => void;
  onOverrule: (item: AdminItemModerationRow) => void;
  onMessage: (item: AdminItemModerationRow) => void;
  onViewAiReview: (reviewId: string) => void;
};

function ModerationItemCardBase({
  item,
  actionBusy,
  onApprove,
  onReject,
  onOverrule,
  onMessage,
  onViewAiReview,
}: ModerationItemCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const pending =
    item.moderation_status === 'pending' ||
    item.moderation_status === 'ai_reviewing';
  const rejected = item.moderation_status === 'rejected';
  const modColors = itemModerationColors(item.moderation_status, colors);
  const price =
    item.price != null
      ? formatCurrency(Number(item.price), item.currency || 'XAF')
      : null;
  const images = item.item_images ?? [];
  const rejectionSource =
    item.moderation_source === 'ai'
      ? t('admin.items.moderation.rejectedByAi', 'Rejected by AI')
      : item.moderation_source === 'admin'
        ? t('admin.items.moderation.rejectedByAdmin', 'Rejected by admin')
        : null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
        },
      ]}
    >
      <ModerationImagePreview images={images} />
      <Text
        style={[typography.subtitle1, { color: colors.text.primary, marginTop: spacing.xs }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
        {item.business?.name ?? '—'}
      </Text>
      {price ? (
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
          {price}
        </Text>
      ) : null}
      {item.description ? (
        <Text
          style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}
          numberOfLines={3}
        >
          {item.description}
        </Text>
      ) : null}
      {item.created_at ? (
        <Text style={[typography.caption, { color: colors.text.disabled, marginTop: 4 }]}>
          {t('admin.items.moderation.submittedAt', 'Submitted {{date}}', {
            date: formatDate(item.created_at, 'datetime', i18n.language),
          })}
        </Text>
      ) : null}
      <StatusPill
        compact
        style={{ marginTop: 8, alignSelf: 'flex-start' }}
        label={t(
          itemModerationLabelKey(item.moderation_status),
          itemModerationDefaultLabel(item.moderation_status)
        )}
        backgroundColor={modColors.backgroundColor}
        textColor={modColors.textColor}
      />
      {item.moderation_status === 'ai_reviewing' ? (
        <Text
          style={[typography.caption, { color: colors.warning.main, marginTop: 6 }]}
        >
          {t(
            'admin.items.moderation.aiReviewingHint',
            'Still in AI review — you can approve or reject manually.'
          )}
        </Text>
      ) : null}
      {rejected && rejectionSource ? (
        <Text style={[typography.caption, { color: colors.error.main, marginTop: 6 }]}>
          {rejectionSource}
        </Text>
      ) : null}
      {rejected && item.rejection_reason ? (
        <View
          style={[
            styles.reasonBox,
            {
              marginTop: spacing.xs,
              padding: spacing.sm,
              borderRadius: borderRadius.sm,
              backgroundColor: colors.errorTint,
            },
          ]}
        >
          <Text style={[typography.caption, { color: colors.text.secondary, marginBottom: 2 }]}>
            {t('admin.items.moderation.rejectionReason', 'Rejection reason')}
          </Text>
          <Text style={[typography.body2, { color: colors.text.primary }]}>
            {item.rejection_reason}
          </Text>
        </View>
      ) : null}
      {item.latest_ai_review?.id ? (
        <Button
          mode="text"
          compact
          style={{ alignSelf: 'flex-start', marginTop: 4 }}
          onPress={() => onViewAiReview(item.latest_ai_review!.id)}
        >
          {t('admin.items.moderation.viewAiReview', 'View AI review')}
        </Button>
      ) : null}
      <View style={[styles.actions, { marginTop: spacing.sm }]}>
        {pending ? (
          <>
            <Button mode="contained" disabled={actionBusy} onPress={() => onApprove(item)}>
              {t('admin.items.moderation.approve', 'Approve')}
            </Button>
            <Button
              mode="outlined"
              textColor={colors.error.main}
              disabled={actionBusy}
              onPress={() => onReject(item)}
            >
              {t('admin.items.moderation.reject', 'Reject')}
            </Button>
          </>
        ) : null}
        {rejected ? (
          <Button mode="contained" disabled={actionBusy} onPress={() => onOverrule(item)}>
            {t('admin.items.moderation.overruleApprove', 'Approve (overrule)')}
          </Button>
        ) : null}
        <Button mode="outlined" disabled={actionBusy} onPress={() => onMessage(item)}>
          {t('admin.items.moderation.messageBusiness', 'Message business')}
        </Button>
      </View>
    </View>
  );
}

export const ModerationItemCard = memo(ModerationItemCardBase);

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonBox: {},
});
