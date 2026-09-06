import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { DeliveryWindowPicker } from '../common/DeliveryWindowPicker';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClientDeliveryWindowPayload } from '../../types/deliveryWindow';

export interface PlaceOrderDeliveryWindowBlockProps {
  countryCode: string;
  stateCode: string;
  enabled: boolean;
  fulfillment?: 'delivery' | 'pickup';
  businessLocationId?: string;
  scheduleRequired?: boolean;
  estimatedReadyAt?: string | null;
  estimatedFulfillBy?: string | null;
  opensAt?: string | null;
  onReadyChange: (ok: boolean) => void;
  onCommit: (window: ClientDeliveryWindowPayload | null) => void;
}

export function PlaceOrderDeliveryWindowBlock({
  countryCode,
  stateCode,
  enabled,
  fulfillment = 'delivery',
  businessLocationId,
  scheduleRequired = false,
  estimatedReadyAt,
  estimatedFulfillBy,
  opensAt,
  onReadyChange,
  onCommit,
}: PlaceOrderDeliveryWindowBlockProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const isPickup = fulfillment === 'pickup';
  const [scheduling, setScheduling] = useState(scheduleRequired);
  const prevScheduleRequired = useRef(scheduleRequired);
  const showPicker = scheduleRequired || scheduling;

  useEffect(() => {
    if (scheduleRequired) {
      setScheduling(true);
    } else if (prevScheduleRequired.current) {
      setScheduling(false);
      onCommit(null);
      onReadyChange(true);
    }
    prevScheduleRequired.current = scheduleRequired;
  }, [scheduleRequired]);

  useEffect(() => {
    if (!enabled || showPicker) return;
    onReadyChange(true);
    onCommit(null);
  }, [enabled, showPicker]);

  if (!enabled) return null;

  const etaLabel = formatEtaRange(estimatedReadyAt, estimatedFulfillBy);
  const closedCopy = isPickup
    ? t(
        'client.placeOrder.deliveryWindow.storeClosedPickup',
        'This store is closed. Select a future pickup date below.'
      )
    : t(
        'client.placeOrder.deliveryWindow.storeClosedDelivery',
        'This store is closed. Select a future delivery date below.'
      );

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: borderRadius.lg,
          borderColor: colors.border,
          backgroundColor: colors.pageBackground,
          padding: spacing.md,
        },
      ]}
    >
      {scheduleRequired ? (
        <View style={{ marginBottom: spacing.sm }}>
          <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '600' }}>
            {closedCopy}
          </Text>
          {opensAt ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs }}>
              {t('client.placeOrder.deliveryWindow.opensAt', 'Opens {{time}}', {
                time: formatClock(opensAt),
              })}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={{ marginBottom: spacing.sm }}>
          <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '600' }}>
            {isPickup
              ? t('client.placeOrder.deliveryWindow.asapPickupTitle', 'Pick up as soon as possible')
              : t('client.placeOrder.deliveryWindow.asapTitle', 'Deliver as soon as possible')}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs, lineHeight: 20 }}>
            {etaLabel
              ? t('client.placeOrder.deliveryWindow.asapEta', 'Usually ready {{eta}}', {
                  eta: etaLabel,
                })
              : t(
                  'client.placeOrder.deliveryWindow.asapSubtitle',
                  'We’ll start preparing as soon as the store confirms.'
                )}
          </Text>
        </View>
      )}

      {showPicker ? (
        <DeliveryWindowPicker
          countryCode={countryCode}
          stateCode={stateCode}
          enabled={enabled}
          fulfillment={fulfillment}
          businessLocationId={businessLocationId}
          onReadyChange={onReadyChange}
          onSelectionChange={onCommit}
        />
      ) : null}

      {scheduleRequired ? null : (
        <Button
          mode="text"
          compact
          onPress={() => {
            if (scheduling) {
              setScheduling(false);
              onCommit(null);
              onReadyChange(true);
              return;
            }
            setScheduling(true);
            onReadyChange(false);
          }}
        >
          {scheduling
            ? isPickup
              ? t('client.placeOrder.deliveryWindow.backToAsapPickup', 'Pick up as soon as possible')
              : t('client.placeOrder.deliveryWindow.backToAsap', 'Deliver as soon as possible')
            : isPickup
              ? t(
                  'client.placeOrder.deliveryWindow.schedulePickupLink',
                  'Schedule pickup for a future date'
                )
              : t(
                  'client.placeOrder.deliveryWindow.scheduleDeliveryLink',
                  'Schedule delivery for a future date'
                )}
        </Button>
      )}
    </View>
  );
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatEtaRange(readyAt?: string | null, fulfillBy?: string | null): string | null {
  if (!readyAt && !fulfillBy) return null;
  const a = readyAt ? formatClock(readyAt) : '';
  const b = fulfillBy ? formatClock(fulfillBy) : '';
  if (a && b && a !== b) return `${a}–${b}`;
  return a || b || null;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
});
