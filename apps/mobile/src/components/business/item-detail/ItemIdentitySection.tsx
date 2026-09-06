import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Text } from 'react-native-paper';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusPill } from '@/components/common/StatusPill';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/hooks/useLanguage';
import type { BusinessCatalogItem } from '@/types/business/items';
import {
  canToggleItemActive,
  itemModerationColors,
  itemModerationDefaultLabel,
  itemModerationLabelKey,
} from '@/utils/items/itemStatusUi';
import { ItemCategorySection } from './ItemCategorySection';
import { itemIdentitySpecs } from './itemIdentitySpecs';

type Props = {
  item: BusinessCatalogItem;
  onEdit: () => void;
  onCategoryChanged: () => void;
  onMessage: (text: string) => void;
};

export function ItemIdentitySection({
  item,
  onEdit,
  onCategoryChanged,
  onMessage,
}: Props) {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { colors, spacing } = useTheme();
  const [descExpanded, setDescExpanded] = useState(false);

  const moderation = item.moderation_status;
  const modColors = itemModerationColors(moderation, colors);
  const showActivePill = canToggleItemActive(moderation);
  const description = item.description?.trim() ?? '';
  const descNeedsMore = description.length > 120;
  const specs = itemIdentitySpecs(item);
  const collectionChips = item.item_collections ?? [];
  const hasSpecs = Boolean(specs.weightLabel || specs.dimensionsLabel);

  return (
    <SectionCard noPadding style={{ marginBottom: spacing.md }}>
      <View
        style={[
          styles.nameRow,
          {
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.xxs,
          },
        ]}
      >
        <Text
          variant="headlineSmall"
          style={[styles.name, { color: colors.text.primary, flex: 1 }]}
          numberOfLines={3}
        >
          {item.name}
        </Text>
        <Button
          mode="contained-tonal"
          compact
          icon="pencil-outline"
          onPress={onEdit}
          style={styles.editBtn}
        >
          {t('business.items.editDetails', 'Edit details')}
        </Button>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          paddingTop: spacing.xxs,
        }}
      >
        <View style={styles.pillRow}>
          {moderation ? (
            <StatusPill
              compact
              label={t(
                itemModerationLabelKey(moderation),
                itemModerationDefaultLabel(moderation)
              )}
              backgroundColor={modColors.backgroundColor}
              textColor={modColors.textColor}
            />
          ) : null}
          {showActivePill ? (
            <StatusPill
              compact
              label={
                item.is_active
                  ? t('business.items.active', 'Active')
                  : t('business.items.inactive', 'Inactive')
              }
              backgroundColor={
                item.is_active ? colors.success.main + '22' : colors.divider
              }
              textColor={
                item.is_active
                  ? colors.success.dark ?? colors.success.main
                  : colors.text.secondary
              }
            />
          ) : null}
        </View>

        {item.sku ? (
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: 4 }}
          >
            {t('business.items.sku', 'SKU')}: {item.sku}
          </Text>
        ) : null}

        {description ? (
          <View style={{ marginTop: spacing.xs }}>
            <Text
              variant="bodyMedium"
              style={[styles.desc, { color: colors.text.secondary }]}
              numberOfLines={descExpanded ? undefined : 3}
            >
              {description}
            </Text>
            {descNeedsMore ? (
              <Button
                mode="text"
                compact
                onPress={() => setDescExpanded((v) => !v)}
                style={styles.moreBtn}
              >
                {descExpanded
                  ? t('common.less', 'Less')
                  : t('common.more', 'More')}
              </Button>
            ) : null}
          </View>
        ) : null}

        {hasSpecs ? (
          <View style={[styles.specsRow, { marginTop: spacing.sm, gap: spacing.md }]}>
            {specs.weightLabel ? (
              <View style={styles.specItem}>
                <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                  {t('business.items.weight', 'Weight')}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
                  {specs.weightLabel}
                </Text>
              </View>
            ) : null}
            {specs.dimensionsLabel ? (
              <View style={[styles.specItem, { flex: 1, minWidth: 0 }]}>
                <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
                  {t('business.items.dimensions', 'Dimensions')}
                </Text>
                <Text
                  variant="bodyMedium"
                  numberOfLines={2}
                  style={{ color: colors.text.primary }}
                >
                  {specs.dimensionsLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {collectionChips.length > 0 ? (
          <View style={[styles.chipRow, { marginTop: spacing.sm }]}>
            {collectionChips.map((link) => {
              const c = link.collection;
              if (!c) return null;
              const label = currentLanguage === 'fr' ? c.name_fr : c.name_en;
              return (
                <Chip key={link.collection_id} compact style={styles.chip}>
                  {label}
                </Chip>
              );
            })}
          </View>
        ) : null}

        <ItemCategorySection
          item={item}
          embedded
          onChanged={onCategoryChanged}
          onMessage={onMessage}
        />
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: { fontWeight: '700' },
  editBtn: { flexShrink: 0, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  desc: { lineHeight: 22 },
  moreBtn: { alignSelf: 'flex-start', marginLeft: -8 },
  specsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  specItem: { minWidth: 80 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { marginBottom: 4 },
});
