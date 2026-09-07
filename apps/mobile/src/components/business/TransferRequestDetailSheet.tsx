import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Text } from 'react-native-paper';
import { AppModal } from '../common/AppModal';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocationTransfers } from '../../hooks/business/useLocationTransfers';
import type { TransferRequest } from '../../types/business/locationTransfer';
import { spacing } from '../../theme/spacing';

type Props = {
  visible: boolean;
  requestId: string | null;
  businessId?: string;
  viewerBusinessId?: string;
  onDismiss: () => void;
  onChanged?: () => void;
};

function requestLocationName(req: TransferRequest): string {
  return (
    req.business_location?.name ||
    String(req.metadata?.locationName || '') ||
    '—'
  );
}

function formatExpiresAt(
  iso: string,
  t: (key: string, fallback: string, opts?: Record<string, unknown>) => string
): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) {
    return t('business.locations.transfer.expiredLabel', 'Expired');
  }
  const days = Math.ceil(ms / 86400000);
  if (days <= 1) {
    return t('business.locations.transfer.expiresToday', 'Expires today');
  }
  return t(
    'business.locations.transfer.expiresInDays',
    'Expires in {{days}} days',
    { days }
  );
}

function statusLabel(
  status: string,
  t: (key: string, fallback: string) => string
): string {
  switch (status) {
    case 'accepted':
      return t('business.locations.transfer.statusAccepted', 'Accepted');
    case 'rejected':
      return t('business.locations.transfer.statusRejected', 'Rejected');
    case 'cancelled':
      return t('business.locations.transfer.statusCancelled', 'Cancelled');
    case 'expired':
      return t('business.locations.transfer.statusExpired', 'Expired');
    case 'pending':
      return t('business.locations.transfer.pendingBadge', 'Transfer pending');
    default:
      return status;
  }
}

