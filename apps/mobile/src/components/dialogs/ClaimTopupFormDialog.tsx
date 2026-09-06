import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Portal, Dialog, Button, Text, Card, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CountryCode } from 'libphonenumber-js';
import { useTheme } from '../../contexts/ThemeContext';
import type { Order } from '../../types/agent';
import PhoneNumberInput from '../PhoneNumberInput';
import { nationalDigitsToE164, seedPhoneInputFromE164 } from '../../utils/phoneLoginUsername';
import { pickMobileMoneyDefaultCountry } from '../../utils/placeOrderPhoneValidation';

const CHARGE_PCT = 3.5;

function resolveIso4217Currency(order: Order): string {
  const raw = (order.currency ?? '').trim().toUpperCase();
  if (raw.length === 3 && /^[A-Z]{3}$/.test(raw)) return raw;
  return 'XAF';
}

export interface ClaimTopupFormDialogProps {
  visible: boolean;
  order: Order | null;
  phone: string;
  onChangePhone: (v: string) => void;
  onDismiss: () => void;
  onConfirm: (phoneE164: string) => void;
  confirming: boolean;
}

export function ClaimTopupFormDialog({
  visible,
  order,
  phone,
  onChangePhone,
  onDismiss,
  onConfirm,
  confirming,
}: ClaimTopupFormDialogProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  /** Edge-to-edge layout; also fixes Paper Dialog's min 26px horizontal margin + full width overflow. */
  const fullScreen = width < 768;
  const itemCountry = order?.business_location?.address?.country;
  const [countryIso, setCountryIso] = useState<CountryCode>(() =>
    pickMobileMoneyDefaultCountry(itemCountry)
  );
  const [nationalDigits, setNationalDigits] = useState('');
  const userEditedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      userEditedRef.current = false;
      return;
    }
    if (userEditedRef.current) return;
    const seeded = seedPhoneInputFromE164(
      phone,
      pickMobileMoneyDefaultCountry(itemCountry)
    );
    setCountryIso(seeded.countryIso);
    setNationalDigits(seeded.nationalDigits);
    const e164 = nationalDigitsToE164(seeded.countryIso, seeded.nationalDigits);
    if (e164) onChangePhone(e164);
  }, [visible, order?.id, itemCountry, phone, onChangePhone]);

  const amounts = useMemo(() => {
    if (!order) return null;
    const holdAmount = order.agent_hold_amount ?? 0;
    const chargeAmount = (holdAmount * CHARGE_PCT) / 100;
    const cur = resolveIso4217Currency(order);
    const fmt = (n: number) =>
      new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(Number.isFinite(n) ? n : 0);
    return {
      holdAmount,
      chargeAmount,
      total: holdAmount + chargeAmount,
      commission: order.delivery_commission ?? order.base_delivery_fee ?? 0,
      fmt,
    };
  }, [order]);

  const claimPhoneE164 = nationalDigitsToE164(countryIso, nationalDigits);

  if (!order) {
    return (
      <Portal>
        <Dialog visible={visible} onDismiss={onDismiss}>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('common.loading')}</Text>
          </Dialog.Content>
        </Dialog>
      </Portal>
    );
  }

  const dialogSurfaceStyle = fullScreen
    ? {
        marginHorizontal: 0,
        marginVertical: 0,
        borderRadius: 0,
        width: '100%' as const,
        maxWidth: '100%' as const,
        maxHeight: height,
        alignSelf: 'stretch' as const,
      }
    : { maxWidth: Math.min(720, width - 32), alignSelf: 'center' as const };

  const edgePadding = fullScreen
    ? { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }
    : {};

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={confirming ? undefined : onDismiss}
        dismissable={!confirming}
        style={dialogSurfaceStyle}
      >
        <View style={[styles.titleBlock, fullScreen ? edgePadding : { paddingHorizontal: 24 }, { paddingTop: 8 }]}>
          <View
            style={[styles.iconWrap, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.md }]}
          >
            <MaterialCommunityIcons name="phone" size={26} color={colors.primary.main} />
          </View>
          <View style={styles.titleTextCol}>
            <Text variant="headlineSmall" style={{ color: colors.text.primary }}>
              {t('agent.claimOrder.title', 'Claim Order with Payment')}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 4 }}>
              {t('agent.claimOrder.subtitle', 'Secure your delivery opportunity')}
            </Text>
          </View>
        </View>

        <Dialog.Content
          style={[
            fullScreen
              ? {
                  paddingTop: 8,
                  maxHeight: height * 0.78,
                  ...edgePadding,
                }
              : { paddingHorizontal: 20, paddingTop: 8, maxHeight: height * 0.65 },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View
              style={[
                styles.infoBanner,
                {
                  backgroundColor: colors.info.main + '12',
                  borderColor: colors.info.main + '35',
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="information" size={22} color={colors.info.main} />
                <Text variant="bodyMedium" style={{ flex: 1, color: colors.text.primary, marginLeft: 10 }}>
                  {t(
                    'agent.claimOrder.info',
                    'A payment request will be sent to your phone number. Once you accept the payment request, the order will be automatically claimed by you.'
                  )}
                </Text>
              </View>
            </View>

            <View style={[styles.cardsRow, { flexDirection: fullScreen ? 'column' : 'row' }]}>
              <Card mode="outlined" style={[styles.card, { borderColor: colors.divider }]}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="truck-delivery-outline" size={22} color={colors.primary.main} />
                    <Text variant="titleMedium" style={{ color: colors.text.primary, marginLeft: 8 }}>
                      {t('agent.claimOrder.orderDetails', 'Order Details')}
                    </Text>
                  </View>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 4 }}>
                    {t('agent.claimOrder.orderNumber', 'Order Number')}
                  </Text>
                  <View style={[styles.chip, { borderColor: colors.primary.main + '55', borderRadius: 8 }]}>
                    <Text style={{ color: colors.primary.main, fontWeight: '600' }}>{order.order_number}</Text>
                  </View>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 14, marginBottom: 4 }}>
                    {t('agent.claimOrder.deliveryEarnings', 'Your delivery earnings')}
                  </Text>
                  <Text variant="headlineSmall" style={{ color: colors.success.main, fontWeight: '700' }}>
                    {amounts ? amounts.fmt(amounts.commission) : '—'}
                  </Text>
                </Card.Content>
              </Card>

              <Card mode="outlined" style={[styles.card, { borderColor: colors.divider, marginLeft: fullScreen ? 0 : 12, marginTop: fullScreen ? 12 : 0 }]}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="cash" size={22} color={colors.primary.main} />
                    <Text variant="titleMedium" style={{ color: colors.text.primary, marginLeft: 8 }}>
                      {t('agent.claimOrder.paymentDetails', 'Payment Details')}
                    </Text>
                  </View>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 4 }}>
                    {t('agent.claimOrder.holdAmount', 'Hold amount')}
                  </Text>
                  <Text variant="bodyLarge" style={{ color: colors.text.primary, marginBottom: 10 }}>
                    {amounts ? amounts.fmt(amounts.holdAmount) : '—'}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 4 }}>
                    {t('agent.claimOrder.serviceCharge', { percentage: CHARGE_PCT, defaultValue: 'Service charge ({{percentage}}%)' })}
                  </Text>
                  <Text variant="bodyLarge" style={{ color: colors.text.primary, marginBottom: 10 }}>
                    {amounts ? amounts.fmt(amounts.chargeAmount) : '—'}
                  </Text>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.totalRow}>
                    <Text variant="titleSmall" style={[styles.totalLabel, { color: colors.text.primary }]}>
                      {t('agent.claimOrder.totalCharge', 'Total to be charged')}
                    </Text>
                    <Text variant="titleMedium" style={[styles.totalAmount, { color: colors.error.main }]}>
                      {amounts ? amounts.fmt(amounts.total) : '—'}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            </View>

            <View
              style={[
                styles.explainBox,
                {
                  marginTop: 16,
                  padding: 16,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.info.main + '30',
                  backgroundColor: colors.info.main + '0d',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="help-circle-outline" size={22} color={colors.info.main} />
                <Text variant="titleSmall" style={{ color: colors.info.main, marginLeft: 8, flex: 1 }}>
                  {t('agent.claimOrder.paymentExplanation.title', {
                    defaultValue: 'Why do I need to make a payment?',
                  })}
                </Text>
              </View>
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 8, lineHeight: 20 }}>
                {t('agent.claimOrder.paymentExplanation.description', {
                  defaultValue:
                    'To deliver an order you need to give us a guarantee (a percentage of the order value). The more orders you complete, the more trust you build and the hold amount can be reduced. After delivery, your delivery fee is credited and the hold is released.',
                })}
              </Text>
            </View>

            <View
              style={[
                styles.phoneBox,
                {
                  marginTop: 16,
                  padding: 16,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.divider,
                  backgroundColor: colors.pageBackground,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="phone-outline" size={22} color={colors.primary.main} />
                <Text variant="titleSmall" style={{ color: colors.text.primary, marginLeft: 8 }}>
                  {t('agent.claimOrder.phoneNumber', 'Phone Number')}
                </Text>
              </View>
              <PhoneNumberInput
                countryIso={countryIso}
                nationalDigits={nationalDigits}
                onCountryIsoChange={(iso) => {
                  userEditedRef.current = true;
                  setCountryIso(iso);
                  onChangePhone(nationalDigitsToE164(iso, nationalDigits) ?? '');
                }}
                onNationalDigitsChange={(digits) => {
                  userEditedRef.current = true;
                  setNationalDigits(digits);
                  onChangePhone(nationalDigitsToE164(countryIso, digits) ?? '');
                }}
                allowedIsos={['CM', 'GA']}
                hasError={nationalDigits.length > 0 && !claimPhoneE164}
                disabled={confirming}
              />
            </View>
          </ScrollView>
        </Dialog.Content>

        <Dialog.Actions
          style={[
            {
              flexDirection: fullScreen ? 'column' : 'row',
              justifyContent: 'flex-end',
              alignItems: 'stretch',
              paddingBottom: Math.max(insets.bottom, 12),
              gap: 10,
            },
            fullScreen ? edgePadding : { paddingHorizontal: 20 },
          ]}
        >
          <Button mode="outlined" onPress={onDismiss} disabled={confirming} style={fullScreen ? { width: '100%' } : undefined}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={() => {
              if (!claimPhoneE164) return;
              onChangePhone(claimPhoneE164);
              onConfirm(claimPhoneE164);
            }}
            loading={confirming}
            disabled={confirming || !claimPhoneE164}
            style={fullScreen ? { width: '100%' } : undefined}
          >
            {confirming
              ? t('agent.claimOrder.processing', 'Processing…')
              : t('agent.claimOrder.confirmClaim', 'Confirm & Claim Order')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  titleBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titleTextCol: { flex: 1, minWidth: 0 },
  infoBanner: { padding: 14, borderWidth: 1, marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardsRow: { gap: 0 },
  card: { flex: 1, minWidth: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
  },
  explainBox: {},
  phoneBox: {},
  scrollContent: { flexGrow: 1, paddingBottom: 8 },
  totalLabel: { flex: 1, flexShrink: 1, marginRight: 8 },
  totalAmount: { fontWeight: '700', flexShrink: 1, minWidth: 0, textAlign: 'right' },
});
