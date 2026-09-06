import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { ConfirmActionDialog } from '@/components/dialogs/ConfirmActionDialog';
import { StatusPill } from '@/components/common/StatusPill';
import { useTheme } from '@/contexts/ThemeContext';
import { useItemVariants } from '@/hooks/business/useItemVariants';
import type { BusinessCatalogItem } from '@/types/business/items';
import type { ItemVariant } from '@/types/business/itemVariant';
import { primaryVariantImageUrl } from '@/types/business/itemVariant';
import { VariantWizard } from './VariantWizard';

interface Props {
  item: BusinessCatalogItem;
  businessId: string;
  onChanged: () => void;
  onMessage: (message: string) => void;
}

export function ItemVariantsSection({ item, businessId, onChanged, onMessage }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const { variants, loading, error, refetch, remove, setDefault } = useItemVariants(item.id);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<ItemVariant | null>(null);
  const [deleting, setDeleting] = useState<ItemVariant | null>(null);

  const changed = () => {
    void refetch();
    onChanged();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove(deleting.id);
      onMessage(t('business.variants.deleted', 'Variant deleted'));
      onChanged();
    } catch (caught: unknown) {
      onMessage(caught instanceof Error ? caught.message : t('common.error', 'Something went wrong'));
    } finally {
      setDeleting(null);
    }
  };

  const makeDefault = async (variant: ItemVariant) => {
    try {
      await setDefault(variant.id);
      onMessage(t('business.variants.defaultSaved', 'Default variant updated'));
      onChanged();
    } catch (caught: unknown) {
      onMessage(caught instanceof Error ? caught.message : t('common.error', 'Something went wrong'));
    }
  };

  return (
    <View style={{ marginTop: spacing.lg }}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>
          {t('business.variants.title', 'Item variants')}
        </Text>
        <Button
          mode="contained-tonal"
          icon="plus"
          onPress={() => {
            setEditing(null);
            setWizardOpen(true);
          }}
        >
          {t('business.variants.add', 'Add variant')}
        </Button>
      </View>
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
        {t('business.variants.description', 'Manage colors, sizes, prices, and photos. Stock remains shared by location.')}
      </Text>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      {!loading && variants.length === 0 ? (
        <Text style={{ color: colors.text.secondary }}>
          {t('business.variants.empty', 'No variants yet')}
        </Text>
      ) : null}
      {variants.map((variant) => {
        const image = primaryVariantImageUrl(variant);
        return (
          <View
            key={variant.id}
            style={[
              styles.card,
              {
                borderColor: colors.divider,
                borderRadius: borderRadius.md,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {image ? <Image source={{ uri: image }} style={styles.thumb} resizeMode="cover" /> : null}
            <View style={styles.body}>
              <Text variant="titleSmall" numberOfLines={2}>{variant.name}</Text>
              <View style={styles.pills}>
                {variant.is_default ? (
                  <StatusPill
                    compact
                    label={t('business.variants.default', 'Default option')}
                    backgroundColor={colors.primary.main + '20'}
                    textColor={colors.primary.main}
                  />
                ) : null}
                <StatusPill
                  compact
                  label={variant.is_active !== false
                    ? t('business.variants.active', 'Active')
                    : t('business.variants.inactive', 'Inactive')}
                  backgroundColor={variant.is_active !== false ? colors.success.main + '20' : colors.divider}
                  textColor={variant.is_active !== false ? colors.success.dark : colors.text.secondary}
                />
              </View>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {variant.price != null
                  ? `${variant.price} ${item.currency ?? 'XAF'}`
                  : t('business.variants.inheritsPrice', 'Inherits inventory price')}
              </Text>
              {!variant.is_default ? (
                <Button compact mode="text" onPress={() => void makeDefault(variant)}>
                  {t('business.variants.makeDefault', 'Make default')}
                </Button>
              ) : null}
            </View>
            <View>
              <IconButton
                icon="pencil-outline"
                onPress={() => {
                  setEditing(variant);
                  setWizardOpen(true);
                }}
                accessibilityLabel={t('common.edit', 'Edit')}
              />
              <IconButton
                icon="delete-outline"
                iconColor={colors.error.main}
                onPress={() => setDeleting(variant)}
                accessibilityLabel={t('common.delete', 'Delete')}
              />
            </View>
          </View>
        );
      })}
      <VariantWizard
        visible={wizardOpen}
        item={item}
        businessId={businessId}
        variant={editing}
        onDismiss={() => setWizardOpen(false)}
        onSaved={changed}
        onMessage={onMessage}
      />
      <ConfirmActionDialog
        visible={!!deleting}
        title={t('business.variants.deleteTitle', 'Delete variant?')}
        message={t('business.variants.deleteMessage', 'This option and its photos will be removed.')}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('common.delete', 'Delete')}
        destructive
        onDismiss={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontWeight: '700' },
  card: { flexDirection: 'row', padding: 10, borderWidth: 1, marginBottom: 10, gap: 10 },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  body: { flex: 1, minWidth: 0, gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
