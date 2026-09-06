import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Menu,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission, usePermissions } from '../../hooks/usePermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { PlatformPermissions } from '../../constants/platformPermissions';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { fetchAdminCatalogItems } from '../../services/adminCatalogItemsApi';
import { fetchAdminBusinesses } from '../../services/adminBusinessesApi';
import type {
  AdminCatalogItemListRow,
  AdminCatalogItemsPagination,
  AdminCatalogModerationStatus,
} from '../../types/adminCatalogItems';

const PAGE_SIZE = 20;

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

function formatPrice(item: AdminCatalogItemListRow): string {
  if (item.price == null) return '—';
  const currency = item.currency ?? '';
  return `${item.price} ${currency}`.trim();
}

export default function AdminItemsBrowserScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(
    PlatformPermissions.CATALOG_CROSS_BUSINESS,
    me
  );
  const { can, isSuperuser } = usePermissions(me);
  const canListBusinesses =
    isSuperuser || can(PlatformPermissions.MANAGE_BUSINESSES);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [businessId, setBusinessId] = useState('');
  const [businessLabel, setBusinessLabel] = useState('');
  const [businessMenuVisible, setBusinessMenuVisible] = useState(false);
  const [businessOptions, setBusinessOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [moderationStatus, setModerationStatus] = useState<
    AdminCatalogModerationStatus | ''
  >('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>(
    'all'
  );
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminCatalogItemListRow[]>([]);
  const [pagination, setPagination] =
    useState<AdminCatalogItemsPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessSearch, setBusinessSearch] = useState('');
  const [businessIdInput, setBusinessIdInput] = useState('');
  const loadSeqRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (canListBusinesses) return;
    const timer = setTimeout(() => {
      const trimmed = businessIdInput.trim();
      const looksLikeUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          trimmed
        );
      setBusinessId(trimmed === '' || looksLikeUuid ? trimmed : '');
    }, 400);
    return () => clearTimeout(timer);
  }, [businessIdInput, canListBusinesses]);

  const isActive =
    activeFilter === 'all'
      ? undefined
      : activeFilter === 'active'
        ? true
        : false;

  const loadPage = useCallback(
    async (pageToLoad: number, opts?: { silent?: boolean }) => {
      if (!canAccess) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      const seq = ++loadSeqRef.current;
      try {
        const res = await fetchAdminCatalogItems({
          q: debouncedQ || undefined,
          businessId: businessId || undefined,
          moderationStatus: moderationStatus || undefined,
          isActive,
          page: pageToLoad,
          limit: PAGE_SIZE,
        });
        if (seq !== loadSeqRef.current) return;
        setItems(res.items);
        setPagination(res.pagination);
      } catch (e: unknown) {
        if (seq !== loadSeqRef.current) return;
        setItems([]);
        setPagination(null);
        setError(
          e instanceof Error
            ? e.message
            : t('admin.itemsBrowser.loadError', 'Could not load items')
        );
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      canAccess,
      debouncedQ,
      businessId,
      moderationStatus,
      isActive,
      t,
    ]
  );

  useEffect(() => {
    if (profileLoading || !canAccess) return;
    setPage(1);
    void loadPage(1);
  }, [
    canAccess,
    profileLoading,
    debouncedQ,
    businessId,
    moderationStatus,
    activeFilter,
    loadPage,
  ]);

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      void loadPage(nextPage);
    },
    [loadPage]
  );

  const searchBusinesses = useCallback(async (search: string) => {
    if (!canListBusinesses) return;
    try {
      const res = await fetchAdminBusinesses({
        search: search.trim() || undefined,
        page: 1,
        limit: 20,
      });
      setBusinessOptions(
        res.items.map((b) => ({ id: b.id, name: b.name || b.id }))
      );
    } catch {
      setBusinessOptions([]);
    }
  }, [canListBusinesses]);

  useEffect(() => {
    if (!businessMenuVisible || !canListBusinesses) return;
    const timer = setTimeout(() => {
      void searchBusinesses(businessSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [businessMenuVisible, businessSearch, canListBusinesses, searchBusinesses]);

  const emptyLabel = useMemo(
    () => t('admin.itemsBrowser.empty', 'No items match these filters'),
    [t]
  );

  if (profileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text variant="titleMedium" style={{ color: colors.text.primary }}>
          {t('admin.itemsBrowser.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <TextInput
          mode="outlined"
          value={q}
          onChangeText={setQ}
          placeholder={t(
            'admin.itemsBrowser.searchPlaceholder',
            'Search name, SKU, description'
          )}
          left={<TextInput.Icon icon="magnify" />}
          dense
        />
        {canListBusinesses ? (
          <Menu
            visible={businessMenuVisible}
            onDismiss={() => setBusinessMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                icon="store"
                onPress={() => setBusinessMenuVisible(true)}
              >
                {businessLabel ||
                  t('admin.itemsBrowser.allBusinesses', 'All businesses')}
              </Button>
            }
          >
            <View style={{ paddingHorizontal: 12, paddingBottom: 8, minWidth: 260 }}>
              <TextInput
                mode="outlined"
                dense
                value={businessSearch}
                onChangeText={setBusinessSearch}
                placeholder={t(
                  'admin.itemsBrowser.businessSearchPlaceholder',
                  'Search businesses'
                )}
              />
            </View>
            <Menu.Item
              onPress={() => {
                setBusinessId('');
                setBusinessLabel('');
                setBusinessMenuVisible(false);
              }}
              title={t('admin.itemsBrowser.allBusinesses', 'All businesses')}
            />
            {businessOptions.map((biz) => (
              <Menu.Item
                key={biz.id}
                onPress={() => {
                  setBusinessId(biz.id);
                  setBusinessLabel(biz.name);
                  setBusinessMenuVisible(false);
                }}
                title={biz.name}
              />
            ))}
          </Menu>
        ) : (
          <TextInput
            mode="outlined"
            value={businessIdInput}
            onChangeText={setBusinessIdInput}
            placeholder={t(
              'admin.itemsBrowser.businessIdPlaceholder',
              'Filter by business ID (optional)'
            )}
            dense
          />
        )}
        <SegmentedButtons
          value={moderationStatus || 'any'}
          onValueChange={(value) =>
            setModerationStatus(
              value === 'any' ? '' : (value as AdminCatalogModerationStatus)
            )
          }
          buttons={[
            {
              value: 'any',
              label: t('admin.itemsBrowser.statusAny', 'Any'),
            },
            {
              value: 'pending',
              label: t('admin.itemsBrowser.statusPending', 'Pending'),
            },
            {
              value: 'approved',
              label: t('admin.itemsBrowser.statusApproved', 'Approved'),
            },
            {
              value: 'rejected',
              label: t('admin.itemsBrowser.statusRejected', 'Rejected'),
            },
          ]}
        />
        <SegmentedButtons
          value={activeFilter}
          onValueChange={(value) =>
            setActiveFilter(value as 'all' | 'active' | 'inactive')
          }
          buttons={[
            { value: 'all', label: t('admin.itemsBrowser.activeAll', 'All') },
            {
              value: 'active',
              label: t('admin.itemsBrowser.activeOnly', 'Active'),
            },
            {
              value: 'inactive',
              label: t('admin.itemsBrowser.inactiveOnly', 'Inactive'),
            },
          ]}
        />
        {error ? (
          <Text style={[typography.body2, { color: colors.error.main }]}>
            {error}
          </Text>
        ) : null}
        {loading ? <ActivityIndicator /> : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.sm,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadPage(page, { silent: true });
            }}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text
              style={[
                typography.body2,
                { color: colors.text.secondary, textAlign: 'center' },
              ]}
            >
              {emptyLabel}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('AdminItemDetail', { itemId: item.id })
            }
            style={[
              styles.card,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.sm,
              },
            ]}
          >
            {item.thumbnailUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.thumb}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.thumb,
                  { backgroundColor: colors.pageBackground },
                ]}
              />
            )}
            <View style={styles.cardBody}>
              <Text
                style={[typography.body, { color: colors.text.primary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[typography.caption, { color: colors.text.secondary }]}
                numberOfLines={1}
              >
                {item.business?.name ?? '—'}
              </Text>
              <View style={styles.metaRow}>
                <Text
                  style={[typography.caption, { color: colors.text.primary }]}
                >
                  {formatPrice(item)}
                </Text>
                {item.moderationStatus ? (
                  <StatusPill
                    compact
                    label={item.moderationStatus}
                    backgroundColor={colors.pageBackground}
                    textColor={colors.text.secondary}
                  />
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          pagination && pagination.totalPages > 1 ? (
            <View style={styles.pager}>
              <Button
                mode="text"
                disabled={page <= 1}
                onPress={() => goToPage(Math.max(1, page - 1))}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                {page}/{pagination.totalPages}
              </Text>
              <Button
                mode="text"
                disabled={page >= pagination.totalPages}
                onPress={() => goToPage(page + 1)}
              >
                {t('common.next', 'Next')}
              </Button>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
});
