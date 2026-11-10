import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { RentalRequestScheduleCard, type RentalRequestScheduleCardProps } from './RentalRequestScheduleCard';
import { RentalRequestStickyBar } from './RentalRequestStickyBar';

export interface RentalRequestScreenFormProps extends RentalRequestScheduleCardProps {
  units: number;
  unitsMax: number;
  stock: number;
  onChangeUnits: (next: number) => void;
  notes: string;
  onChangeNotes: (value: string) => void;
  priceLabel?: string;
  priceAmount?: string;
  hoursCaption?: string;
  totalAmount: string;
  message?: string | null;
  sendLabel: string;
  sendIcon: string;
  sendDisabled: boolean;
  sending: boolean;
  onSend: () => void;
}

export function RentalRequestScreenForm(props: RentalRequestScreenFormProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const block = [
    styles.block,
    { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.sm },
  ];

  return (
    <View style={styles.fill}>
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={{ padding: spacing.sm, gap: spacing.sm, paddingBottom: spacing.md }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <RentalRequestScheduleCard {...props} />
        <QuantityBlock {...props} blockStyle={block} />
        <TextInput
          testID="rental-request-notes"
          mode="flat"
          multiline
          value={props.notes}
          onChangeText={props.onChangeNotes}
          maxLength={2000}
          placeholder={t('rentals.requestForm.optionalNotes', 'Optional notes for the business')}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
          style={[styles.notes, { backgroundColor: colors.surfaceInput, borderRadius: borderRadius.md, color: colors.text.primary }]}
          textColor={colors.text.primary}
          placeholderTextColor={colors.text.disabled}
        />
        {props.priceLabel && props.priceAmount ? (
          <View style={block}>
            <Text style={[styles.kicker, { color: colors.text.secondary }]}>
              {t('rentals.requestForm.price', 'Price')}
            </Text>
            <View style={styles.priceRow}>
              <Text testID="rental-request-price" style={[styles.priceLeft, { color: colors.text.primary }]}>
                {props.priceLabel}
              </Text>
              <Text style={[styles.priceRight, { color: colors.text.primary }]}>{props.priceAmount}</Text>
            </View>
            {props.hoursCaption ? (
              <Text testID="rental-request-hours" style={{ color: colors.text.secondary, marginTop: 4, fontSize: 12 }}>
                {props.hoursCaption}
              </Text>
            ) : null}
          </View>
        ) : null}
        {props.message ? (
          <Text testID="rental-request-message" style={{ color: colors.error.main }}>{props.message}</Text>
        ) : null}
      </ScrollView>
      <RentalRequestStickyBar
        totalAmount={props.totalAmount}
        sendLabel={props.sendLabel}
        sendIcon={props.sendIcon}
        sendDisabled={props.sendDisabled}
        sending={props.sending}
        onSend={props.onSend}
      />
    </View>
  );
}

function QuantityBlock({
  units,
  unitsMax,
  stock,
  onChangeUnits,
  blockStyle,
}: Pick<RentalRequestScreenFormProps, 'units' | 'unitsMax' | 'stock' | 'onChangeUnits'> & {
  blockStyle: object[];
}) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const remaining = Math.max(0, unitsMax);
  return (
    <View style={blockStyle}>
      <Text style={[styles.kicker, { color: colors.text.secondary }]}>
        {t('rentals.requestForm.units', 'Quantity')}
      </Text>
      <View style={styles.stepper}>
        <StepButton
          icon="minus"
          label={t('rentals.requestForm.decreaseQuantity', 'Decrease quantity')}
          disabled={units <= 1}
          onPress={() => onChangeUnits(units - 1)}
          radius={borderRadius.md}
        />
        <Text style={[styles.stepValue, { color: colors.text.primary }]}>{units}</Text>
        <StepButton
          icon="plus"
          label={t('rentals.requestForm.increaseQuantity', 'Increase quantity')}
          disabled={units >= remaining}
          onPress={() => onChangeUnits(units + 1)}
          radius={borderRadius.md}
        />
      </View>
      <Text testID="rental-request-availability" style={{ color: colors.text.secondary, marginTop: 8, fontSize: 12, fontWeight: '600' }}>
        {t('rentals.requestForm.availableForDates', '{{remaining}} of {{total}} available for your dates', {
          remaining,
          total: stock,
          count: remaining,
        })}
      </Text>
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
  radius,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
  radius: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.step,
        {
          borderRadius: radius,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceInput,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={16} color={disabled ? colors.text.disabled : colors.primary.main} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  block: { borderWidth: 1 },
  kicker: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { width: 36, height: 36, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  notes: { minHeight: 48, fontSize: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  priceLeft: { flex: 1, fontSize: 13, fontWeight: '600' },
  priceRight: { fontSize: 13, fontWeight: '800' },
});
