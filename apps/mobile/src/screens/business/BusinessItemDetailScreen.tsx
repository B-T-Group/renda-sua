import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AddInventoryLocationDialog } from '../../components/business/AddInventoryLocationDialog';
import { BusinessItemRowActions } from '../../components/business/BusinessItemRowActions';
import { ItemDetailAttentionStrip } from '../../components/business/item-detail/ItemDetailAttentionStrip';
import { ItemIdentitySection } from '../../components/business/item-detail/ItemIdentitySection';
import { ItemImageManagementSection } from '../../components/business/item-detail/ItemImageManagementSection';
import { ItemTaxCategorySection } from '../../components/business/item-detail/ItemTaxCategorySection';
import { ManageItemCollectionsDialog } from '../../components/business/item-detail/ManageItemCollectionsDialog';
import { RefineItemWithAiDialog } from '../../components/business/item-detail/RefineItemWithAiDialog';
import { ItemInventoryLocationCard } from '../../components/business/ItemInventoryLocationCard';
import { ItemVariantsSection } from '../../components/business/variants/ItemVariantsSection';
import { ImageLightbox } from '../../components/common/ImageLightbox';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/businessApi';
import type { BusinessCatalogItem } from '../../types/business/items';
import { isCookedFoodItem } from '../../utils/businessFood';
import { getItemInventories } from '../../utils/businessItemUtils';
import { orderedItemImages } from '../../utils/itemImages';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'BusinessItemDetail'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

