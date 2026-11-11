import { useCallback } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RentalSlotPicker } from '../../components/rentals/RentalSlotPicker';
import { RentalSearchDateSheet } from '../../components/rentals/search/RentalSearchDateSheet';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalListingDetail } from '../../hooks/useRentalListingDetail';
import { useRentalRequestDates } from '../../hooks/useRentalRequestDates';
import type { ClientRootStackParamList, GuestRootStackParamList, RentalRequestParams } from '../../navigation/types';
import { useStore } from '../../stores/RootStore';
import { formatRequestAmount } from '../../utils/rentals/rentalRequestFormat';

type RequestRoute = { RentalRequest: RentalRequestParams };

export default function RentalRequestScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RequestRoute, 'RentalRequest'>>();
  const { auth } = useStore();
  const listingId = route.params?.listingId;
  const { listing, bookedWindows, loading, error, refetch } = useRentalListingDetail(listingId);
  const dates = useRentalRequestDates(listing, route.params?.startDate, route.params?.endDate);
  const onLoginRequired = useLoginRequired(navigation);
  const onSubmitted = useCallback(
    (requestId: string) => {
      (navigation as NativeStackNavigationProp<ClientRootStackParamList>).navigate(
        'RentalRequestSubmitted',
        { requestId }
      );
    },
    [navigation]
  );

  if (loading && !listing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (!listing) {
    return (
      <MissingListing
        message={error || t('rentals.detail.notFoundBody', 'It may have been removed or is no longer available.')}
        onBack={() => navigation.goBack()}
        onRetry={() => void refetch()}
      />
    );
  }

  const item = listing.rental_item;
  const image = item.rental_item_images?.[0];
  const selectionKey = dates.presetSelections.map((row) => `${row.id}:${row.startMs}`).join('|') || 'request';

  return (
    <View style={[styles.fill, { backgroundColor: colors.pageBackground }]}>
      <RequestAppBar title={item.name} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <RentalSlotPicker
          key={selectionKey}
          layout="screen"
          listingId={listing.id}
          isAuthenticated={auth.isAuthenticated}
          bookedWindows={bookedWindows}
          minRentalHours={listing.min_rental_hours}
          maxRentalHours={listing.max_rental_hours}
          unitsAvailable={Number(listing.units_available) || 1}
          weeklyAvailability={listing.weekly_availability}
          basePricePerHour={toNumber(listing.base_price_per_hour)}
          basePricePerDay={toNumber(listing.base_price_per_day)}
          currency={item.currency || 'XAF'}
          onLoginRequired={onLoginRequired}
          onSubmitted={auth.isAuthenticated ? onSubmitted : undefined}
          initialSelections={dates.presetSelections}
          datesFilled={Boolean(dates.stay)}
          requestBlocked={dates.requestBlocked}
          requestBusy={dates.checkingStay}
          onSeeDates={dates.openDateEditor}
          itemName={item.name}
          itemMeta={itemMeta(item.business?.name, toNumber(listing.base_price_per_day), toNumber(listing.base_price_per_hour), item.currency || 'XAF', i18n.language, t)}
          imageUrl={image?.display_url || image?.image_url || null}
          dateLine={dates.dateLine}
          onEditDates={dates.openDateEditor}
          unavailableLabel={dates.unavailableLabel}
        />
      </KeyboardAvoidingView>
      <RentalSearchDateSheet
        visible={dates.editOpen}
        value={dates.draftStay}
        timeZone={dates.timeZone}
        onChange={dates.setDraftStay}
        onApply={() => {
          if (!dates.draftStay || dates.draftStay.dayCount < 1 || dates.draftStay.dayCount > 30) return;
          dates.setEditOpen(false);
          void dates.commitStay(dates.draftStay);
        }}
        onClose={() => dates.setEditOpen(false)}
      />
    </View>
  );
}

function useLoginRequired(navigation: ReturnType<typeof useNavigation>) {
  return useCallback(() => {
    const parent = navigation.getParent() ?? navigation;
    (parent as NativeStackNavigationProp<GuestRootStackParamList>).navigate('GuestTabs', {
      screen: 'GuestAuth',
      params: { screen: 'Login' },
    });
  }, [navigation]);
}

function itemMeta(
  businessName: string | undefined,
  daily: number,
  hourly: number,
  currency: string,
  language: string,
  t: (key: string, fallback: string) => string
): string {
  const amount = formatRequestAmount(daily > 0 ? daily : hourly, currency, language);
  const unit = daily > 0 ? t('rentals.searchFirst.perDay', '/ day') : t('rentals.requestForm.perHour', '/ hour');
  return [businessName, `${amount} ${unit}`].filter(Boolean).join(' · ');
}

function toNumber(value: string | number): number {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function RequestAppBar({
  title,
  heading,
  onBack,
}: {
  title: string;
  heading?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.appBar,
        {
          paddingTop: insets.top + spacing.xs,
          backgroundColor: colors.surface,
          borderBottomColor: colors.divider,
          paddingHorizontal: spacing.xs,
          paddingBottom: spacing.xs,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.back', 'Back')}
        onPress={onBack}
        hitSlop={8}
        style={styles.back}
      >
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.primary.main} />
      </Pressable>
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {heading ?? t('rentals.requestRental', 'Request this rental')}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.text.secondary, fontSize: 12 }}>{title}</Text>
      </View>
    </View>
  );
}

function MissingListing({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: spacing.lg, paddingTop: insets.top }]}>
      <Text style={{ color: colors.text.primary, textAlign: 'center' }}>{message}</Text>
      <Button mode="contained" style={{ marginTop: spacing.md }} onPress={onBack}>
        {t('common.back', 'Back')}
      </Button>
      <Button mode="text" onPress={onRetry}>{t('common.retry', 'Retry')}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appBar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 4 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, minWidth: 0, paddingRight: 8 },
  title: { fontSize: 16, fontWeight: '800' },
});
