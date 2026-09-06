import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Searchbar, Text } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PrimaryCatalogFab } from '../../components/common/PrimaryCatalogFab';
import { BusinessItemListRow } from '../../components/business/BusinessItemListRow';
import { BusinessIdReviewStatusCard } from '../../components/business/BusinessIdReviewStatusCard';
import { BusinessVerificationBanner } from '../../components/business/BusinessVerificationBanner';
import { ModerationFilterBanner } from '../../components/common/ModerationFilterBanner';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessVerificationStatus } from '../../hooks/useBusinessVerificationStatus';
import { useProfileMe } from '../../hooks/useProfileMe';
import {
  useMainTabContentBottomPadding,
  useTabBarOverlayHeight,
} from '../../hooks/useMainTabContentBottomPadding';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/businessApi';
import type { BusinessCatalogItem } from '../../types/business/items';
import { getItemInventories } from '../../utils/businessItemUtils';
import { isSetupMode, requiresMerchantAction } from '../../utils/merchantSetup';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;
type ItemsRouteParams = NonNullable<BusinessRootStackParamList['BusinessItemsList']>;
type ModerationFilter = NonNullable<ItemsRouteParams['moderationStatus']>;

function itemMatchesLocation(item: BusinessCatalogItem, locationId: string): boolean {
  return getItemInventories(item).some(
    (inv) => inv.business_location_id === locationId || inv.business_location?.id === locationId
  );
}

function itemMatchesSearch(item: BusinessCatalogItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = item.name?.toLowerCase() ?? '';
  const description = item.description?.toLowerCase() ?? '';
  const sku = item.sku?.toLowerCase() ?? '';
  return name.includes(q) || description.includes(q) || sku.includes(q);
}

