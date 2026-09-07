import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Snackbar,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusPill } from '../../components/common/StatusPill';
import { ModerationImagePreview } from '../../components/moderation/ModerationImagePreview';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import {
  approveRentalListing,
  fetchRentalModerationQueue,
  rejectRentalListing,
} from '../../services/adminRentalsApi';
import type {
  AdminRentalModerationListingRow,
  AdminRentalModerationPagination,
  RentalModerationQueueStatus,
} from '../../types/adminRentals';
import {
  formatRentalMoney,
  rentalListingModerationColors,
} from '../../utils/rentals';

const PAGE_SIZE = 20;

export default function AdminRentalListingsModerationScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { me, loading: profileLoading } = useProfileMe();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_RENTALS, me);

  const [status, setStatus] = useState<RentalModerationQueueStatus>('pending');
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<AdminRentalModerationListingRow[]>([]);
  const [pagination, setPagination] = useState<AdminRentalModerationPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [approveListing, setApproveListing] = useState<AdminRentalModerationListingRow | null>(null);
  const [rejectListing, setRejectListing] = useState<AdminRentalModerationListingRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAdmin) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetchRentalModerationQueue({ status, page, limit: PAGE_SIZE });
        setListings(res.listings);
        setPagination(res.pagination);
      } catch (e: unknown) {
        setListings([]);
        setPagination(null);
        setError(
          e instanceof Error
            ? e.message
            : t('admin.rentals.moderation.loadError', 'Could not load queue')
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, page, status, t]
  );

  useEffect(() => {
    if (!profileLoading && isAdmin) void load();
  }, [isAdmin, load, profileLoading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

  const onConfirmApprove = useCallback(async () => {
    if (!approveListing) return;
    setActionBusy(true);
    try {
      const ok = await approveRentalListing(approveListing.id);
      setApproveListing(null);
      if (ok) {
        setSnack(t('admin.rentals.moderation.approveSuccess', 'Listing approved'));
        await load({ silent: true });
      } else {
        setSnack(t('admin.rentals.moderation.actionFailed', 'Action failed'));
      }
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.rentals.moderation.actionFailed', 'Action failed')
      );
    } finally {
      setActionBusy(false);
    }
  }, [approveListing, load, t]);

  const onConfirmReject = useCallback(async () => {
    const reason = rejectNote.trim();
    if (!rejectListing || !reason) return;
    setActionBusy(true);
    try {
      const ok = await rejectRentalListing(rejectListing.id, reason);
      setRejectListing(null);
      setRejectNote('');
      if (ok) {
        setSnack(t('admin.rentals.moderation.rejectSuccess', 'Listing rejected'));
        await load({ silent: true });
      } else {
        setSnack(t('admin.rentals.moderation.actionFailed', 'Action failed'));
      }
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.rentals.moderation.actionFailed', 'Action failed')
      );
    } finally {
      setActionBusy(false);
    }
  }, [load, rejectListing, rejectNote, t]);

  const renderItem = useCallback(
    ({ item }: { item: AdminRentalModerationListingRow }) => {
      const pending =
        item.moderation_status === 'pending' || item.moderation_status === 'ai_reviewing';
      const modColors = rentalListingModerationColors(item.moderation_status, colors);
      const images = item.rental_item?.rental_item_images ?? [];
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
          {/* Image thumbnails */}
          <ModerationImagePreview images={images} />

          <Text
            style={[typography.subtitle1, { color: colors.text.primary, marginTop: spacing.xs }]}
            numberOfLines={2}
          >
            {item.rental_item?.name ?? '—'}
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
            {item.rental_item?.business?.name ?? '—'}
            {' · '}
            {item.business_location?.name ?? '—'}
          </Text>
          <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]}>
            {formatRentalMoney(Number(item.base_price_per_hour), 'XAF')} /{' '}
            {t('rentals.perHour', 'hr')}
          </Text>
          <StatusPill
            compact
            style={{ marginTop: 8, alignSelf: 'flex-start' }}
            label={
              item.moderation_status === 'rejected'
                ? t('business.rentals.moderation.rejected', 'Rejected')
                : item.moderation_status === 'ai_reviewing'
                  ? t('business.rentals.moderation.aiReviewing', 'AI reviewing')
                  : t('business.rentals.moderation.pending', 'Pending approval')
            }
            backgroundColor={modColors.backgroundColor}
            textColor={modColors.textColor}
          />
          {pending ? (
            <View style={[styles.actions, { marginTop: spacing.sm }]}>
              <Button
                mode="contained"
                disabled={actionBusy}
                onPress={() => setApproveListing(item)}
              >
                {t('admin.rentals.moderation.approve', 'Approve')}
              </Button>
              <Button
                mode="outlined"
                textColor={colors.error.main}
                disabled={actionBusy}
                onPress={() => {
                  setRejectListing(item);
                  setRejectNote('');
                }}
              >
                {t('admin.rentals.moderation.reject', 'Reject')}
              </Button>
            </View>
          ) : null}
        </View>
      );
    },
    [actionBusy, borderRadius.md, colors, shadows.sm, spacing, t, typography]
  );

  if (profileLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View
        style={[styles.center, { padding: spacing.lg, backgroundColor: colors.pageBackground }]}
      >
        <Text style={[typography.h6, { color: colors.error.main, textAlign: 'center' }]}>
          {t('admin.rentals.moderation.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  const firstApproveImage = approveListing?.rental_item?.rental_item_images?.[0];
  const firstRejectImage = rejectListing?.rental_item?.rental_item_images?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={[typography.body2, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
          {t(
            'admin.rentals.moderation.subtitle',
            'Review rental listings before they appear in the public catalog.'
          )}
        </Text>
        <SegmentedButtons
          value={status}
          onValueChange={(v) => {
            setStatus(v as RentalModerationQueueStatus);
            setPage(1);
          }}
          buttons={[
            { value: 'pending', label: t('admin.rentals.moderation.filterPending', 'Pending') },
            { value: 'rejected', label: t('admin.rentals.moderation.filterRejected', 'Rejected') },
            { value: 'all', label: t('admin.rentals.moderation.filterAll', 'All') },
          ]}
        />
      </View>

      {error ? (
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.error.main }}>{error}</Text>
          <Button
            mode="contained-tonal"
            style={{ marginTop: spacing.sm }}
            onPress={() => void load()}
          >
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      ) : null}

      {loading && listings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary.main]}
              tintColor={colors.primary.main}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <Text
                style={[
                  typography.body2,
                  { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xl },
                ]}
              >
                {t('admin.rentals.moderation.empty', 'No listings in this queue')}
              </Text>
            ) : null
          }
          ListFooterComponent={
            pagination && pagination.totalPages > 1 ? (
              <View style={[styles.pager, { marginTop: spacing.md }]}>
                <Button
                  mode="outlined"
                  disabled={!pagination.hasPrev || loading}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <Text style={[typography.caption, { color: colors.text.secondary }]}>
                  {t('admin.rentals.moderation.pageOf', 'Page {{page}} of {{total}}', {
                    page: pagination.page,
                    total: pagination.totalPages,
                  })}
                </Text>
                <Button
                  mode="outlined"
                  disabled={!pagination.hasNext || loading}
                  onPress={() => setPage((p) => p + 1)}
                >
                  {t('common.next', 'Next')}
                </Button>
              </View>
            ) : null
          }
        />
      )}

      {/* Approve confirm modal — native Modal to avoid iOS Dialog border issues */}
      <Modal
        visible={!!approveListing}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setApproveListing(null)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.scrim}
          onPress={() => !actionBusy && setApproveListing(null)}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                width: screenWidth - spacing.lg * 2,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {firstApproveImage ? (
              <Image
                source={{ uri: firstApproveImage.image_url }}
                style={[
                  styles.confirmThumb,
                  { borderRadius: borderRadius.sm, borderColor: colors.divider },
                ]}
                resizeMode="cover"
              />
            ) : null}
            <Text
              style={[
                typography.h6,
                { color: colors.text.primary, marginTop: firstApproveImage ? spacing.sm : 0 },
              ]}
            >
              {t('admin.rentals.moderation.approveTitle', 'Approve listing?')}
            </Text>
            {approveListing ? (
              <Text
                style={[typography.subtitle2, { color: colors.text.secondary, marginTop: 4 }]}
                numberOfLines={2}
              >
                {approveListing.rental_item?.name ?? ''}
              </Text>
            ) : null}
            <Text
              style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.sm }]}
            >
              {t(
                'admin.rentals.moderation.approveBody',
                'This listing will become visible in the public rental catalog.'
              )}
            </Text>
            <View style={[styles.sheetActions, { marginTop: spacing.md }]}>
              <Button
                mode="text"
                disabled={actionBusy}
                onPress={() => setApproveListing(null)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                mode="contained"
                loading={actionBusy}
                onPress={() => void onConfirmApprove()}
              >
                {t('admin.rentals.moderation.approve', 'Approve')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reject confirm modal */}
      <Modal
        visible={!!rejectListing}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setRejectListing(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.kavFull}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={styles.scrim}
            onPress={() => {
              Keyboard.dismiss();
              if (!actionBusy) setRejectListing(null);
            }}
          >
            <Pressable
              style={[
                styles.sheet,
                {
                  width: screenWidth - spacing.lg * 2,
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {firstRejectImage ? (
                <Image
                  source={{ uri: firstRejectImage.image_url }}
                  style={[
                    styles.confirmThumb,
                    { borderRadius: borderRadius.sm, borderColor: colors.divider },
                  ]}
                  resizeMode="cover"
                />
              ) : null}
              <Text
                style={[
                  typography.h6,
                  { color: colors.text.primary, marginTop: firstRejectImage ? spacing.sm : 0 },
                ]}
              >
                {t('admin.rentals.moderation.rejectTitle', 'Reject listing')}
              </Text>
              {rejectListing ? (
                <Text
                  style={[typography.subtitle2, { color: colors.text.secondary, marginTop: 4 }]}
                  numberOfLines={2}
                >
                  {rejectListing.rental_item?.name ?? ''}
                </Text>
              ) : null}
              <Text
                style={[
                  typography.body2,
                  {
                    color: colors.text.secondary,
                    marginTop: spacing.sm,
                    marginBottom: spacing.sm,
                  },
                ]}
              >
                {t(
                  'admin.rentals.moderation.rejectBody',
                  'Provide a reason. The business will be notified by email.'
                )}
              </Text>
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={3}
                value={rejectNote}
                onChangeText={setRejectNote}
                maxLength={8000}
                blurOnSubmit
                placeholder={t(
                  'admin.rentals.moderation.rejectPlaceholder',
                  'Reason for rejection'
                )}
              />
              <View style={[styles.sheetActions, { marginTop: spacing.md }]}>
                <Button
                  mode="text"
                  disabled={actionBusy}
                  onPress={() => {
                    Keyboard.dismiss();
                    setRejectListing(null);
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  loading={actionBusy}
                  disabled={!rejectNote.trim()}
                  buttonColor={colors.error.main}
                  onPress={() => void onConfirmReject()}
                >
                  {t('admin.rentals.moderation.reject', 'Reject')}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kavFull: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    maxHeight: '80%',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmThumb: {
    width: '100%',
    height: 160,
    borderWidth: 1,
  },
});
