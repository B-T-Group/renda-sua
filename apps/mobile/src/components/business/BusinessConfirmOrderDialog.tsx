import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Divider, Icon, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeliveryWindowPicker } from '../common/DeliveryWindowPicker';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessOrder } from '../../types/business/orders';
import type { ConfirmOrderPayload } from '../../types/business/orders';
import type { ClientDeliveryWindowPayload } from '../../types/deliveryWindow';
import { formatPreferredDate, formatTimeSlotValue } from '../../utils/deliveryWindowUtils';
import { isStorePickupOrder } from '../../utils/businessOrderListDisplay';

interface Props {
  visible: boolean;
  order: BusinessOrder | null;
  onDismiss: () => void;
  onConfirm: (payload: ConfirmOrderPayload) => Promise<void>;
}

type DeliveryWindowOption = NonNullable<BusinessOrder['delivery_time_windows']>[number];

export function BusinessConfirmOrderDialog({ visible, order, onDismiss, onConfirm }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [selectedWindowId, setSelectedWindowId] = useState('');
  const [createNewWindow, setCreateNewWindow] = useState(false);
  const [newWindowData, setNewWindowData] = useState<ClientDeliveryWindowPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingWindows: DeliveryWindowOption[] = order?.delivery_time_windows ?? [];
  const hasExisting = existingWindows.length > 0;
  const isPickup = order ? isStorePickupOrder(order) : false;
  const isShipping = order?.fulfillment_method === 'shipping';
  const isAsap =
    order?.fulfillment_timing === 'asap' ||
    (!isShipping && (order?.delivery_time_windows?.length ?? 0) === 0);

  /** Pickup slots use store address; delivery uses client address then store fallback. */
  const windowAddress = isPickup
    ? order?.business_location?.address ?? null
    : order?.delivery_address ?? order?.business_location?.address ?? null;
  const countryCode = windowAddress?.country?.trim() || 'GA';
  const stateCode = windowAddress?.state?.trim() || '';

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setCreateNewWindow(false);
    setNewWindowData(null);
    if (existingWindows.length > 0) {
      setSelectedWindowId(existingWindows[0].id);
    } else {
      setSelectedWindowId('');
    }
  }, [visible, order?.id]);

  const showPicker = isAsap ? createNewWindow : !hasExisting || createNewWindow;
  const pickerEnabled = showPicker && Boolean(countryCode && stateCode);

  const canSubmit = useMemo(() => {
    if (isAsap && !showPicker && !hasExisting) return true;
    if (isAsap && !createNewWindow && !hasExisting) return true;
    if (showPicker) {
      return Boolean(newWindowData?.slot_id && newWindowData.preferred_date);
    }
    return Boolean(selectedWindowId);
  }, [isAsap, showPicker, hasExisting, createNewWindow, newWindowData, selectedWindowId]);

  const handleSelectExisting = useCallback((windowId: string) => {
    setSelectedWindowId(windowId);
    setCreateNewWindow(false);
    setNewWindowData(null);
  }, []);

  const handleCreateNewWindow = useCallback(() => {
    setCreateNewWindow(true);
    setSelectedWindowId('');
    setNewWindowData(null);
  }, []);

  const handleSubmit = async () => {
    if (!order || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: ConfirmOrderPayload = { orderId: order.id };
      if (!showPicker && selectedWindowId) {
        payload.delivery_time_window_id = selectedWindowId;
      } else if (newWindowData) {
        payload.delivery_window_details = newWindowData;
      } else if (!isAsap) {
        setError(
          isShipping
            ? t('business.orders.confirmNoShipWindow', 'Please select when you will ship')
            : isPickup
            ? t('business.orders.confirmNoPickupSlot', 'Please select a pickup time slot')
            : t('business.orders.confirmNoWindowSelected', 'Please select a delivery time window')
        );
        return;
      }
      await onConfirm(payload);
      onDismiss();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('business.orders.confirmFailed', 'Failed to confirm'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <>
      <Portal>
      <Modal
        visible={visible && !submitting}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.fullscreen,
          {
            width: windowWidth,
            height: windowHeight,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <Text variant="titleLarge">
            {t('business.orders.confirmModalTitle', 'Confirm order')} #{order.order_number}
          </Text>
        </View>
        <Divider />
        <ScrollView
          style={styles.body}
          contentContainerStyle={{ padding: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
            {isAsap && !showPicker ? (
              <Text variant="bodyMedium" style={{ marginBottom: spacing.md }}>
                {isPickup
                  ? t(
                      'business.orders.confirmAsapPickup',
                      'Customer wants pickup as soon as possible. Confirm to start preparing now.'
                    )
                  : t(
                      'business.orders.confirmAsapDelivery',
                      'Customer wants delivery as soon as possible. Confirm to start preparing now.'
                    )}
              </Text>
            ) : (
            <Text variant="titleSmall" style={{ marginBottom: spacing.sm, fontWeight: '600' }}>
              {isShipping
                ? t('business.orders.confirmShipWindow', 'When will you ship?')
                : isPickup
                ? t('business.orders.confirmPickupSlot', 'Pickup time slot')
                : t('business.orders.confirmDeliveryWindow', 'Delivery time window')}
            </Text>
            )}

            {isAsap && !showPicker ? null : hasExisting && !createNewWindow ? (
              <View>
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
                  {isShipping
                    ? t(
                        'business.orders.confirmClientShipPreferences',
                        "Client's preferred ship-by windows:"
                      )
                    : isPickup
                    ? t(
                        'business.orders.confirmClientPickupPreferences',
                        "Client's preferred pickup windows:"
                      )
                    : t(
                        'business.orders.confirmClientPreferences',
                        "Client's preferred delivery windows:"
                      )}
                </Text>
                <RadioButton.Group value={selectedWindowId} onValueChange={handleSelectExisting}>
                  {existingWindows.map((w) => {
                    const dateLabel = w.preferred_date
                      ? formatPreferredDate(w.preferred_date, i18n.language)
                      : '';
                    const timeLabel =
                      w.time_slot_start && w.time_slot_end
                        ? `${formatTimeSlotValue(w.time_slot_start, i18n.language)} – ${formatTimeSlotValue(w.time_slot_end, i18n.language)}`
                        : '';
                    const slotName = w.slot?.slot_name ?? '';
                    const selected = selectedWindowId === w.id;
                    return (
                      <Pressable
                        key={w.id}
                        onPress={() => handleSelectExisting(w.id)}
                        style={[
                          styles.windowCard,
                          {
                            borderRadius: borderRadius.md,
                            borderColor: selected ? colors.primary.light : colors.border,
                            backgroundColor: selected ? `${colors.primary.main}08` : colors.surface,
                            marginBottom: spacing.sm,
                          },
                        ]}
                      >
                        <RadioButton
                          value={w.id}
                          status={selected ? 'checked' : 'unchecked'}
                          color={colors.primary.main}
                        />
                        <View style={styles.windowCardBody}>
                          <View style={styles.windowCardRow}>
                            <Icon source="calendar" size={18} color={colors.text.secondary} />
                            <Text variant="bodyMedium" style={{ fontWeight: '600', marginLeft: spacing.xs }}>
                              {dateLabel}
                            </Text>
                          </View>
                          {timeLabel || slotName ? (
                            <View style={[styles.windowCardRow, { marginTop: spacing.xs }]}>
                              <Icon source="clock-outline" size={18} color={colors.text.secondary} />
                              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginLeft: spacing.xs }}>
                                {timeLabel}
                                {timeLabel && slotName ? ' · ' : ''}
                                {slotName ? `(${slotName})` : ''}
                              </Text>
                            </View>
                          ) : null}
                          {w.special_instructions ? (
                            <Text
                              variant="bodySmall"
                              style={{ color: colors.text.secondary, marginTop: spacing.xs }}
                            >
                              {t('business.orders.confirmSpecialInstructions', 'Special instructions')}:{' '}
                              {w.special_instructions}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </RadioButton.Group>
                <Button mode="outlined" onPress={handleCreateNewWindow} style={{ marginTop: spacing.sm }}>
                  {isPickup
                    ? t('business.orders.confirmCreateDifferentPickup', 'Choose a different pickup slot')
                    : t('business.orders.confirmCreateDifferent', 'Choose a different time window')}
                </Button>
              </View>
            ) : (
              <View>
                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
                  {createNewWindow
                    ? isPickup
                      ? t(
                          'business.orders.confirmCreateNewPickupSlot',
                          'Select a pickup date and time slot:'
                        )
                      : t(
                          'business.orders.confirmCreateNewWindow',
                          'Select a new delivery date and time slot:'
                        )
                    : isPickup
                      ? t(
                          'business.orders.confirmNoClientPickupPreferences',
                          'No client preferences available. Select a pickup date and time slot:'
                        )
                      : t(
                          'business.orders.confirmNoClientPreferences',
                          'No client preferences available. Select a delivery date and time slot:'
                        )}
                </Text>
                {!stateCode ? (
                  <Text variant="bodySmall" style={{ color: colors.error.main }}>
                    {isPickup
                      ? t(
                          'business.orders.confirmMissingStoreState',
                          'Store address region is required to load pickup slots.'
                        )
                      : t(
                          'business.orders.confirmMissingState',
                          'Delivery address state is required to load time slots.'
                        )}
                  </Text>
                ) : (
                  <DeliveryWindowPicker
                    countryCode={countryCode}
                    stateCode={stateCode}
                    enabled={pickerEnabled}
                    isFastDelivery={order.requires_fast_delivery}
                    fulfillment={isPickup ? 'pickup' : 'delivery'}
                    onSelectionChange={setNewWindowData}
                  />
                )}
              </View>
            )}

            {error ? (
              <Text variant="bodySmall" style={[styles.error, { color: colors.error.main }]}>
                {error}
              </Text>
            ) : null}
        </ScrollView>
        <Divider />
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
          <Text
            variant="bodySmall"
            style={{
              color: colors.text.secondary,
            }}
          >
            {isPickup
              ? t(
                  'business.orders.confirmConsequencePickup',
                  'The customer will be notified. Prepare the order, then mark it ready when they can collect it.'
                )
              : isShipping
                ? t(
                    'business.orders.confirmConsequenceShipping',
                    'The customer will be notified. Prepare the order, then mark it shipped with tracking.'
                  )
                : t(
                    'business.orders.confirmConsequenceDelivery',
                    'The customer will be notified. Prepare the order, then mark it ready — Rendasua finds a courier only after that.'
                  )}
          </Text>
          <View style={styles.actionButtons}>
            <Button onPress={onDismiss} disabled={submitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              loading={submitting}
              disabled={!canSubmit || submitting}
              onPress={() => void handleSubmit()}
            >
              {t('orderActions.confirmOrder', 'Confirm order')}
            </Button>
          </View>
        </View>
      </Modal>
      </Portal>
      <ActionLoadingDialog visible={submitting} action="confirm_order" />
    </>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    margin: 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  body: {
    flex: 1,
  },
  actions: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  windowCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 4,
    paddingRight: 8,
  },
  windowCardBody: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 12,
  },
  windowCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  error: { marginTop: 12 },
});
