import React, { useEffect, useState } from 'react';
import { Switch, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from 'libphonenumber-js';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import PhoneNumberInput from '../PhoneNumberInput';
import { useTheme } from '../../contexts/ThemeContext';
import type { Order } from '../../types/agent';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { orderNeedsPayAtDeliveryAgentActions } from '../../utils/orderPaymentAgentActions';
import { e164ToCountryAndNational, nationalDigitsToE164 } from '../../utils/phoneLoginUsername';
import { resolveAmountDueAfterDeposit } from '../../utils/depositResume';

export interface RequestPayAtDeliveryDialogProps {
  visible: boolean;
  order: Order | null;
  onDismiss: () => void;
  /** Called with `undefined` when using client phone; override when different phone is used. */
  onSendRequest: (phoneOverride?: string) => Promise<void>;
  submitting: boolean;
}

export function RequestPayAtDeliveryDialog({
  visible,
  order,
  onDismiss,
  onSendRequest,
  submitting,
}: RequestPayAtDeliveryDialogProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [useDifferentPhone, setUseDifferentPhone] = useState(false);
  const [countryIso, setCountryIso] = useState<CountryCode>(() => getDeviceDefaultCountryCode());
  const [nationalDigits, setNationalDigits] = useState('');

  useEffect(() => {
    if (!visible) {
      setUseDifferentPhone(false);
      setNationalDigits('');
      setCountryIso(getDeviceDefaultCountryCode());
      return;
    }
    const phone = order?.client?.user?.phone_number?.trim() ?? '';
    const noPhone = !phone;
    setUseDifferentPhone(noPhone);
    const fallbackIso = getDeviceDefaultCountryCode();
    if (phone) {
      const parsed = e164ToCountryAndNational(phone);
      if (parsed) {
        setCountryIso(parsed.countryIso);
        setNationalDigits(parsed.nationalDigits);
      } else {
        setCountryIso(fallbackIso);
        setNationalDigits('');
      }
    } else {
      setCountryIso(fallbackIso);
      setNationalDigits('');
    }
  }, [visible, order?.id, order?.client?.user?.phone_number]);

  const eligible = order ? orderNeedsPayAtDeliveryAgentActions(order) : false;
  const clientPhone = order?.client?.user?.phone_number?.trim() ?? '';
  const depositPaid =
    !!order && (order.deposit_amount ?? 0) > 0 && order.deposit_status === 'paid';
  const remainder = order ? resolveAmountDueAfterDeposit(order) : null;
  const showRemainder = depositPaid && remainder != null;
  const currency = order?.currency || 'XAF';
  const depositAmount = order?.deposit_amount ?? 0;

  const overrideE164 = nationalDigitsToE164(countryIso, nationalDigits);

  const handleSubmit = async () => {
    if (!order || !eligible) return;
    if (useDifferentPhone) {
      if (!overrideE164) return;
      await onSendRequest(overrideE164);
      return;
    }
    await onSendRequest(undefined);
  };

  const canSubmit =
    eligible &&
    (useDifferentPhone ? overrideE164 !== null : clientPhone.length > 0);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={submitting ? undefined : onDismiss} dismissable={!submitting}>
        <Dialog.Title style={{ color: colors.text.primary }}>
          {t('agent.orders.payAtDelivery.requestTitle', { defaultValue: 'Request payment' })}
        </Dialog.Title>
        <Dialog.Content>
          {!eligible ? (
            <Text variant="bodyMedium" style={{ color: colors.warning.main }}>
              {t('agent.orders.payAtDelivery.notEligible', {
                defaultValue: 'This order is not configured for pay at delivery.',
              })}
            </Text>
          ) : (
            <>
              <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 12 }}>
                {showRemainder
                  ? t('agent.orders.payAtDelivery.requestHelpRemainder', {
                      defaultValue:
                        'The client already paid a deposit of {{deposit}} {{currency}}. Request the remaining {{amount}} {{currency}}.',
                      deposit: depositAmount,
                      amount: remainder,
                      currency,
                    })
                  : t('agent.orders.payAtDelivery.requestHelp', {
                      defaultValue:
                        'Send a mobile payment request to the client. Once they approve it, the order will complete automatically.',
                    })}
              </Text>
              {showRemainder ? (
                <Text
                  variant="titleSmall"
                  style={{ color: colors.text.primary, marginBottom: 12, fontWeight: '700' }}
                >
                  {t('agent.orders.payAtDelivery.amountToCollect', {
                    defaultValue: 'Amount to collect: {{amount}} {{currency}}',
                    amount: remainder,
                    currency,
                  })}
                </Text>
              ) : null}
            </>
          )}
          {order ? (
            <Text variant="titleSmall" style={{ color: colors.text.primary, marginBottom: 12 }}>
              {t('agent.orders.payAtDelivery.orderNumber', {
                defaultValue: 'Order #{{orderNumber}}',
                orderNumber: order.order_number,
              })}
            </Text>
          ) : null}
          {eligible && !clientPhone ? (
            <Text variant="bodySmall" style={{ color: colors.warning.main, marginBottom: 12 }}>
              {t('agent.orders.payAtDelivery.noClientPhone', {
                defaultValue:
                  'No phone number on file for this client. Enter a number below to send the payment request.',
              })}
            </Text>
          ) : null}
          {eligible && clientPhone && !useDifferentPhone ? (
            <View style={{ marginBottom: 14 }}>
              <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 6, textAlign: 'center' }}>
                {t('agent.orders.payAtDelivery.paymentPhoneIntro', {
                  defaultValue: 'The payment request will be sent to:',
                })}
              </Text>
              <Text
                variant="titleMedium"
                selectable
                style={{ color: colors.text.primary, textAlign: 'center', fontWeight: '600' }}
              >
                {clientPhone}
              </Text>
            </View>
          ) : null}
          {eligible && clientPhone ? (
            <View style={styles.row}>
              <Text variant="bodyMedium" style={{ color: colors.text.primary, flex: 1 }}>
                {t('agent.orders.payAtDelivery.useDifferentPhone', { defaultValue: 'Use a different phone number' })}
              </Text>
              <Switch
                value={useDifferentPhone}
                onValueChange={(v) => {
                  setUseDifferentPhone(v);
                  if (clientPhone) {
                    const parsed = e164ToCountryAndNational(clientPhone);
                    if (parsed) {
                      setCountryIso(parsed.countryIso);
                      setNationalDigits(parsed.nationalDigits);
                    }
                  }
                }}
                disabled={submitting}
              />
            </View>
          ) : null}
          {eligible && useDifferentPhone ? (
            <View style={{ marginTop: 4 }}>
              <PhoneNumberInput
                countryIso={countryIso}
                nationalDigits={nationalDigits}
                onCountryIsoChange={setCountryIso}
                onNationalDigitsChange={setNationalDigits}
                disabled={submitting}
                hasError={nationalDigits.length > 0 && overrideE164 === null}
              />
              {nationalDigits.length > 0 && overrideE164 === null ? (
                <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 6 }}>
                  {t('agent.orders.payAtDelivery.phoneInvalid', {
                    defaultValue: 'Enter a valid phone number for the selected country.',
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={submitting}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button mode="contained" onPress={() => void handleSubmit()} loading={submitting} disabled={!canSubmit || submitting}>
            {t('agent.orders.payAtDelivery.submitRequest', { defaultValue: 'Send request' })}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
});