export function TransferRequestDetailSheet({
  visible,
  requestId,
  businessId,
  viewerBusinessId,
  onDismiss,
  onChanged,
}: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { getRequest, acceptRequest, rejectRequest, cancelRequest } =
    useLocationTransfers(businessId);
  const [request, setRequest] = useState<TransferRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState(false);

  useEffect(() => {
    if (!visible || !requestId) {
      setRequest(null);
      setError(null);
      setLoadFailed(false);
      setConfirmAccept(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    void getRequest(requestId)
      .then((row) => {
        if (!cancelled) setRequest(row);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadFailed(true);
          setError(
            (err as Error)?.message ??
              t(
                'business.locations.transfer.loadFailed',
                'Could not load this transfer request'
              )
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, requestId, getRequest, t]);

  const isIncoming =
    !!request &&
    !!viewerBusinessId &&
    request.to_business_id === viewerBusinessId;
  const isOutgoing =
    !!request &&
    !!viewerBusinessId &&
    request.from_business_id === viewerBusinessId;
  const isPending = request?.status === 'pending';

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged?.();
      onDismiss();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? t('common.error', 'Something went wrong'));
    } finally {
      setBusy(false);
      setConfirmAccept(false);
    }
  };

  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={onDismiss}>
        <View
          style={[
            styles.sheet,
            {
              width,
              height,
              paddingTop: insets.top,
              paddingBottom: Math.max(insets.bottom, spacing.sm),
              backgroundColor: colors.pageBackground,
            },
          ]}
        >
          <View style={styles.header}>
            <IconButton icon="close" onPress={onDismiss} disabled={busy} />
            <Text
              variant="titleMedium"
              style={[styles.headerTitle, { color: colors.text.primary }]}
            >
              {t('business.locations.transfer.detailTitle', 'Transfer request')}
            </Text>
            <View style={{ width: 48 }} />
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} />
          ) : (
            <ScrollView contentContainerStyle={styles.body}>
              {error ? (
                <Text style={{ color: colors.error.main, marginBottom: spacing.sm }}>
                  {error}
                </Text>
              ) : null}

              {loadFailed || !request ? (
                <Text style={{ color: colors.text.secondary }}>
                  {t(
                    'business.locations.transfer.loadFailed',
                    'Could not load this transfer request'
                  )}
                </Text>
              ) : (
                <View
                  style={[
                    styles.card,
                    {
                      borderColor: colors.divider,
                      borderRadius: borderRadius.card,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Text
                    variant="titleMedium"
                    style={{ color: colors.text.primary, fontWeight: '700' }}
                  >
                    {requestLocationName(request)}
                  </Text>
                  <StatusPill
                    compact
                    label={statusLabel(request.status, t)}
                    backgroundColor={
                      isPending
                        ? `${colors.warning.main}24`
                        : `${colors.primary.main}18`
                    }
                    textColor={
                      isPending ? colors.warning.dark : colors.primary.main
                    }
                  />
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {request.transfer_mode === 'inventory_merge'
                      ? t(
                          'business.locations.transfer.modeMergeBadge',
                          'Inventory merge'
                        )
                      : t(
                          'business.locations.transfer.modeOwnershipBadge',
                          'Location ownership'
                        )}
                  </Text>
                  {isPending ? (
                    <Text variant="bodySmall" style={{ color: colors.warning.main }}>
                      {formatExpiresAt(request.expires_at, t)}
                    </Text>
                  ) : null}
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {isIncoming
                      ? t(
                          'business.locations.transfer.fromBusiness',
                          'From: {{name}}',
                          { name: request.from_business?.name || '' }
                        )
                      : t(
                          'business.locations.transfer.toBusinessShort',
                          'To: {{name}}',
                          { name: request.to_business?.name || '' }
                        )}
                  </Text>
                  {request.transfer_mode === 'inventory_merge' ? (
                    <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                      {t(
                        'business.locations.transfer.toLocationLine',
                        'Destination location: {{name}}',
                        {
                          name:
                            request.to_business_location?.name ||
                            String(request.metadata?.toLocationName || ''),
                        }
                      )}
                    </Text>
                  ) : null}
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {t(
                      'business.locations.transfer.summaryLine',
                      '1 location · {{items}} items · {{rentals}} rentals · {{orders}} completed orders',
                      {
                        items: request.item_count,
                        rentals: request.rental_item_count,
                        orders: request.order_count,
                      }
                    )}
                  </Text>
                  {!isPending ? (
                    <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                      {t(
                        'business.locations.transfer.resolvedHint',
                        'This request is no longer pending.'
                      )}
                    </Text>
                  ) : null}
                </View>
              )}
            </ScrollView>
          )}

          <View style={styles.footer}>
            {!isPending || loadFailed || !request ? (
              <Button mode="contained" onPress={onDismiss}>
                {t('common.done', 'Done')}
              </Button>
            ) : confirmAccept && isIncoming ? (
              <View
                style={[
                  styles.confirmPanel,
                  {
                    borderColor: colors.primary.main,
                    borderRadius: borderRadius.card,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text
                  variant="titleSmall"
                  style={{ color: colors.text.primary, fontWeight: '700' }}
                >
                  {t(
                    'business.locations.transfer.acceptTitle',
                    'Accept location transfer?'
                  )}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {request.transfer_mode === 'inventory_merge'
                    ? t(
                        'business.locations.transfer.acceptMergeMessage',
                        'This will move eligible items and inventory into the selected location. Duplicates stay on the source.'
                      )
                    : t(
                        'business.locations.transfer.acceptMessage',
                        'This will move the location, its items, addresses, and account to your business.'
                      )}
                </Text>
                <View style={styles.actions}>
                  <Button
                    mode="text"
                    disabled={busy}
                    onPress={() => setConfirmAccept(false)}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    mode="contained"
                    loading={busy}
                    disabled={busy}
                    onPress={() => void run(() => acceptRequest(request.id))}
                  >
                    {t('common.accept', 'Accept')}
                  </Button>
                </View>
              </View>
            ) : (
              <View style={styles.actions}>
                {isOutgoing ? (
                  <Button
                    mode="outlined"
                    disabled={busy}
                    onPress={() => void run(() => cancelRequest(request.id))}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                ) : null}
                {isIncoming ? (
                  <>
                    <Button
                      mode="text"
                      disabled={busy}
                      onPress={() => void run(() => rejectRequest(request.id))}
                    >
                      {t('common.reject', 'Reject')}
                    </Button>
                    <Button
                      mode="contained"
                      disabled={busy}
                      onPress={() => setConfirmAccept(true)}
                    >
                      {t('common.accept', 'Accept')}
                    </Button>
                  </>
                ) : null}
              </View>
            )}
          </View>
        </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700' },
  body: { padding: spacing.md, gap: spacing.md },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
  footer: { padding: spacing.md },
  confirmPanel: {
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
