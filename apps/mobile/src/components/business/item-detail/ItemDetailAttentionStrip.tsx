import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import type { BusinessCatalogItem } from '@/types/business/items';
import { getItemInventories } from '@/utils/businessItemUtils';

type Props = {
  item: BusinessCatalogItem;
  busy?: boolean;
  onPublish: () => void;
  onReviewAi: () => void;
  onAddLocation: () => void;
};

function isItemLive(item: BusinessCatalogItem): boolean {
  return item.moderation_status === 'approved' && item.is_active !== false;
}

function shouldHideStrip(item: BusinessCatalogItem): boolean {
  const hasPhoto = (item.item_images?.length ?? 0) > 0;
  const hasStock = getItemInventories(item).length > 0;
  return isItemLive(item) && hasPhoto && hasStock;
}

export function ItemDetailAttentionStrip({
  item,
  busy = false,
  onPublish,
  onReviewAi,
  onAddLocation,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  if (shouldHideStrip(item)) return null;

  const moderation = item.moderation_status;
  const hasPhoto = (item.item_images?.length ?? 0) > 0;
  const hasStock = getItemInventories(item).length > 0;

  const showDraft = moderation === 'draft';
  const showRejected = moderation === 'rejected';
  const showProposal = moderation === 'proposal_pending';
  const showNoPhoto = !hasPhoto;
  const showNoStock = !hasStock;

  if (!showDraft && !showRejected && !showProposal && !showNoPhoto && !showNoStock) {
    return null;
  }

  return (
    <View
      style={[
        styles.strip,
        {
          marginBottom: spacing.md,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.background.paper,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.divider,
        },
      ]}
    >
      {showDraft ? (
        <View style={styles.row}>
          <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
            {t(
              'business.items.attention.draftHint',
              'Publish this item to make it visible to customers.'
            )}
          </Text>
          <Button
            mode="contained"
            compact
            disabled={busy}
            loading={busy}
            onPress={onPublish}
          >
            {t('business.items.moderation.publish', 'Publish')}
          </Button>
        </View>
      ) : null}

      {showRejected ? (
        <View style={styles.block}>
          {item.rejection_reason ? (
            <>
              <Text variant="labelMedium" style={{ color: colors.text.primary }}>
                {t(
                  'business.items.moderation.rejectionReason',
                  'Why this item was rejected'
                )}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.error.main, marginTop: 4 }}
              >
                {item.rejection_reason}
              </Text>
            </>
          ) : null}
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: 4 }}
          >
            {t(
              'business.items.moderation.resubmitHint',
              'If this item was rejected, saving changes will send it for review again.'
            )}
          </Text>
        </View>
      ) : null}

      {showProposal ? (
        <View style={styles.row}>
          <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
            {t(
              'business.items.attention.aiProposalHint',
              'AI suggestions are ready for your review.'
            )}
          </Text>
          <Button mode="contained-tonal" compact onPress={onReviewAi}>
            {t('business.items.aiProposal.reviewCta', 'Review AI suggestions')}
          </Button>
        </View>
      ) : null}

      {showNoPhoto ? (
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t(
            'business.items.attention.addPhoto',
            'Add a photo so customers can see this item.'
          )}
        </Text>
      ) : null}

      {showNoStock ? (
        <View style={styles.row}>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, flex: 1 }}>
            {t(
              'business.items.attention.noStock',
              'Add stock at a location so customers can order this item.'
            )}
          </Text>
          <Button mode="outlined" compact icon="map-marker-plus" onPress={onAddLocation}>
            {t('business.items.addToLocation', 'Add location')}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  block: {},
});
