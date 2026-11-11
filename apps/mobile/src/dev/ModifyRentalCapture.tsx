import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { ClientRentalRequestRow } from '../components/rentals/ClientRentalRequestRow';
import { RentalHubTabs } from '../components/rentals/RentalHubTabs';
import { RentalModifyBlockedSheet, RentalModifyPriceSheet } from '../components/rentals/RentalModifySheets';
import { RentalSlotPicker } from '../components/rentals/RentalSlotPicker';
import { StatusPill } from '../components/common/StatusPill';
import { useTheme } from '../contexts/ThemeContext';
import type { ClientRentalRequestRow as RequestRow, RentalSelectionWindow } from '../types/rentals';
import type { SelectionRange } from '../utils/rentals';
import { defaultWeeklyAvailability } from '../utils/rentals/defaultWeeklyAvailability';
import { formatChangeDetail, formatRentalPeriod } from '../utils/rentals/rentalRequestFormat';
import { RequestAppBar } from '../screens/shared/RentalRequestScreen';

const noop = () => undefined;

const CaptureStack = createNativeStackNavigator();

export function ModifyRentalCaptureApp() {
  return (
    <NavigationContainer>
      <CaptureStack.Navigator screenOptions={{ headerShown: false }}>
        <CaptureStack.Screen name="Capture" component={ModifyRentalCapture} />
      </CaptureStack.Navigator>
    </NavigationContainer>
  );
}

export function ModifyRentalCapture() {
  const scene = readParam('capture') || 'card';
  const lang = readParam('lang') === 'fr' ? 'fr' : 'en';
  useEffect(() => {
    void i18n.changeLanguage(lang);
  }, [lang]);

  return (
    <View style={styles.fill}>
      {scene === 'modify' || scene === 'conflict' || scene === 'confirm' ? (
        <ModifyScene scene={scene} />
      ) : scene === 'race' ? (
        <RaceScene />
      ) : scene === 'business' || scene === 'stale' ? (
        <BusinessScene stale={scene === 'stale'} />
      ) : (
        <CardScene
          updated={scene === 'saved'}
          accepted={scene === 'accepted'}
          closed={scene === 'closed'}
        />
      )}
    </View>
  );
}

function CardScene({ updated, accepted, closed }: { updated: boolean; accepted: boolean; closed: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const row = fixtureRow(updated, accepted);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pageBackground }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.heading}>{t('rentals.hub.title', 'My rentals')}</Text>
      <RentalHubTabs
        value="upcoming"
        onChange={noop}
        tabs={[
          { value: 'action_needed', label: t('rentals.hub.toDo', 'To do'), count: 2 },
          { value: 'upcoming', label: t('rentals.hub.upcoming', 'Upcoming') },
          { value: 'past', label: t('rentals.hub.past', 'Past') },
        ]}
      />
      <View style={{ height: 12 }} />
      <ClientRentalRequestRow
        row={row}
        modifyState={accepted ? 'hidden' : closed ? 'closed' : 'open'}
        onModify={noop}
        onContact={noop}
        onBookRequest={noop}
        onCancel={noop}
        onViewListing={noop}
        onViewBooking={noop}
      />
    </ScrollView>
  );
}

function ModifyScene({ scene }: { scene: string }) {
  const { t, i18n: i18 } = useTranslation();
  const { colors } = useTheme();
  const saved = [day('2026-11-15'), day('2026-11-16')];
  const draft = scene === 'conflict'
    ? [day('2026-11-20'), day('2026-11-21')]
    : [...saved, day('2026-11-17')];
  const dateLine = formatRentalPeriod(periodWindows(saved), i18.language, (count) =>
    t('rentals.requestForm.dayCount', '{{count}} day', { count })
  );
  return (
    <View style={[styles.fill, { backgroundColor: colors.pageBackground }]}>
      <RequestAppBar heading={t('rentals.modify.title', 'Modify request')} title="Echafaudage roulant 4 m (DEV demo)" onBack={noop} />
      <RentalSlotPicker
        layout="screen"
        submitMode="modify"
        listingId="55c1b524-0460-492a-8de8-cc3efae191a6"
        isAuthenticated
        bookedWindows={[]}
        weeklyAvailability={openWeek()}
        unitsAvailable={1}
        basePricePerDay={380}
        basePricePerHour={40}
        currency="XAF"
        initialSelections={draft}
        savedSelections={saved}
        initialUnits={1}
        initialNotes="For a site in Bastos."
        previousTotal={760}
        datesFilled
        dateLine={dateLine}
        itemName="Echafaudage roulant 4 m"
        itemMeta={i18.language.startsWith('fr') ? 'DEV demo · 380 FCFA / jour' : 'DEV demo · 380 FCFA / day'}
        requestBlocked={scene === 'conflict'}
        unavailableLabel={scene === 'conflict' ? t('rentals.modify.unavailable', 'Not available for these dates') : undefined}
        onSeeDates={scene === 'conflict' ? noop : undefined}
        onModifySave={async () => undefined}
      />
      <RentalModifyPriceSheet
        visible={scene === 'confirm'}
        title={t('rentals.modify.confirmTitle', 'Update your request?')}
        body={t('rentals.modify.confirmBody', 'The quoted total went up. The business will see these changes before accepting.')}
        rows={[
          { label: t('rentals.modify.dates', 'Dates'), from: '15–17 Nov', to: '15–18 Nov' },
          { label: t('rentals.modify.duration', 'Duration'), from: '2 days', to: '3 days' },
          { label: t('rentals.requestForm.total', 'Total'), from: '760 FCFA', to: '1 140 FCFA' },
        ]}
        saveLabel={t('rentals.modify.save', 'Save changes')}
        keepLabel={t('rentals.modify.keep', 'Keep current')}
        onSave={noop}
        onKeep={noop}
      />
    </View>
  );
}

