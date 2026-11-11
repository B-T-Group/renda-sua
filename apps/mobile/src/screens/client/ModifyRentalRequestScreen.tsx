import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RentalSlotPicker } from '../../components/rentals/RentalSlotPicker';
import { RentalModifyBlockedSheet } from '../../components/rentals/RentalModifySheets';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalListingDetail } from '../../hooks/useRentalListingDetail';
import type { ClientRootStackParamList } from '../../navigation/types';
import { getClientRequests, modifyRequest } from '../../services/rentalsApi';
import type { ClientRentalRequestRow, RentalSelectionWindow } from '../../types/rentals';
import type { SelectionRange } from '../../utils/rentals';
import { formatRentalPeriod } from '../../utils/rentals/rentalRequestFormat';
import { RequestAppBar } from '../shared/RentalRequestScreen';

type Route = { ModifyRentalRequest: { requestId: string } };

export default function ModifyRentalRequestScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<Route, 'ModifyRentalRequest'>>();
  const [request, setRequest] = useState<ClientRentalRequestRow | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [race, setRace] = useState(false);
  const listingId = request?.rental_location_listing?.id;
  const { listing, bookedWindows, loading } = useRentalListingDetail(listingId);
  const selections = useMemo(() => windowsToSelections(request?.rental_selection_windows), [request]);

  useEffect(() => {
    void getClientRequests().then((rows) => {
      setRequest(rows.find((row) => row.id === route.params.requestId) ?? null);
    });
  }, [route.params.requestId]);

  const onSave = useCallback(
    async (body: {
      rentalLocationListingId: string;
      requestedStartAt: string;
      requestedEndAt: string;
      windows: Array<{ requestedStartAt: string; requestedEndAt: string; billing?: 'all_day'; calendarDate?: string }>;
      unitsRequested: number;
      clientRequestNote?: string;
    }) => {
      if (!request) return;
      try {
        await modifyRequest(request.id, { ...body, expectedVersion: request.edit_version ?? 1 });
        navigation.navigate('ClientMyRentals', { notice: 'updated' });
      } catch (error: unknown) {
        const code = (error as { code?: string }).code;
        if (code === 'RENTAL_REQUEST_ALREADY_ACCEPTED') {
          setRace(true);
          return;
        }
        if (code === 'RENTAL_REQUEST_UNAVAILABLE') {
          setBlocked(t('rentals.modify.unavailable', 'Not available for these dates'));
          return;
        }
        throw error;
      }
    },
    [navigation, request, t]
  );

  const viewRental = useCallback(async () => {
    const rows = await getClientRequests();
    const fresh = rows.find((row) => row.id === route.params.requestId);
    const bookingId = fresh?.rental_booking?.id;
    if (bookingId) navigation.replace('RentalBookingDetail', { bookingId });
    else navigation.navigate('ClientMyRentals');
  }, [navigation, route.params.requestId]);

  if (!request || (loading && !listing)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBackground }}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  const item = listing?.rental_item ?? request.rental_location_listing?.rental_item;
  const dayRate = Number(listing?.base_price_per_day ?? request.rental_location_listing?.base_price_per_day) || 0;
  const previous = Number(request.quoted_total);
  const previousTotal = Number.isFinite(previous) ? previous : dayRate * Math.max(selections.length, 1);
  const dateLine = formatRentalPeriod(request.rental_selection_windows ?? [], i18n.language, (count) =>
    t('rentals.requestForm.dayCount', '{{count}} day', { count })
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <RequestAppBar
        heading={t('rentals.modify.title', 'Modify request')}
        title={item?.name ?? ''}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <RentalSlotPicker
          key={`${request.id}:${request.edit_version ?? 1}`}
          layout="screen"
          submitMode="modify"
          listingId={listing?.id ?? listingId ?? ''}
          isAuthenticated
          bookedWindows={bookedWindows}
          weeklyAvailability={listing?.weekly_availability}
          unitsAvailable={Number(listing?.units_available) || 1}
          basePricePerDay={dayRate}
          basePricePerHour={Number(listing?.base_price_per_hour) || 0}
          currency={item?.currency || 'XAF'}
          initialSelections={selections}
          initialUnits={request.units_requested ?? 1}
          initialNotes={request.client_request_note ?? ''}
          previousTotal={previousTotal}
          datesFilled
          dateLine={dateLine}
          itemName={item?.name}
          itemMeta={itemMeta(request, dayRate, i18n.language, t)}
          requestBlocked={Boolean(blocked)}
          unavailableLabel={blocked ?? undefined}
          onSeeDates={() => setBlocked(null)}
          onModifySave={onSave}
        />
      </KeyboardAvoidingView>
      <RentalModifyBlockedSheet
        visible={race}
        title={t('rentals.modify.raceTitle', "Can't update this request")}
        body={t(
          'rentals.modify.raceBody',
          'The business already accepted this rental. Changes can no longer be made here. Your edits have been discarded.'
        )}
        actionLabel={t('rentals.modify.viewRental', 'View rental')}
        onAction={() => void viewRental()}
      />
    </View>
  );
}

function itemMeta(
  request: ClientRentalRequestRow,
  dayRate: number,
  language: string,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
): string {
  const place = request.rental_location_listing?.business_location?.name ?? '';
  const rate = t('rentals.modify.perDay', '{{amount}} / day', {
    amount: `${dayRate} FCFA`,
  });
  return [place, language.toLowerCase().startsWith('fr') ? rate.replace('/ day', '/ jour') : rate]
    .filter(Boolean)
    .join(' · ');
}

function windowsToSelections(raw: RentalSelectionWindow[] | null | undefined): SelectionRange[] {
  return (raw ?? []).map((row, index) => ({
    id: `saved-${index}`,
    startMs: wallClockMs(row.start_at),
    endMs: wallClockMs(row.end_at),
    billing: row.billing === 'all_day' ? 'all_day' : 'hourly',
    calendarDate: row.calendar_date,
  }));
}

function wallClockMs(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return Date.parse(iso);
  return new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]).getTime();
}
