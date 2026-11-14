import React from 'react';
import { ScrollView, Share, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { rentalCalendarIcs } from '../../../utils/rentals/confirmationFormat';

export function RentalStartedConfirmation({
  momo,
  due,
  zone,
  paid,
  deposit,
  title,
  startAt,
  endAt,
  location,
  onBack,
}: {
  momo: boolean;
  due: string;
  zone: string;
  paid: string;
  deposit: string;
  title: string;
  startAt?: string | null;
  endAt?: string | null;
  location?: string | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = '#0A4FB5';
  const lead = momo
    ? t('rentalInspection.confirm.momoLead', 'Mobile Money payment succeeded. Return is due by {{due}} ({{zone}}).', { due, zone })
    : t('rentalInspection.confirm.startedLead', 'Return is due by {{due}} ({{zone}}).', { due, zone });
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24 }}
    >
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {t('rentalInspection.confirm.pageTitle', 'Confirmation')}
      </Text>
      {momo ? <MomoTicks accent={accent} /> : <StartedMark accent={accent} />}
      {momo ? null : (
        <Text style={[typography.h5, { color: colors.text.primary, marginTop: spacing.sm }]}>
          {t('rentalInspection.confirm.startedTitle', 'Rental started')}
        </Text>
      )}
      <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}>{lead}</Text>
      <Fact label={t('rentalInspection.confirm.returnDue', 'Return due')} value={due} />
      <Fact label={t('rentalInspection.confirm.paid', 'Paid')} value={paid} />
      {deposit ? <Fact label={t('rentalInspection.confirm.deposit', 'Deposit held')} value={deposit} /> : null}
      <Button mode="contained" buttonColor={accent} style={{ marginTop: spacing.lg, minHeight: 48 }} onPress={onBack}>
        {t('rentalInspection.confirm.backToRental', 'Back to rental')}
      </Button>
      <Button
        mode="text"
        textColor={accent}
        icon="calendar"
        onPress={() => void shareCalendar(title, startAt, endAt, location)}
      >
        {t('rentalInspection.confirm.addCalendar', 'Add to calendar')}
      </Button>
    </ScrollView>
  );
}

function StartedMark({ accent }: { accent: string }) {
  return (
    <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: accent + '18', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
      <MaterialCommunityIcons name="check" size={28} color={accent} />
    </View>
  );
}

function MomoTicks({ accent }: { accent: string }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const rows = [
    { title: t('rentalInspection.confirm.paymentConfirmed', 'Payment confirmed'), sub: t('rentalInspection.confirm.mobileMoney', 'Mobile Money') },
    { title: t('rentalInspection.confirm.startedTitle', 'Rental started'), sub: '' },
  ];
  return (
    <View style={{ marginTop: spacing.md }}>
      {rows.map((row) => (
        <View key={row.title} style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
          <MaterialCommunityIcons name="check-circle" size={22} color={accent} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={[typography.subtitle2, { color: colors.text.primary }]}>{row.title}</Text>
            {row.sub ? <Text style={[typography.caption, { color: colors.text.secondary }]}>{row.sub}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
      <Text style={[typography.body2, { color: colors.text.secondary }]}>{label}</Text>
      <Text style={[typography.body2, { color: colors.text.primary, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

async function shareCalendar(
  title: string,
  start?: string | null,
  end?: string | null,
  location?: string | null
): Promise<void> {
  const ics = rentalCalendarIcs({ title, start, end, location });
  await Share.share({ message: ics, title });
}