function RaceScene() {
  const { t } = useTranslation();
  return (
    <View style={styles.fill}>
      <ModifyScene scene="modify" />
      <RentalModifyBlockedSheet
        visible
        title={t('rentals.modify.raceTitle', "Can't update this request")}
        body={t('rentals.modify.raceBody', 'The business already accepted this rental. Changes can no longer be made here. Your edits have been discarded.')}
        actionLabel={t('rentals.modify.viewRental', 'View rental')}
        onAction={noop}
      />
    </View>
  );
}

function BusinessScene({ stale }: { stale: boolean }) {
  const { t, i18n: i18 } = useTranslation();
  const { colors } = useTheme();
  const detail = formatChangeDetail({
    fields: ['dates'],
    dates: { from: periodWindows([day('2026-11-15'), day('2026-11-16')]), to: periodWindows([day('2026-11-15'), day('2026-11-16'), day('2026-11-17')]) },
  }, i18.language);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pageBackground }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.heading}>{t('rentals.modify.incoming', 'Incoming request')}</Text>
      {stale ? (
        <View style={[styles.banner, { backgroundColor: colors.primary.main + '14' }]}>
          <Text style={{ color: colors.primary.dark }}>{t('rentals.modify.staleBanner', 'This request was updated. Review the latest version.')}</Text>
        </View>
      ) : (
        <View style={[styles.banner, { backgroundColor: '#E8F6F3' }]}>
          <Text>{t('rentals.modify.reviewBanner', 'The renter updated this request. Review the changes before accepting.')}</Text>
        </View>
      )}
      <View style={[styles.card, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
        <View style={styles.row}>
          <StatusPill label={t('rentals.modify.requested', 'Requested')} backgroundColor="#FEF3C7" textColor="#92400E" borderColor="#FCD34D" compact />
          <StatusPill label={t('rentals.modify.updated', 'Updated')} backgroundColor={colors.primary.main + '18'} textColor={colors.primary.main} borderColor={colors.primary.main + '44'} compact />
        </View>
        <Text style={styles.item}>Echafaudage roulant 4 m</Text>
        <Text style={{ color: colors.primary.dark, marginTop: 8 }}>{t('rentals.modify.changed', 'Changed: {{detail}}', { detail })}</Text>
        <Text style={{ marginTop: 8, fontWeight: '700' }}>15–18 Nov · 3 days</Text>
        <Text>1 × · 1 140 FCFA</Text>
        <View style={[styles.row, { marginTop: 12 }]}>
          <Button mode="outlined" textColor={colors.error.main}>{t('rentals.actions.decline', 'Decline')}</Button>
          <Button mode="contained" buttonColor="#15803D">{t('rentals.actions.accept', 'Accept')}</Button>
        </View>
      </View>
    </ScrollView>
  );
}

function fixtureRow(updated: boolean, accepted: boolean): RequestRow {
  const twoDays = [day('2026-11-15'), day('2026-11-16')];
  const threeDays = [...twoDays, day('2026-11-17')];
  const windows = periodWindows(updated ? threeDays : twoDays);
  return {
    id: 'request-1',
    status: accepted ? 'available' : 'pending',
    created_at: '2026-11-11T00:00:00.000Z',
    rental_selection_windows: windows,
    units_requested: 1,
    edit_version: updated ? 2 : 1,
    quoted_total: updated ? 1140 : 760,
    change_summary: updated ? { fields: ['dates'] } : null,
    client_request_note: 'For a site in Bastos.',
    rental_location_listing: {
      id: '55c1b524-0460-492a-8de8-cc3efae191a6',
      base_price_per_hour: 40,
      base_price_per_day: 380,
      business_location: { name: 'DEV demo', address: { city: 'Yaoundé' } },
      rental_item: { name: 'Echafaudage roulant 4 m', currency: 'XAF', business: { name: 'Blue' } },
    },
    rental_booking: accepted ? { id: 'booking-1', status: 'proposed' } : null,
  };
}

function day(date: string): SelectionRange {
  const [year, month, dayNum] = date.split('-').map(Number);
  return {
    id: date,
    startMs: new Date(year, month - 1, dayNum, 0, 0).getTime(),
    endMs: new Date(year, month - 1, dayNum + 1, 0, 0).getTime(),
    billing: 'all_day',
    calendarDate: date,
  };
}

function periodWindows(rows: SelectionRange[]): RentalSelectionWindow[] {
  return rows.map((row) => ({
    billing: 'all_day',
    calendar_date: row.calendarDate,
    start_at: `${row.calendarDate}T00:00:00.000Z`,
    end_at: `${row.calendarDate}T00:00:00.000Z`,
  }));
}

function openWeek() {
  return defaultWeeklyAvailability().map((row) => ({
    ...row,
    is_available: true,
    start_time: '00:00:00',
    end_time: '23:59:00',
  }));
}

function readParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  heading: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  banner: { borderRadius: 12, padding: 12, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { fontSize: 16, fontWeight: '800', marginTop: 10 },
});
