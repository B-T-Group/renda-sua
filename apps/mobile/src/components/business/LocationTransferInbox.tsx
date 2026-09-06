import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocationTransfers } from '../../hooks/business/useLocationTransfers';
import type { TransferRequest } from '../../types/business/locationTransfer';
import { shadows } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';

type Props = {
  businessId?: string;
  refreshToken?: number;
  onViewRequest: (requestId: string) => void;
  highlightRequestId?: string | null;
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

function TransferRequestCard({
  req,
  tone,
  highlighted,
  onPress,
}: {
  req: TransferRequest;
  tone: 'incoming' | 'outgoing';
  highlighted: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const counterpart =
    tone === 'incoming'
      ? t('business.locations.transfer.fromBusiness', 'From: {{name}}', {
          name: req.from_business?.name || '',
        })
      : t('business.locations.transfer.toBusinessShort', 'To: {{name}}', {
          name: req.to_business?.name || '',
        });
  const modeLabel =
    req.transfer_mode === 'inventory_merge'
      ? t('business.locations.transfer.modeMergeBadge', 'Inventory merge')
      : t('business.locations.transfer.modeOwnershipBadge', 'Location ownership');
  const destLocationName =
    req.to_business_location?.name ||
    String(req.metadata?.toLocationName || '');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: highlighted ? colors.primary.main : colors.divider,
          borderWidth: highlighted ? 2 : StyleSheet.hairlineWidth,
          borderRadius: borderRadius.card,
          backgroundColor: highlighted
            ? `${colors.primary.main}12`
            : colors.surface,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text
          variant="titleSmall"
          style={{ color: colors.text.primary, flex: 1, minWidth: 0, fontWeight: '700' }}
          numberOfLines={2}
        >
          {requestLocationName(req)}
        </Text>
        <StatusPill
          compact
          label={t('business.locations.transfer.pendingBadge', 'Transfer pending')}
          backgroundColor={`${colors.warning.main}24`}
          textColor={colors.warning.dark}
        />
      </View>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {modeLabel}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {counterpart}
      </Text>
      {req.transfer_mode === 'inventory_merge' && destLocationName ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t(
            'business.locations.transfer.toLocationLine',
            'Destination location: {{name}}',
            { name: destLocationName }
          )}
        </Text>
      ) : null}
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'business.locations.transfer.summaryLine',
          '1 location · {{items}} items · {{rentals}} rentals · {{orders}} completed orders',
          {
            items: req.item_count,
            rentals: req.rental_item_count,
            orders: req.order_count,
          }
        )}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.warning.main }}>
        {formatExpiresAt(req.expires_at, t)}
      </Text>
      <View style={styles.actions}>
        <Button mode="text" compact onPress={onPress}>
          {t('business.locations.transfer.viewRequest', 'View')}
        </Button>
      </View>
    </Pressable>
  );
}

export function LocationTransferInbox({
  businessId,
  refreshToken = 0,
  onViewRequest,
  highlightRequestId = null,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { incoming, outgoing, loading, fetchPending } =
    useLocationTransfers(businessId);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    void fetchPending();
  }, [fetchPending, refreshToken]);

  useEffect(() => {
    if (!highlightRequestId) return;
    setHighlightId(highlightRequestId);
    const timer = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightRequestId]);

  if (loading && !incoming.length && !outgoing.length) {
    return <ActivityIndicator style={{ marginVertical: spacing.md }} />;
  }

  if (!incoming.length && !outgoing.length) return null;

  return (
    <View style={styles.wrap}>
      {incoming.length > 0 ? (
        <View style={styles.section}>
          <Text
            variant="titleMedium"
            style={{ color: colors.text.primary, fontWeight: '700' }}
          >
            {t(
              'business.locations.transfer.incomingTitle',
              'Incoming location transfers'
            )}
          </Text>
          {incoming.map((req) => (
            <TransferRequestCard
              key={req.id}
              req={req}
              tone="incoming"
              highlighted={highlightId === req.id}
              onPress={() => onViewRequest(req.id)}
            />
          ))}
        </View>
      ) : null}

      {outgoing.length > 0 ? (
        <View style={styles.section}>
          <Text
            variant="titleMedium"
            style={{ color: colors.text.primary, fontWeight: '700' }}
          >
            {t(
              'business.locations.transfer.outgoingTitle',
              'Outgoing location transfers'
            )}
          </Text>
          {outgoing.map((req) => (
            <TransferRequestCard
              key={req.id}
              req={req}
              tone="outgoing"
              highlighted={highlightId === req.id}
              onPress={() => onViewRequest(req.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, gap: spacing.md },
  section: { gap: spacing.sm },
  card: {
    padding: spacing.sm,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
});
