import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RentalSlotPicker } from '../../components/rentals/RentalSlotPicker';
import { CardWindowDateSheet } from '../../components/rentals/request/CardWindowDateSheet';
import { CardWindowNotice } from '../../components/rentals/request/CardWindowNotice';
import { RentalSearchDateSheet } from '../../components/rentals/search/RentalSearchDateSheet';
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
  const guardOn = flags.rentals_card_window_guard_enabled;
  const [payingByCard, setPayingByCard] = useState<boolean | null>(null);
  const cardOn = payingByCard ?? listing?.payment_rail === 'stripe';
  const latest = guardOn ? effectiveCardEnd(listing, cardOn) : null;
  const endIso = selectionEndIso(dates.presetSelections);
  const unfit = cardEndMisses(endIso, latest);
  const zone = listing?.timezone || dates.timeZone || 'Africa/Douala';
  const cutoff = latest ? formatCardCutoff(latest, zone, i18n.language) : '';
  const openDates = useCallback(() => {
    if (guardOn) void refetch();
    dates.openDateEditor();
  }, [dates, guardOn, refetch]);
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
          onSeeDates={openDates}
          itemName={item.name}
          itemMeta={itemMeta(item.business?.name, toNumber(listing.base_price_per_day), toNumber(listing.base_price_per_hour), item.currency || 'XAF', i18n.language, t)}
          imageUrl={image?.display_url || image?.image_url || null}
          dateLine={dates.dateLine}
          onEditDates={openDates}
          unavailableLabel={dates.unavailableLabel}
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
      {guardOn ? (
        <CardWindowDateSheet
          visible={dates.editOpen}
          locale={i18n.language}
          timeZone={zone}
          latestIso={latest}
          momoAvailable={listing.momo_available === true && cardOn}
          payingByCard={cardOn}
          pickup={dates.stay?.startDate}
          onClose={() => dates.setEditOpen(false)}
          onPayWithMomo={() => setPayingByCard(false)}
          onApply={(stay) => {
            dates.setEditOpen(false);
            void dates.commitStay(stay);
          }}
        />
      ) : (
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
      )}
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