export default function BusinessItemsListScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const routeParams = (route.params ?? {}) as ItemsRouteParams;
  const listBottomPadding = useMainTabContentBottomPadding(88);
  const tabBarHeight = useTabBarOverlayHeight();
  const { me } = useProfileMe();
  const verification = useBusinessVerificationStatus();
  const isCatalogTab = route.name === 'BusinessCatalog';
  const fabBottom = (isCatalogTab ? tabBarHeight : 0) + 16;
  const mainInterest = me?.business?.main_interest ?? 'sell_items';
  const showIdReviewCard =
    verification.status?.paymentRail === 'mobile_money' &&
    !isSetupMode(verification.status) &&
    !!verification.status.steps.identity &&
    verification.status.steps.identity.status !== 'approved' &&
    verification.status.steps.identity.status !== 'missing';
  const showMmSetupPrompt =
    verification.status?.paymentRail === 'mobile_money' &&
    isSetupMode(verification.status) &&
    requiresMerchantAction(verification.status);
  const mmSetupIsAgreement =
    verification.status?.nextAction === 'sign_agreement';
  const onMmSetupAction = useCallback(() => {
    if (mmSetupIsAgreement) {
      navigation.navigate('BusinessMerchantAgreement');
      return;
    }
    navigation.navigate('Documents', { returnToDashboard: true });
  }, [mmSetupIsAgreement, navigation]);
  const locationId = routeParams?.locationId;
  const moderationStatus = routeParams?.moderationStatus;

  const [items, setItems] = useState<BusinessCatalogItem[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchDraft), 300);
    return () => clearTimeout(id);
  }, [searchDraft]);

  const locationName = useMemo(() => {
    if (!locationId) return null;
    return locations.find((l) => l.id === locationId)?.name ?? null;
  }, [locationId, locations]);

  const clearModerationFilter = useCallback(() => {
    navigation.setParams({ moderationStatus: undefined });
  }, [navigation]);

  useEffect(() => {
    if (!locationId || !locationName) {
      navigation.setOptions({
        title: t('business.items.title', 'Items'),
        headerTitle: undefined,
      });
      return;
    }
    const subtitle = t('business.items.locationFilter', 'Items at {{name}}', {
      name: locationName,
    });
    navigation.setOptions({
      headerTitle: () => (
        <View>
          <Text variant="titleMedium" numberOfLines={1}>
            {t('business.items.title', 'Items')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      ),
    });
  }, [colors.text.secondary, locationId, locationName, navigation, t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await businessApi.catalog.getPageData();
      if (res.success) {
        setItems(res.data.items ?? []);
        setLocations(res.data.business_locations ?? []);
      } else {
        setError(t('business.items.loadError', 'Unable to load catalog items.'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('business.items.loadError', 'Unable to load catalog items.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      if (locationId && !itemMatchesLocation(item, locationId)) return false;
      if (moderationStatus && item.moderation_status !== moderationStatus) return false;
      return itemMatchesSearch(item, debouncedSearch);
    });
    if (!moderationStatus) return list;
    return [...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [debouncedSearch, items, locationId, moderationStatus]);

  const renderItem = useCallback(
    ({ item }: { item: BusinessCatalogItem }) => (
      <BusinessItemListRow
        item={item}
        onPressDetails={() => navigation.navigate('BusinessItemDetail', { itemId: item.id })}
        onPressEdit={() => navigation.navigate('BusinessItemForm', { itemId: item.id })}
        onItemMutated={() => void load()}
      />
    ),
    [load, navigation]
  );

  const moderationBanner = moderationStatus ? (
    <ModerationFilterBanner
      message={
        moderationStatus === 'rejected'
          ? t(
              'business.items.rejectedFilterBanner',
              'Showing items that need updates after rejection.'
            )
          : t(
              'business.items.proposalFilterBanner',
              'Showing items with AI suggestions ready to review.'
            )
      }
      onClear={clearModerationFilter}
      clearLabel={t('business.items.clearFilter', 'Show all')}
    />
  ) : null;

  const emptyForModeration = (status: ModerationFilter) =>
    status === 'rejected'
      ? t(
          'business.items.emptyRejected',
          'No rejected items in your catalog. If this action still appears, pull to refresh the dashboard.'
        )
      : t(
          'business.items.emptyProposal',
          'No items with AI suggestions right now. Pull to refresh the dashboard if needed.'
        );

  const listHeader = (
    <View style={styles.header}>
      {showMmSetupPrompt ? (
        <NoticeBanner
          tone="warning"
          icon="shield-alert-outline"
          title={t('business.lifecycle.setupTitle', 'Finish setting up your store')}
          message={
            mmSetupIsAgreement
              ? t(
                  'business.lifecycle.setupNoticeMobileMoney',
                  'Sign the merchant agreement, then upload a valid government ID (driver’s license, passport, or national ID). We review it before your account can accept orders.'
                )
              : t(
                  'business.setup.stepIdentityDesc',
                  "Upload a national ID, passport, or driver's license."
                )
          }
          actionLabel={
            mmSetupIsAgreement
              ? t('business.verification.signAgreement', 'Sign merchant agreement')
              : t('business.verification.uploadId', 'Upload valid ID')
          }
          onAction={onMmSetupAction}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      {showIdReviewCard && verification.status ? (
        <BusinessIdReviewStatusCard
          status={verification.status}
          onRefresh={verification.refetch}
        />
      ) : null}
      <BusinessVerificationBanner mainInterest={mainInterest} />
      {moderationBanner}
      <Searchbar
        placeholder={t('business.items.searchPlaceholder', 'Search items')}
        value={searchDraft}
        onChangeText={setSearchDraft}
        style={styles.search}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      {loading && items.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: listBottomPadding }]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {error ? (
                <>
                  <Text style={{ textAlign: 'center', color: colors.error.main }}>{error}</Text>
                  <Button
                    mode="contained-tonal"
                    icon="refresh"
                    style={styles.emptyBtn}
                    onPress={() => void load()}
                  >
                    {t('common.retry', 'Retry')}
                  </Button>
                </>
              ) : (
                <>
                  <Text style={{ textAlign: 'center', color: colors.text.secondary }}>
                    {debouncedSearch.trim()
                      ? t('business.items.noMatch', 'No items match your search')
                      : moderationStatus
                        ? emptyForModeration(moderationStatus)
                        : locationId
                          ? t(
                              'business.items.emptyAtLocation',
                              'No items at this location'
                            )
                          : t('business.items.empty', 'No items in catalog')}
                  </Text>
                  {moderationStatus ? (
                    <Button
                      mode="contained-tonal"
                      style={styles.emptyBtn}
                      onPress={clearModerationFilter}
                    >
                      {t('business.items.clearFilter', 'Show all')}
                    </Button>
                  ) : !debouncedSearch.trim() ? (
                    <Button
                      mode="contained"
                      icon="image-plus"
                      style={styles.emptyBtn}
                      onPress={() =>
                        navigation.navigate(
                          'BusinessAddItemFromImage',
                          locationId ? { locationId } : undefined
                        )
                      }
                    >
                      {t('business.items.addFromImage', 'Add from image')}
                    </Button>
                  ) : null}
                </>
              )}
            </View>
          }
        />
      )}
      <PrimaryCatalogFab
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() =>
          navigation.navigate(
            'BusinessAddItemFromImage',
            locationId ? { locationId } : undefined
          )
        }
        accessibilityLabel={t('business.items.addFromImage', 'Add from image')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 4 },
  search: { marginTop: 8, marginBottom: 8 },
  list: { padding: 12, paddingBottom: 88 },
  emptyWrap: { marginTop: 24, alignItems: 'center', paddingHorizontal: 24 },
  emptyBtn: { marginTop: 16 },
  fab: { position: 'absolute', right: 16 },
});
