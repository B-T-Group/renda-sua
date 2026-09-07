import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Snackbar, Text } from 'react-native-paper';
import { SubtleExtendedFab } from '../../components/common/SubtleExtendedFab';
import { BusinessLocationCard } from '../../components/business/BusinessLocationCard';
import { BusinessLocationCardSkeleton } from '../../components/business/BusinessLocationCardSkeleton';
import { LocationTransferInbox } from '../../components/business/LocationTransferInbox';
import { TransferLocationModal } from '../../components/business/TransferLocationModal';
import { TransferRequestDetailSheet } from '../../components/business/TransferRequestDetailSheet';
import { ConfirmActionDialog } from '../../components/dialogs/ConfirmActionDialog';
import { MobilePaymentPhoneChooserSheet } from '../../components/dialogs/MobilePaymentPhoneChooserSheet';
import { MobilePaymentPhoneVerifyModal } from '../../components/dialogs/MobilePaymentPhoneVerifyModal';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import { useLocationTransfers } from '../../hooks/business/useLocationTransfers';
import { useProfileMe } from '../../hooks/useProfileMe';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { navigateBusinessCatalogTab } from '../../utils/navigateBusinessTabs';
import { agentApi } from '../../services/agentApi';
import { businessApi } from '../../services/businessApi';
import type { AccountInfoRow } from '../../types/accountWallet';
import type { BusinessLocation, LocationAccountSummary } from '../../types/business/locations';
import type {
  MobilePaymentPhone,
  MobilePaymentPhoneModalMode,
  MobilePaymentPhoneSummary,
} from '../../types/mobilePaymentPhone';
import { spacing } from '../../theme/spacing';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;
type Route = NativeStackScreenProps<
  BusinessRootStackParamList,
  'BusinessLocationsList'
>['route'];

function accountForLocation(
  accounts: AccountInfoRow[],
  locationId: string
): LocationAccountSummary | null {
  const row = accounts.find((a) => a.business_location_id === locationId);
  if (!row) return null;
  return {
    currency: row.currency,
    available_balance: row.available_balance,
    total_balance: row.total_balance,
    withheld_balance: row.withheld_balance,
  };
}