function BusinessItemDetailContent({ route, navigation }: Props) {
  const { itemId } = route.params;
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const stackNav = useNavigation<Nav>();
  const { me } = useProfileMe();
  const businessId = me?.business?.id ?? '';

  const [item, setItem] = useState<BusinessCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addLocOpen, setAddLocOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      const res = await businessApi.catalog.getItem(itemId);
      if (res.success && res.data?.item) setItem(res.data.item);
      else setItem(null);
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ soft: true });
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load({ soft: true });
    }, [load])
  );

  const publishItem = useCallback(() => {
    void (async () => {
      setBusy(true);
      try {
        const res = await businessApi.catalog.publishItem(itemId);
        if (!res.success) {
          throw new Error(res.error || 'Publish failed');
        }
        setSnackbar(
          t(
            'business.items.moderation.publishSuccess',
            'Item submitted for approval'
          )
        );
        await load();
      } catch (e: unknown) {
        setSnackbar(
          e instanceof Error
            ? e.message
            : t('business.items.moderation.publishFailed', 'Could not publish item')
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [itemId, load, t]);

  const inventories = useMemo(
    () => (item ? getItemInventories(item) : []),
    [item]
  );
  const activeVariants = useMemo(
    () =>
      (item?.item_variants ?? []).filter(
        (variant) => variant.is_active !== false
      ),
    [item?.item_variants]
  );
  const isFood = item ? isCookedFoodItem(item) : false;
  const foodHoursInventoryIds = useMemo(() => {
    if (!isFood) return new Set<string>();
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const row of inventories) {
      const locationId = row.business_location_id ?? row.business_location?.id;
      if (!locationId || seen.has(locationId)) continue;
      seen.add(locationId);
      ids.add(row.id);
    }
    return ids;
  }, [inventories, isFood]);

  if (loading && !item) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!item) {
    return (
      <Text style={{ padding: 16, color: colors.text.secondary }}>
        {t('business.items.notFound', 'Item not found')}
      </Text>
    );
  }

  const galleryImages = orderedItemImages(item.item_images).map((img) => ({
    id: img.id,
    image_url: img.image_url,
  }));
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.pageBackground }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary.main]}
            tintColor={colors.primary.main}
          />
        }
      >
        <ItemDetailAttentionStrip
          item={item}
          busy={busy}
          onPublish={publishItem}
          onReviewAi={() =>
            stackNav.navigate('BusinessItemAiProposal', { itemId: item.id })
          }
          onAddLocation={() => setAddLocOpen(true)}
        />

        <ItemIdentitySection
          item={item}
          onEdit={() => navigation.navigate('BusinessItemForm', { itemId: item.id })}
          onCategoryChanged={() => void load()}
          onMessage={setSnackbar}
        />

        {businessId ? (
          <ItemImageManagementSection
            item={item}
            businessId={businessId}
            variant="hero"
            imageCleanupEnabled={(me?.business?.ai_tokens ?? 0) > 0}
            aiTokensRemaining={me?.business?.ai_tokens ?? 0}
            onChanged={() => void load()}
            onMessage={setSnackbar}
            onPreviewPhoto={(index) => {
              setLightboxIdx(index);
              setLightboxOpen(true);
            }}
          />
        ) : null}

        <View style={styles.section}>
          <BusinessItemRowActions
            item={item}
            hideViewButton
            toggleVariant="inline"
            actionLayout="labeled"
            onCollections={() => setCollectionsOpen(true)}
            onRefineAi={() => setRefineOpen(true)}
            onRequestAddInventory={() => setAddLocOpen(true)}
            onSuccess={() => void load()}
          />
          <Button
            mode="outlined"
            icon="truck-delivery-outline"
            style={{ marginTop: spacing.sm }}
            onPress={() =>
              navigation.navigate('BusinessItemFulfillment', { itemId: item.id })
            }
          >
            {t('business.items.fulfillment.editCta', 'Fulfillment methods')}
          </Button>
          <ItemTaxCategorySection
            item={item}
            onChanged={() => void load()}
            onMessage={setSnackbar}
          />
        </View>

        {businessId ? (
          <ItemVariantsSection
            item={item}
            businessId={businessId}
            onChanged={() => void load({ soft: true })}
            onMessage={setSnackbar}
          />
        ) : null}

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('business.items.inventory', 'Inventory by location')}
          </Text>
          <Button
            mode="outlined"
            icon="map-marker-plus"
            compact
            onPress={() => setAddLocOpen(true)}
          >
            {t('business.items.addToLocation', 'Add location')}
          </Button>
        </View>

        {inventories.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              {
                borderColor: colors.divider,
                borderRadius: borderRadius.lg,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <MaterialCommunityIcons name="warehouse" size={36} color={colors.text.disabled} />
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 8 }}>
              {t('business.items.noInventoryRows', 'No inventory at any location yet.')}
            </Text>
            <Button mode="contained" icon="plus" onPress={() => setAddLocOpen(true)} style={{ marginTop: 12 }}>
              {t('business.items.addToLocation', 'Add location')}
            </Button>
          </View>
        ) : (
          inventories.map((row) => (
            <ItemInventoryLocationCard
              key={row.id}
              row={row}
              itemId={item.id}
              showFoodHours={foodHoursInventoryIds.has(row.id)}
              currency={item.currency ?? 'XAF'}
              defaultPrice={item.price ?? 0}
              variants={activeVariants}
              onSaved={() => void load({ soft: true })}
            />
          ))
        )}
      </ScrollView>

      <ManageItemCollectionsDialog
        visible={collectionsOpen}
        itemId={item.id}
        onDismiss={() => setCollectionsOpen(false)}
        onSaved={() => {
          setSnackbar(t('business.items.collections.saved', 'Collections updated'));
          void load();
        }}
      />

      <RefineItemWithAiDialog
        visible={refineOpen}
        item={item}
        onDismiss={() => setRefineOpen(false)}
        onApplied={() => {
          setSnackbar(t('business.items.updated', 'Item updated'));
          void load();
        }}
      />

      <AddInventoryLocationDialog
        visible={addLocOpen}
        item={item}
        onDismiss={() => setAddLocOpen(false)}
        onCreated={() => {
          setSnackbar(t('business.items.addToLocationSuccess', 'Stock added at location'));
          void load();
        }}
      />

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        {snackbar}
      </Snackbar>

      <ImageLightbox
        visible={lightboxOpen}
        images={galleryImages}
        index={lightboxIdx}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIdx}
      />
    </>
  );
}

export default function BusinessItemDetailScreen(props: Props) {
  const { navigation } = props;
  const { t } = useTranslation();
  const { colors } = useTheme();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: t('business.items.detailTitle', 'Item'),
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', 'Back')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
        </Pressable>
      ),
    });
  }, [navigation, t, colors.text.primary]);

  return <BusinessItemDetailContent {...props} />;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  section: { marginTop: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: '700', flex: 1 },
  emptyBox: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
  },
  backBtn: { marginLeft: 8, paddingVertical: 4, justifyContent: 'center' },
});
