import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { CoveredDeliverySlotPicker } from '../common/CoveredDeliverySlotPicker';
import { DeliveryWindowPicker } from '../common/DeliveryWindowPicker';
import { useTheme } from '../../contexts/ThemeContext';
import type { DedicatedCoveredSlot } from '../../types/checkout';
import type { ClientDeliveryWindowPayload } from '../../types/deliveryWindow';

export interface PlaceOrderDeliveryWindowBlockProps {
  countryCode: string;
  stateCode: string;
  enabled: boolean;
  fulfillment?: 'delivery' | 'pickup';
  businessLocationId?: string;
  scheduleRequired?: boolean;
  /** When false, hide schedule link (cooked food is ASAP-only). */
  allowSchedule?: boolean;
  /**
   * MoMo cooked-food pickup: payment is requested after the kitchen confirms.
   * Changes the ASAP helper copy.
   */
  payAfterConfirm?: boolean;
  /** 'store' → generic store wording (flagged-location goods); default kitchen wording. */
  payAfterCopyVariant?: 'cooked' | 'store';
  estimatedReadyAt?: string | null;
  estimatedFulfillBy?: string | null;
  opensAt?: string | null;
  /**
   * #594 (dedicated_agents_enabled only): ASAP delivery is out but a dedicated
   * agent covers these slots. Non-empty → scheduled-only, these slots only.
   */
  coveredSlots?: DedicatedCoveredSlot[];
  /**
   * The window the screen will submit. Passed so the covered-slot picker stays
   * in sync with it: a screen that resets its window (e.g. on a fulfillment
   * change, whose effect runs after this child's mount effect) gets the
   * default covered slot committed again instead of submitting no window.
   */
  value?: ClientDeliveryWindowPayload | null;
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
  allowSchedule = true,
  payAfterConfirm = false,
  payAfterCopyVariant = 'cooked',
  estimatedReadyAt,
  estimatedFulfillBy,
  opensAt,
  coveredSlots,
  value,
  onReadyChange,
  onCommit,
}: PlaceOrderDeliveryWindowBlockProps) {
  if (fulfillment !== 'pickup' && coveredSlots && coveredSlots.length > 0) {
    return (
      <CoveredOnlyBlock
        enabled={enabled}
        slots={coveredSlots}
        value={value}
        onReadyChange={onReadyChange}
        onCommit={onCommit}
      />
    );
  }
  return (
    <StandardDeliveryWindowBlock
      countryCode={countryCode}
      stateCode={stateCode}
      enabled={enabled}
      fulfillment={fulfillment}
      businessLocationId={businessLocationId}
      scheduleRequired={scheduleRequired}
      allowSchedule={allowSchedule}
      payAfterConfirm={payAfterConfirm}
      payAfterCopyVariant={payAfterCopyVariant}
      estimatedReadyAt={estimatedReadyAt}
      estimatedFulfillBy={estimatedFulfillBy}
      opensAt={opensAt}
      onReadyChange={onReadyChange}
      onCommit={onCommit}
    />
  );
}

/** #594: scheduled-only delivery for the dedicated-covered slots (no ASAP). */
function CoveredOnlyBlock({
  enabled,
  slots,
  value,
  onReadyChange,
  onCommit,
}: {
  enabled: boolean;
  slots: DedicatedCoveredSlot[];
  value?: ClientDeliveryWindowPayload | null;
  onReadyChange: (ok: boolean) => void;
  onCommit: (window: ClientDeliveryWindowPayload | null) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [selected, setSelected] = useState<ClientDeliveryWindowPayload | null>(null);

  const handleChange = useCallback(
    (window: ClientDeliveryWindowPayload | null) => {
      setSelected(window);
      onCommit(window);
      onReadyChange(window != null);
    },
    [onCommit, onReadyChange]
  );

  if (!enabled) return null;

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
      <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {t(
          'client.placeOrder.deliveryWindow.dedicatedScheduledOnly',
          'Scheduled delivery only for this store right now'
        )}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs, lineHeight: 20 }}>
        {t(
          'client.placeOrder.deliveryWindow.dedicatedScheduledOnlyHint',
          'Choose one of the times below.'
        )}
      </Text>
      <CoveredDeliverySlotPicker
        slots={slots}
        value={value !== undefined ? value : selected}
        onChange={handleChange}
      />
    </View>
  );
}

function StandardDeliveryWindowBlock({
  countryCode,
  stateCode,
  enabled,
  fulfillment = 'delivery',
  businessLocationId,
  scheduleRequired = false,
  allowSchedule = true,
  payAfterConfirm = false,
  payAfterCopyVariant = 'cooked',
  estimatedReadyAt,
  estimatedFulfillBy,
  opensAt,
  onReadyChange,
  onCommit,
}: Omit<PlaceOrderDeliveryWindowBlockProps, 'coveredSlots'>) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const isPickup = fulfillment === 'pickup';
  const effectiveScheduleRequired = allowSchedule && scheduleRequired;
  const [scheduling, setScheduling] = useState(effectiveScheduleRequired);
  const prevScheduleRequired = useRef(effectiveScheduleRequired);
  const showPicker = effectiveScheduleRequired || (allowSchedule && scheduling);

  useEffect(() => {
    if (!allowSchedule) {
      setScheduling(false);
      onCommit(null);
      onReadyChange(true);
    }
  }, [allowSchedule]);

  useEffect(() => {
    if (effectiveScheduleRequired) {
      setScheduling(true);
    } else if (prevScheduleRequired.current) {
      setScheduling(false);
      onCommit(null);
      onReadyChange(true);
    }
    prevScheduleRequired.current = effectiveScheduleRequired;
  }, [effectiveScheduleRequired]);

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
  const cookedFoodAsapCopy = payAfterConfirm && payAfterCopyVariant === 'store'
    ? t(
        'client.placeOrder.deliveryWindow.storeAsapPayAfterConfirm',
        'The store will confirm your order first. We’ll then ask you to pay.'
      )
    : payAfterConfirm
    ? t(
        'client.placeOrder.deliveryWindow.cookedFoodAsapPayAfterConfirm',
        'We’ll start preparing once the kitchen confirms and receives your payment.'
      )
    : isPickup
      ? t(
          'client.placeOrder.deliveryWindow.cookedFoodAsapPickup',
          'We’ll start preparing when the kitchen confirms.'
        )
      : t(
          'client.placeOrder.deliveryWindow.cookedFoodAsapDelivery',
          'We’ll start preparing when the kitchen confirms.'
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
      {effectiveScheduleRequired ? (
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
            {!allowSchedule
              ? cookedFoodAsapCopy
              : etaLabel
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

      {allowSchedule && !effectiveScheduleRequired ? (
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
      ) : null}
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
