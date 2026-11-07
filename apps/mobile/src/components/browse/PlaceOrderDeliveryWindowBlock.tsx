import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { CoveredDeliverySlotPicker } from '../common/CoveredDeliverySlotPicker';
import { DeliveryWindowPicker } from '../common/DeliveryWindowPicker';
import { useTheme } from '../../contexts/ThemeContext';
import type { DedicatedCoveredSlot } from '../../types/checkout';
import type { ClientDeliveryWindowPayload } from '../../types/deliveryWindow';
import { formatCheckoutClock, formatCheckoutEtaRange, formatWindowChoiceLabel } from '../../utils/deliveryWindowUtils';

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
  /** Display label for a chosen slot. Null means as soon as possible. */
  onLabelChange?: (label: string | null) => void;
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
  onLabelChange,
}: PlaceOrderDeliveryWindowBlockProps) {
  if (fulfillment !== 'pickup' && coveredSlots && coveredSlots.length > 0) {
    return (
      <CoveredOnlyBlock
        enabled={enabled}
        slots={coveredSlots}
        value={value}
        onReadyChange={onReadyChange}
        onCommit={onCommit}
        onLabelChange={onLabelChange}
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
      onLabelChange={onLabelChange}
    />
  );
}

const SLOT_KEY_FALLBACK: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

function coveredWindowLabel(
  window: ClientDeliveryWindowPayload | null,
  slots: DedicatedCoveredSlot[],
  locale: string,
  translate: (key: string, fallback: string) => string
): string | null {
  if (!window) return null;
  const slot = slots.find(
    (item) => item.slot_id === window.slot_id && item.date === window.preferred_date
  );
  if (!slot) return null;
  const name = slot.slot_key
    ? translate(
        `client.placeOrder.deliveryWindow.slotKey.${slot.slot_key}`,
        SLOT_KEY_FALLBACK[slot.slot_key] ?? slot.slot_key
      )
    : '';
  const range = slot.start && slot.end ? `${slot.start}–${slot.end}` : '';
  return formatWindowChoiceLabel(slot.date, [name, range], locale);
}

/** #594: scheduled-only delivery for the dedicated-covered slots (no ASAP). */
function CoveredOnlyBlock({
  enabled,
  slots,
  value,
  onReadyChange,
  onCommit,
  onLabelChange,
}: {
  enabled: boolean;
  slots: DedicatedCoveredSlot[];
  value?: ClientDeliveryWindowPayload | null;
  onReadyChange: (ok: boolean) => void;
  onCommit: (window: ClientDeliveryWindowPayload | null) => void;
  onLabelChange?: (label: string | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const [selected, setSelected] = useState<ClientDeliveryWindowPayload | null>(null);

  const handleChange = useCallback(
    (window: ClientDeliveryWindowPayload | null) => {
      setSelected(window);
      onCommit(window);
      onReadyChange(window != null);
      onLabelChange?.(coveredWindowLabel(window, slots, i18n.language, t));
    },
    [i18n.language, onCommit, onLabelChange, onReadyChange, slots, t]
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

function TimingChoiceOption({
  selected,
  title,
  subtitle,
  icon,
  onPress,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
}) {
  const { colors, spacing, borderRadius, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${subtitle}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary.main : colors.borderStrong,
        backgroundColor: selected ? colors.primaryTint : colors.surface,
        borderRadius: borderRadius.md,
      }}
    >
      <MaterialCommunityIcons
        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
        size={22}
        color={selected ? colors.primary.main : colors.text.secondary}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <MaterialCommunityIcons
            name={icon}
            size={16}
            color={selected ? colors.primary.main : colors.text.secondary}
          />
          <Text
            style={[
              typography.subtitle2,
              { fontWeight: '700', color: selected ? colors.primary.dark : colors.text.primary },
            ]}
          >
            {title}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.text.secondary, lineHeight: 18 }]}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
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
  onLabelChange,
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
      onLabelChange?.(null);
    }
  }, [allowSchedule]);

  useEffect(() => {
    if (effectiveScheduleRequired) {
      setScheduling(true);
    } else if (prevScheduleRequired.current) {
      setScheduling(false);
      onCommit(null);
      onReadyChange(true);
      onLabelChange?.(null);
    }
    prevScheduleRequired.current = effectiveScheduleRequired;
  }, [effectiveScheduleRequired]);

  useEffect(() => {
    if (!enabled || showPicker) return;
    onReadyChange(true);
    onCommit(null);
    onLabelChange?.(null);
  }, [enabled, showPicker]);

  if (!enabled) return null;

  const etaLabel = formatCheckoutEtaRange(estimatedReadyAt, estimatedFulfillBy);
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

  const nowSubtitle = !allowSchedule
    ? cookedFoodAsapCopy
    : etaLabel
      ? t('client.placeOrder.deliveryWindow.asapEta', 'Usually ready {{eta}}', { eta: etaLabel })
      : isPickup
        ? t(
            'client.placeOrder.deliveryWindow.nowChoicePickupHint',
            'As soon as it’s ready'
          )
        : t(
            'client.placeOrder.deliveryWindow.nowChoiceDeliveryHint',
            'As soon as possible'
          );

  const laterSubtitle = isPickup
    ? t(
        'client.placeOrder.deliveryWindow.laterChoicePickupHint',
        'Choose a pickup date and time'
      )
    : t(
        'client.placeOrder.deliveryWindow.laterChoiceDeliveryHint',
        'Choose a delivery date and time'
      );

  const selectNow = () => {
    setScheduling(false);
    onCommit(null);
    onReadyChange(true);
    onLabelChange?.(null);
  };

  const selectLater = () => {
    setScheduling(true);
    onReadyChange(false);
  };

  let body: ReactNode;
  if (effectiveScheduleRequired) {
    body = (
      <>
        <View style={{ marginBottom: spacing.sm }}>
          <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '600' }}>
            {closedCopy}
          </Text>
          {opensAt ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs }}>
              {t('client.placeOrder.deliveryWindow.opensAt', 'Opens {{time}}', {
                time: formatCheckoutClock(opensAt),
              })}
            </Text>
          ) : null}
        </View>
        <DeliveryWindowPicker
          countryCode={countryCode}
          stateCode={stateCode}
          enabled={enabled}
          fulfillment={fulfillment}
          businessLocationId={businessLocationId}
          onReadyChange={onReadyChange}
          onSelectionChange={onCommit}
          onLabelChange={onLabelChange}
        />
      </>
    );
  } else if (!allowSchedule) {
    body = (
      <View>
        <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '600' }}>
          {isPickup
            ? t('client.placeOrder.deliveryWindow.asapPickupTitle', 'Pick up as soon as possible')
            : t('client.placeOrder.deliveryWindow.asapTitle', 'Deliver as soon as possible')}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xxs, lineHeight: 20 }}>
          {cookedFoodAsapCopy}
        </Text>
      </View>
    );
  } else {
    body = (
      <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
        <TimingChoiceOption
          selected={!scheduling}
          title={t('client.placeOrder.deliveryWindow.nowChoiceTitle', 'Now')}
          subtitle={nowSubtitle}
          icon={isPickup ? 'clock-fast' : 'truck-fast-outline'}
          onPress={selectNow}
        />
        <TimingChoiceOption
          selected={scheduling}
          title={t('client.placeOrder.deliveryWindow.laterChoiceTitle', 'Later')}
          subtitle={laterSubtitle}
          icon="calendar-clock"
          onPress={selectLater}
        />
        {showPicker ? (
          <DeliveryWindowPicker
            countryCode={countryCode}
            stateCode={stateCode}
            enabled={enabled}
            fulfillment={fulfillment}
            businessLocationId={businessLocationId}
            onReadyChange={onReadyChange}
            onSelectionChange={onCommit}
            onLabelChange={onLabelChange}
          />
        ) : null}
      </View>
    );
  }

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
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
});
