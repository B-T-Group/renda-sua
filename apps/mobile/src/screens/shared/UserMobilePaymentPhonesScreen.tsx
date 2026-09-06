import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Snackbar, Text } from 'react-native-paper';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { StatusPill } from '../../components/common/StatusPill';
import { SubtleExtendedFab } from '../../components/common/SubtleExtendedFab';
import { ConfirmActionDialog } from '../../components/dialogs/ConfirmActionDialog';
import { MobilePaymentPhoneVerifyModal } from '../../components/dialogs/MobilePaymentPhoneVerifyModal';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import { useStore } from '../../stores/RootStore';
import type {
  MobilePaymentPhone,
  MobilePaymentPhoneModalMode,
} from '../../types/mobilePaymentPhone';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

type Props = {
  /** When true, successful add/verify can attach to agent profile. */
  attachAgentOnSuccess?: boolean;
};

export default function UserMobilePaymentPhonesScreen({
  attachAgentOnSuccess = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const { persona } = useStore();
  const { isStripeRail } = useIsStripeRail();
  const { phones, loading, error, fetchPhones, deletePhone } =
    useMobilePaymentPhones(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MobilePaymentPhone | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<MobilePaymentPhoneModalMode>('add');
  const [modalPhone, setModalPhone] = useState<MobilePaymentPhone | null>(null);

  const isAgent = persona.activePersona === 'agent';

  useFocusEffect(
    useCallback(() => {
      if (!isStripeRail) void fetchPhones();
    }, [isStripeRail, fetchPhones])
  );

  const openAdd = () => {
    setModalMode('add');
    setModalPhone(null);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePhone(deleteTarget.id);
      setDeleteTarget(null);
      setSnack(t('mobilePaymentPhone.removed', 'Mobile payment number removed'));
      await fetchPhones();
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('mobilePaymentPhone.removeFailed', 'Could not remove number')
      );
    } finally {
      setDeleting(false);
    }
  };

  if (isStripeRail) {
    return (
      <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
        <Text style={[styles.empty, { color: colors.text.secondary }]}>
          {t(
            'mobilePaymentPhone.stripeRailHint',
            'Mobile money numbers are not used in your payment region.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      {loading && phones.length === 0 ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <FlatList
          data={phones}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => void fetchPhones()} />
          }
          ListHeaderComponent={
            <NoticeBanner
              tone="info"
              message={
                isAgent
                  ? t(
                      'mobilePaymentPhone.manageAgentHint',
                      'Verified numbers are used for commission payouts. Delete only from this screen.'
                    )
                  : t(
                      'mobilePaymentPhone.manageBusinessHint',
                      'Link numbers to locations for purchases and payouts. Delete only from this screen — unlinking a location keeps the number here.'
                    )
              }
              style={{ marginBottom: spacing.sm }}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.text.secondary }]}>
              {error ??
                t(
                  'mobilePaymentPhone.manageEmpty',
                  'No mobile money numbers yet. Add one to get started.'
                )}
            </Text>
          }
          renderItem={({ item }) => {
            const usageParts: string[] = [];
            if ((item.locationCount ?? 0) > 0) {
              usageParts.push(
                t('mobilePaymentPhone.usedByLocations', {
                  defaultValue: 'Used by {{count}} location(s)',
                  count: item.locationCount,
                })
              );
            }
            if (item.linkedToAgent) {
              usageParts.push(t('mobilePaymentPhone.usedByAgent', 'Linked to agent profile'));
            }
            return (
              <View
                style={[
                  styles.card,
                  shadows.sm,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.divider,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <Text
                    variant="titleMedium"
                    style={{ color: colors.text.primary, flex: 1, minWidth: 0 }}
                    numberOfLines={1}
                  >
                    {item.phone_e164}
                  </Text>
                  <StatusPill
                    compact
                    label={
                      item.is_verified
                        ? t('mobilePaymentPhone.verified', 'Verified')
                        : t('mobilePaymentPhone.unverified', 'Unverified')
                    }
                    backgroundColor={
                      item.is_verified
                        ? `${colors.success.main}24`
                        : `${colors.warning.main}24`
                    }
                    textColor={
                      item.is_verified ? colors.success.dark : colors.warning.dark
                    }
                  />
                </View>
                {usageParts.length > 0 ? (
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {usageParts.join(' · ')}
                  </Text>
                ) : (
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {t('mobilePaymentPhone.notLinked', 'Not linked anywhere')}
                  </Text>
                )}
                <View style={styles.actions}>
                  {!item.is_verified ? (
                    <Button
                      mode="text"
                      compact
                      onPress={() => {
                        setModalMode('verify');
                        setModalPhone(item);
                        setModalOpen(true);
                      }}
                    >
                      {t('mobilePaymentPhone.verifyShort', 'Verify')}
                    </Button>
                  ) : null}
                  <Button
                    mode="text"
                    compact
                    onPress={() => {
                      setModalMode('edit');
                      setModalPhone(item);
                      setModalOpen(true);
                    }}
                  >
                    {t('common.edit', 'Edit')}
                  </Button>
                  <Button
                    mode="text"
                    compact
                    textColor={colors.error.main}
                    onPress={() => setDeleteTarget(item)}
                  >
                    {t('common.delete', 'Delete')}
                  </Button>
                </View>
              </View>
            );
          }}
        />
      )}

      <SubtleExtendedFab
        icon="plus"
        style={styles.fab}
        onPress={openAdd}
        label={t('mobilePaymentPhone.addNewCta', 'Add a new number')}
      />

      <ConfirmActionDialog
        visible={!!deleteTarget}
        title={t('mobilePaymentPhone.deleteTitle', 'Delete mobile money number')}
        message={t(
          'mobilePaymentPhone.deleteConfirm',
          'This will unlink the number from all locations and your agent profile, then remove it permanently.'
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

      <MobilePaymentPhoneVerifyModal
        visible={modalOpen}
        mode={modalMode}
        initialPhone={modalPhone}
        attachAgentOnSuccess={attachAgentOnSuccess || isAgent}
        onDismiss={() => {
          setModalOpen(false);
          setModalPhone(null);
        }}
        onCompleted={() => {
          setModalOpen(false);
          setModalPhone(null);
          void fetchPhones();
          setSnack(t('mobilePaymentPhone.saved', 'Mobile money number updated'));
        }}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 32 },
  list: { padding: spacing.sm, paddingBottom: 88 },
  empty: { textAlign: 'center', marginTop: 24, paddingHorizontal: spacing.md },
  card: {
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