export default function BusinessLocationsListScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { me, loading: profileLoading } = useProfileMe();
  const businessId = me?.business?.id;
  const { isStripeRail, loading: stripeRailLoading } = useIsStripeRail();
  const { phones, fetchPhones, verificationMethod } = useMobilePaymentPhones(!isStripeRail);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [accounts, setAccounts] = useState<AccountInfoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const dependenciesReady = !profileLoading && !stripeRailLoading;
  const contentReady = hasLoadedOnce && dependenciesReady;
  const [toggleTarget, setToggleTarget] = useState<BusinessLocation | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusinessLocation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [transferTarget, setTransferTarget] = useState<BusinessLocation | null>(null);
  const [transferRefresh, setTransferRefresh] = useState(0);
  const [detailRequestId, setDetailRequestId] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserTarget, setChooserTarget] = useState<BusinessLocation | null>(null);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneModalMode, setPhoneModalMode] = useState<MobilePaymentPhoneModalMode>('verify');
  const [phoneModalTarget, setPhoneModalTarget] = useState<BusinessLocation | null>(null);
  const [phoneModalInitial, setPhoneModalInitial] = useState<MobilePaymentPhoneSummary | null>(
    null
  );
  const { outgoing, fetchPending } = useLocationTransfers(businessId);

  useEffect(() => {
    const id = route.params?.transferRequestId;
    if (!id) return;
    setDetailRequestId(id);
    setHighlightRequestId(id);
    navigation.setParams({ transferRequestId: undefined });
  }, [route.params?.transferRequestId, navigation]);

  useEffect(() => {
    if (!route.params?.hoursUpdated) return;
    setSnack(
      t('business.locations.operatingHours.saved', 'Operating hours updated')
    );
    navigation.setParams({ hoursUpdated: undefined });
  }, [route.params?.hoursUpdated, navigation, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, accRes] = await Promise.all([
        businessApi.locations.list(),
        agentApi.accounts.getInfo(),
        fetchPending(),
      ]);
      if (locRes.success) setLocations(locRes.data.business_locations ?? []);
      if (accRes.success && accRes.data?.accounts) setAccounts(accRes.data.accounts);
      setTransferRefresh((n) => n + 1);
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [fetchPending]);

  useEffect(() => {
    if (!loading && dependenciesReady) {
      setHasLoadedOnce(true);
    }
  }, [loading, dependenciesReady]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const pendingLocationIds = useMemo(
    () => new Set(outgoing.map((r) => r.business_location_id)),
    [outgoing]
  );

  const accountsByLocation = useMemo(() => {
    const map = new Map<string, LocationAccountSummary>();
    for (const loc of locations) {
      const acc = accountForLocation(accounts, loc.id);
      if (acc) map.set(loc.id, acc);
    }
    return map;
  }, [locations, accounts]);

  const confirmToggle = useCallback(async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await businessApi.locations.update(toggleTarget.id, {
        is_active: !toggleTarget.is_active,
      });
      setToggleTarget(null);
      await load();
    } finally {
      setToggling(false);
    }
  }, [toggleTarget, load]);

  const deleteErrorMessage = useCallback(
    (error: unknown) => {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : undefined;
      if (code === 'LOCATION_HAS_INVENTORY') {
        return t(
          'business.locations.cannotDeleteHasInventory',
          'Cannot delete a location that still has items. Remove items from this location first.'
        );
      }
      if (code === 'LOCATION_HAS_BALANCE') {
        return t(
          'business.locations.cannotDeleteHasBalance',
          'Cannot delete a location that still has account balance. Withdraw or transfer funds first.'
        );
      }
      if (code === 'ADDRESS_PRIMARY_DELETE_FORBIDDEN') {
        return t(
          'business.locations.cannotDeletePrimary',
          'Cannot delete primary location'
        );
      }
      if (code === 'ADDRESS_MINIMUM_REQUIRED') {
        return t(
          'business.locations.cannotDeleteOnlyLocation',
          'Cannot delete the only location. Each business must have at least one location.'
        );
      }
      if (error instanceof Error && error.message) return error.message;
      return t('business.locations.deleteError', 'Failed to delete location');
    },
    [t]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await businessApi.locations.delete(deleteTarget.id);
      setDeleteTarget(null);
      setSnack(
        t('business.locations.locationDeleted', 'Location deleted successfully')
      );
      await load();
    } catch (error: unknown) {
      setSnack(deleteErrorMessage(error));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleteErrorMessage, load, t]);

  const onTransferChanged = useCallback(() => {
    setTransferRefresh((n) => n + 1);
    void load();
  }, [load]);

  const attachPhoneToLocation = useCallback(
    async (location: BusinessLocation, phoneId: string) => {
      try {
        await businessApi.locations.update(location.id, {
          mobile_payment_phone_id: phoneId,
        });
        setChooserOpen(false);
        setChooserTarget(null);
        setPhoneModalOpen(false);
        setPhoneModalTarget(null);
        setPhoneModalInitial(null);
        await Promise.all([load(), fetchPhones()]);
        setSnack(t('mobilePaymentPhone.linked', 'Mobile money number linked to this location'));
      } catch {
        setSnack(t('mobilePaymentPhone.attachFailed', 'Could not link number to location'));
      }
    },
    [load, fetchPhones, t]
  );

  const openChooser = useCallback(
    (location: BusinessLocation) => {
      setChooserTarget(location);
      setChooserOpen(true);
      void fetchPhones();
    },
    [fetchPhones]
  );

  const openPhoneModal = useCallback(
    (
      location: BusinessLocation,
      mode: MobilePaymentPhoneModalMode,
      initial?: MobilePaymentPhoneSummary | null
    ) => {
      setChooserOpen(false);
      setPhoneModalTarget(location);
      setPhoneModalMode(mode);
      setPhoneModalInitial(initial ?? location.mobile_payment_phone ?? null);
      setPhoneModalOpen(true);
    },
    []
  );

  const handlePhoneCompleted = useCallback(
    async (phone: MobilePaymentPhone) => {
      const location = phoneModalTarget ?? chooserTarget;
      if (!location) return;
      await attachPhoneToLocation(location, phone.id);
    },
    [phoneModalTarget, chooserTarget, attachPhoneToLocation]
  );

  const handleUnlinkLocationPhone = useCallback(
    async (location: BusinessLocation) => {
      try {
        await businessApi.locations.update(location.id, { mobile_payment_phone_id: null });
        await load();
        setSnack(
          t(
            'mobilePaymentPhone.unlinked',
            'Mobile payment number unlinked from this location'
          )
        );
      } catch (error: unknown) {
        setSnack(
          error instanceof Error
            ? error.message
            : t('mobilePaymentPhone.unlinkFailed', 'Could not unlink number')
        );
      }
    },
    [load, t]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      {!contentReady && !detailRequestId ? (
        <BusinessLocationCardSkeleton count={3} />
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void load()} />
          }
          ListHeaderComponent={
            <LocationTransferInbox
              businessId={businessId}
              refreshToken={transferRefresh}
              highlightRequestId={highlightRequestId}
              onViewRequest={(id) => setDetailRequestId(id)}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.text.secondary }]}>
              {t('business.locations.empty', 'No locations yet')}
            </Text>
          }
          renderItem={({ item }) => (
            <BusinessLocationCard
              location={item}
              account={accountsByLocation.get(item.id) ?? null}
              isStripeRail={isStripeRail}
              transferPending={pendingLocationIds.has(item.id)}
              businessAccountType={me?.business?.account_type}
              onEdit={() =>
                navigation.navigate('BusinessLocationForm', { locationId: item.id })
              }
              onEditHours={() =>
                navigation.navigate('BusinessLocationHours', { locationId: item.id })
              }
              onToggleStatus={() => setToggleTarget(item)}
              onTransfer={() => setTransferTarget(item)}
              onDelete={
                item.is_primary ? undefined : () => setDeleteTarget(item)
              }
              onViewItems={() =>
                navigateBusinessCatalogTab(navigation, { locationId: item.id })
              }
              onChoosePhone={(loc) => openChooser(loc)}
              onVerifyPhone={(loc) => openPhoneModal(loc, 'verify')}
              onUnlinkPhone={(loc) => void handleUnlinkLocationPhone(loc)}
            />
          )}
        />
      )}
      {contentReady ? (
        <SubtleExtendedFab
          icon="plus"
          style={styles.fab}
          onPress={() => navigation.navigate('BusinessLocationForm', {})}
          label={t('business.locations.add', 'Add')}
        />
      ) : null}
      <ConfirmActionDialog
        visible={!!toggleTarget}
        title={
          toggleTarget?.is_active
            ? t('business.locations.deactivate', 'Deactivate')
            : t('business.locations.activate', 'Activate')
        }
        message={
          toggleTarget?.is_active
            ? t(
                'business.locations.deactivateConfirm',
                'Customers will no longer see inventory from this location until you activate it again.'
              )
            : t(
                'business.locations.activateConfirm',
                'Activate this location so it can receive orders again.'
              )
        }
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={
          toggleTarget?.is_active
            ? t('business.locations.deactivate', 'Deactivate')
            : t('business.locations.activate', 'Activate')
        }
        loading={toggling}
        onDismiss={() => setToggleTarget(null)}
        onConfirm={() => void confirmToggle()}
      />
      <ConfirmActionDialog
        visible={!!deleteTarget}
        title={t('business.locations.deleteLocation', 'Delete location')}
        message={t(
          'business.locations.deleteConfirm',
          'Are you sure you want to delete this location? It can only be deleted if it has no items assigned.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('common.delete', 'Delete')}
        destructive
        loading={deleting}
        onDismiss={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
      <TransferRequestDetailSheet
        visible={!!detailRequestId}
        requestId={detailRequestId}
        businessId={businessId}
        viewerBusinessId={businessId}
        onDismiss={() => setDetailRequestId(null)}
        onChanged={onTransferChanged}
      />
      <TransferLocationModal
        visible={!!transferTarget}
        location={transferTarget}
        businessId={businessId}
        onDismiss={() => setTransferTarget(null)}
        onSuccess={() => {
          setSnack(
            t(
              'business.locations.transfer.requestSent',
              'Transfer request sent. Waiting for the other business to accept.'
            )
          );
          onTransferChanged();
        }}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
      <MobilePaymentPhoneChooserSheet
        visible={chooserOpen}
        phones={phones}
        verificationMethod={verificationMethod}
        selectedPhoneId={chooserTarget?.mobile_payment_phone_id}
        onDismiss={() => {
          setChooserOpen(false);
          setChooserTarget(null);
        }}
        onSelect={(phone) => {
          if (!chooserTarget) return;
          void attachPhoneToLocation(chooserTarget, phone.id);
        }}
        onAddNew={() => {
          if (!chooserTarget) return;
          openPhoneModal(chooserTarget, 'add', null);
        }}
        onVerify={(phone) => {
          if (!chooserTarget) return;
          openPhoneModal(chooserTarget, 'verify', phone);
        }}
      />
      <MobilePaymentPhoneVerifyModal
        visible={phoneModalOpen}
        mode={phoneModalMode}
        initialPhone={phoneModalInitial}
        onDismiss={() => {
          setPhoneModalOpen(false);
          setPhoneModalTarget(null);
          setPhoneModalInitial(null);
        }}
        onCompleted={(phone) => void handlePhoneCompleted(phone)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.sm, paddingBottom: 88 },
  empty: { textAlign: 'center', marginTop: 24 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
