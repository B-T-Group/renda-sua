import { useCallback } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RentalSlotPicker } from '../../components/rentals/RentalSlotPicker';
import { CardWindowNotice } from '../../components/rentals/request/CardWindowNotice';
import { RentalDayHoursSheet } from '../../components/rentals/dayHours/RentalDayHoursSheet';
import { useDayHoursPicker } from '../../components/rentals/dayHours/useDayHoursPicker';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalListingDetail } from '../../hooks/useRentalListingDetail';
import { useRentalRequestDates } from '../../hooks/useRentalRequestDates';
import type { ClientRootStackParamList, GuestRootStackParamList, RentalRequestParams } from '../../navigation/types';
import { useStore } from '../../stores/RootStore';
import {
  cardEndMisses,
  cardWindowSendReason,
  cardWindowWarning,
  effectiveCardEnd,
  formatCardCutoff,
} from '../../utils/rentals/cardWindow';
import { requestWindowIso } from '../../utils/rentals/rentalSearchPreset';
import { formatRequestAmount } from '../../utils/rentals/rentalRequestFormat';
import { fromHourlyPrice, pickerLang } from '../../utils/rentals/dayHoursCopy';
import { withRateUnit } from '../../utils/rentals/moneyRateUnit';

type RequestRoute = { RentalRequest: RentalRequestParams };

export default function RentalRequestScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RequestRoute, 'RentalRequest'>>();
  const { auth } = useStore();
  const { flags } = useClientFlags();
  const listingId = route.params?.listingId;
  const { listing, bookedWindows, loading, error, refetch } = useRentalListingDetail(listingId);
  const dates = useRentalRequestDates(listing, route.params?.startDate, route.params?.endDate);
  const picker = useDayHoursPicker({
    listing,
    booked: bookedWindows,
    seed: dates.presetSelections,
    language: i18n.language,
    openOnStart: true,
  });
  const guardOn = flags.rentals_card_window_guard_enabled;
  const cardOn = listing?.payment_rail === 'stripe';
  const latest = guardOn ? effectiveCardEnd(listing, cardOn) : null;
  const endIso = selectionEndIso(picker.rows ?? dates.presetSelections);
  const unfit = cardEndMisses(endIso, latest);
  const zone = listing?.timezone || dates.timeZone || 'Africa/Douala';
  const cutoff = latest ? formatCardCutoff(latest, zone, i18n.language) : '';
  const openDates = useCallback(() => {
    if (guardOn) void refetch();
    picker.setOpen(true);
  }, [guardOn, picker, refetch]);
  const onLoginRequired = useLoginRequired(navigation);
  const onSubmitted = useCallback(
    (requestId: string) => {
      (navigation as NativeStackNavigationProp<ClientRootStackParamList>).navigate(
        'RentalRequestSubmitted',
        { requestId, inspectionPolicyVersion: listing?.inspection_policy_version ?? null }
      );
    },
    [listing?.inspection_policy_version, navigation]
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
  const selectionKey = `dh:${picker.selectionKey}`;
  const picked = picker.rows;

  return (
    <View style={[styles.fill, { backgroundColor: colors.pageBackground }]}>
      <RequestAppBar title={item.name} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <RentalSlotPicker
          key={selectionKey}
          listingId={listing.id}
          isAuthenticated={auth.isAuthenticated}
          bookedWindows={bookedWindows}
          minRentalHours={listing.min_rental_hours}
          maxRentalHours={listing.max_rental_hours}
          unitsAvailable={Number(listing.units_available) || 1}
          basePricePerHour={toNumber(listing.base_price_per_hour)}
          basePricePerDay={toNumber(listing.base_price_per_day)}
          currency={item.currency || 'XAF'}
          onLoginRequired={onLoginRequired}
          onSubmitted={auth.isAuthenticated ? onSubmitted : undefined}
          initialSelections={picked ?? dates.presetSelections}
          datesFilled={picked ? picked.length > 0 : Boolean(dates.stay)}
          onSeeDates={openDates}
          itemName={item.name}
          itemMeta={itemMeta(item.business?.name, listing.offers_daily === false ? 0 : toNumber(listing.base_price_per_day), toNumber(listing.base_price_per_hour), item.currency || 'XAF', i18n.language, t)}
          imageUrl={image?.display_url || image?.image_url || null}
          dateLine={picked ? picker.dateLine : dates.dateLine}
          onEditDates={openDates}
          onServerRuleError={picker.reopenWithError}
          cardSendDisabled={unfit}
          blockedReason={unfit ? t('rentals.cardWindow.sendReason', cardWindowSendReason(i18n.language)) : undefined}
          notice={
            unfit ? (
              <CardWindowNotice
                tone="warn"
                body={cardWindowWarning(cutoff, i18n.language)}
                action={i18n.language.startsWith('fr') ? 'Modifier les dates' : 'Change dates'}
                onAction={openDates}
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>
      {picker.model ? (
        <RentalDayHoursSheet
          visible={picker.open}
          listing={picker.model}
          currency={item.currency || 'XAF'}
          language={i18n.language}
          timeZone={zone}
          city={listing.business_location?.address?.city}
          initialDays={picker.initialDays}
          onClose={picker.close}
          serverError={picker.serverError}
          onContinue={picker.onContinue}
        />
      ) : null}
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
  if (daily <= 0) return [businessName, fromHourlyPrice(hourly, currency, pickerLang(language))].filter(Boolean).join(' · ');
  const amount = formatRequestAmount(daily, currency, language);
  return [businessName, withRateUnit(amount, t('rentals.searchFirst.perDay', '/ day'))].filter(Boolean).join(' · ');
}

function selectionEndIso(rows: Array<{ startMs: number; endMs: number; billing?: string; calendarDate?: string }>): string | null {
  if (!rows.length) return null;
  const ends = rows.map((row) => Date.parse(requestWindowIso(row as never).end));
  const latest = Math.max(...ends);
  return Number.isFinite(latest) ? new Date(latest).toISOString() : null;
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
