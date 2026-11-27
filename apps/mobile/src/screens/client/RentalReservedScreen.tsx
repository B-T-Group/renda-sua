import { useLayoutEffect, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalBookingDetail } from '../../hooks/useRentalBookingDetail';
import type { ClientRootStackParamList } from '../../navigation/types';
import { buildReservedView, type ReservedStepIcon, type ReservedView } from '../../utils/rentals/reserveSuccess';

type Params = { RentalReserved: { bookingId: string } };

const STEP_ICONS: Record<ReservedStepIcon, keyof typeof MaterialCommunityIcons.glyphMap> = {
  pin: 'map-marker-outline',
  camera: 'camera-outline',
  wallet: 'wallet-outline',
  refund: 'restore',
};

export default function RentalReservedScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const { bookingId } = useRoute<RouteProp<Params, 'RentalReserved'>>().params;
  const { booking, loading } = useRentalBookingDetail(bookingId, { pollPaymentWhenProposed: false });
  const view = useMemo(
    () => (booking ? buildReservedView(booking, i18n.language, t) : null),
    [booking, i18n.language, t]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false });
  }, [navigation]);

  const viewRental = () => navigation.replace('RentalBookingDetail', { bookingId });
  const goDashboard = () => navigation.navigate('ClientMyRentals', { segment: 'upcoming' });

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <ScrollView style={styles.flex} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.lg }}>
        <Header view={view} />
        {loading && !view ? <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary.main} /> : null}
        {view ? <Steps view={view} /> : null}
      </ScrollView>
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
          backgroundColor: colors.pageBackground,
          gap: spacing.xs,
        }}
      >
        <Button testID="reserved-view-rental" mode="contained" onPress={viewRental}>
          {t('rentals.reserved.viewRental', 'View rental')}
        </Button>
        <Button testID="reserved-go-dashboard" mode="text" onPress={goDashboard}>
          {t('rentals.reserved.goDashboard', 'Go to dashboard')}
        </Button>
      </View>
    </View>
  );
}

function Header({ view }: { view: ReservedView | null }) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
      <MaterialCommunityIcons name="check-circle" size={56} color={colors.success.main} />
      <Text style={[typography.h5, { color: colors.text.primary, textAlign: 'center', marginTop: spacing.sm }]}>
        {t('rentals.reserved.headline', 'You’re reserved')}
      </Text>
      {view?.itemName ? (
        <Text style={[typography.subtitle2, { color: colors.text.primary, textAlign: 'center', marginTop: spacing.xs }]}>
          {view.itemName}
        </Text>
      ) : null}
      <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center', marginTop: spacing.xs }]}>
        {t('rentals.reserved.intro', 'Nothing more to do now. Here is what happens next.')}
      </Text>
    </View>
  );
}

function Steps({ view }: { view: ReservedView }) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  return (
    <View testID="reserved-steps">
      <Text style={[typography.caption, { color: colors.primary.main, fontWeight: '800', letterSpacing: 0.5, marginBottom: spacing.sm }]}>
        {t('rentals.reserved.nextHeading', 'WHAT’S NEXT')}
      </Text>
      {view.steps.map((step, i) => (
        <View
          key={step.key}
          testID={`reserved-step-${step.key}`}
          style={[
            styles.card,
            shadows.sm,
            { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
          ]}
        >
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: colors.primaryTint }]}>
              <MaterialCommunityIcons name={STEP_ICONS[step.icon]} size={20} color={colors.primary.main} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.subtitle2, { color: colors.text.primary }]}>{`${i + 1}. ${step.title}`}</Text>
              <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 2 }]}>{step.body}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
