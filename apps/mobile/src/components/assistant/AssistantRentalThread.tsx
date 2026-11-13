import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AppText } from '@/components/common/AppText';
import { AssistantEntityCards } from '@/components/assistant/AssistantEntityCards';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/theme/spacing';
import { formatRentalDay } from '@/utils/rentals/rentalRequestFormat';
import type { AssistantRentalChip, AssistantRentalMeta, AssistantResultCard } from '@/utils/assistantResultCards';

const NBSP = '\u00A0';
const EN_DASH = '\u2013';

export function AssistantRentalThread({
  cards,
  rental,
  onOpen,
  onRequest,
  onShift,
  onEditDates,
  onChip,
}: {
  cards: AssistantResultCard[];
  rental?: AssistantRentalMeta;
  onOpen: (card: AssistantResultCard) => void;
  onRequest: (card: AssistantResultCard) => void;
  onShift: (card: AssistantResultCard) => void;
  onEditDates: () => void;
  onChip: (message: string, dates?: { startDate?: string; endDate?: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  const rentalCards = cards.filter((card) => card.rental);
  const buyCards = cards.filter((card) => !card.rental);
  const related = relatedChips(rental?.chips);
  return (
    <View style={styles.wrap}>
      {rental?.dates ? <DateChip label={formatRange(rental.dates, i18n.language)} onEdit={onEditDates} /> : null}
      {rentalCards.map((card) => (
        <RentalCard key={card.id} card={card} onOpen={onOpen} onRequest={onRequest} onShift={onShift} />
      ))}
      {buyCards.length ? <AssistantEntityCards cards={buyCards} onOpen={onOpen} /> : null}
      {rental?.footnote === 'estimate' ? <EstimateNote /> : null}
      {rental?.showAllCount ? <ShowAll count={rental.showAllCount} onChip={onChip} /> : null}
      {related.length ? <AppText role="body" style={styles.title}>{t('assistant.rental.otherRentals', 'Other things you can rent')}</AppText> : null}
      <ChipRow chips={rental?.chips || []} onEditDates={onEditDates} onChip={onChip} />
    </View>
  );
}

function DateChip({ label, onEdit }: { label: string; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onEdit} style={[styles.dateChip, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
      <MaterialCommunityIcons name="calendar" size={18} color={colors.primary.main} />
      <AppText role="bodySmall" color={colors.text.primary}>{label}</AppText>
      <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.text.secondary} />
    </Pressable>
  );
}

function EstimateNote() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return <AppText role="caption" color={colors.text.secondary}>{t('assistant.rental.estimateFootnote', 'Est. price. The business confirms the final price when it accepts your request.')}</AppText>;
}

function ShowAll({ count, onChip }: { count: number; onChip: (message: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = t('assistant.rental.showAll', 'Show all {{count}} results', { count });
  return (
    <Pressable accessibilityRole="button" onPress={() => onChip(label)}>
      <AppText role="bodySmall" color={colors.primary.main}>{label}</AppText>
    </Pressable>
  );
}

function ChipRow({
  chips,
  onEditDates,
  onChip,
}: {
  chips: AssistantRentalChip[];
  onEditDates: () => void;
  onChip: (message: string, dates?: { startDate?: string; endDate?: string }) => void;
}) {
  const { colors } = useTheme();
  if (!chips.length) return null;
  return (
    <View style={styles.chips}>
      {chips.map((chip) => (
        <Pressable key={chip.id} accessibilityRole="button" onPress={() => (chip.action === 'calendar' ? onEditDates() : onChip(chip.message || chip.label, chip))} style={[styles.chip, { borderColor: colors.primary.main, backgroundColor: colors.surface }]}>
          <AppText role="bodySmall" color={colors.primary.main}>{chip.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function RentalCard({
  card,
  onOpen,
  onRequest,
  onShift,
}: {
  card: AssistantResultCard;
  onOpen: (card: AssistantResultCard) => void;
  onRequest: (card: AssistantResultCard) => void;
  onShift: (card: AssistantResultCard) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const rental = card.rental!;
  const booked = rental.availability === 'unavailable' && rental.cta === 'shift';
  const label = booked ? formatShift(rental, i18n.language) : mainLabel(rental, t);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
      <View style={styles.row}>
        {card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={styles.image} accessibilityLabel={card.title} /> : <View style={[styles.image, { backgroundColor: colors.divider }]} />}
        <CardFacts card={card} booked={booked} />
      </View>
      <CardActions booked={booked} label={label} onMain={() => (booked ? onShift(card) : rental.cta === 'sign_in' || rental.cta === 'request' ? onRequest(card) : onOpen(card))} onOpen={() => onOpen(card)} />
    </View>
  );
}

function CardFacts({ card, booked }: { card: AssistantResultCard; booked: boolean }) {
  const { t, i18n } = useTranslation();
  const rental = card.rental!;
  const estimate = !booked && rental.quoteTotal != null && rental.dayCount;
  return (
    <View style={styles.body}>
      <AppText role="body" numberOfLines={2} style={styles.title}>{card.title}</AppText>
      {rental.businessName ? <MetaLine name="storefront-outline" text={rental.businessName} /> : null}
      {rental.city ? <MetaLine name="map-marker-outline" text={rental.city} /> : null}
      <StatusLine booked={booked} availability={rental.availability} label={statusLabel(rental, t, i18n.language)} />
      <PriceLine text={priceLine(rental, i18n.language, booked)} estimate={Boolean(estimate)} />
      {rental.deposit ? <MetaLine name="shield-outline" text={t('assistant.rental.deposit', 'Deposit {{amount}}', { amount: money(rental.deposit, rental.currency) })} /> : null}
    </View>
  );
}

function MetaLine({ name, text }: { name: ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={name} size={14} color={colors.text.secondary} />
      <AppText role="caption" color={colors.text.secondary} numberOfLines={1}>{text}</AppText>
    </View>
  );
}

function StatusLine({ booked, availability, label }: { booked: boolean; availability?: string; label: string }) {
  const { colors } = useTheme();
  const warning = booked || availability === 'no_dates';
  const color = warning ? colors.warning?.main || '#B86E00' : colors.success?.main || '#1B7F4E';
  const name = warning ? 'calendar' : 'check-circle';
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={name} size={14} color={color} />
      <AppText role="caption" color={color}>{label}</AppText>
    </View>
  );
}

function PriceLine({ text, estimate }: { text: string; estimate: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!text) return null;
  return (
    <View style={styles.meta}>
      <AppText role="body" style={styles.buttonText}>{text}</AppText>
      {estimate ? <MaterialCommunityIcons name="information-outline" size={16} color={colors.text.secondary} accessibilityLabel={t('assistant.rental.estimateFootnote', 'Est. price. The business confirms the final price when it accepts your request.')} /> : null}
    </View>
  );
}

function CardActions({ booked, label, onMain, onOpen }: { booked: boolean; label: string; onMain: () => void; onOpen: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onMain} style={[styles.button, booked ? styles.outline : { backgroundColor: colors.primary.main }]}>
        <MaterialCommunityIcons name={booked ? 'calendar' : 'calendar-check'} size={18} color={booked ? colors.primary.main : colors.primary.contrast} />
        <AppText role="bodySmall" color={booked ? colors.primary.main : colors.primary.contrast} style={styles.buttonText}>{label}</AppText>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('assistant.rental.details', 'Listing details')} onPress={onOpen} style={[styles.icon, { borderColor: colors.divider }]}>
        <MaterialCommunityIcons name="information-outline" size={20} color={colors.text.primary} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('assistant.rental.openListing', 'Open listing')} onPress={onOpen} style={[styles.icon, { borderColor: colors.divider }]}>
        <MaterialCommunityIcons name="open-in-new" size={20} color={colors.text.primary} />
      </Pressable>
    </View>
  );
}

function mainLabel(rental: NonNullable<AssistantResultCard['rental']>, t: TFunction) {
  if (rental.cta === 'sign_in') return t('assistant.rental.signIn', 'Sign in to request');
  return t('assistant.rental.request', 'Request rental');
}

function statusLabel(rental: NonNullable<AssistantResultCard['rental']>, t: TFunction, locale: string) {
  if (rental.availability === 'unavailable' && rental.nextAvailableDate) {
    return t('assistant.rental.freeFrom', 'Free from {{date}}', { date: formatRentalDay(rental.nextAvailableDate, locale) });
  }
  if (rental.availability === 'no_dates') return t('assistant.rental.pickDates', 'Pick your dates');
  if (rental.availability === 'own_listing') return t('assistant.rental.ownListing', 'Your listing');
  return t('assistant.rental.available', 'Available');
}

function priceLine(rental: NonNullable<AssistantResultCard['rental']>, locale: string, booked: boolean) {
  if (!booked && rental.quoteTotal != null && rental.dayCount) {
    const prefix = locale.startsWith('fr') ? 'Env.' : 'Est.';
    const unit = rental.dayCount === 1 ? (locale.startsWith('fr') ? 'jour' : 'day') : locale.startsWith('fr') ? 'jours' : 'days';
    return `${prefix} ${money(rental.quoteTotal, rental.currency)} · ${rental.dayCount} ${unit}`;
  }
  return rental.perDay != null ? `${money(rental.perDay, rental.currency)}/${locale.startsWith('fr') ? 'jour' : 'day'}` : '';
}

function formatShift(rental: NonNullable<AssistantResultCard['rental']>, locale: string) {
  if (!rental.shiftStart || !rental.shiftEnd) return '';
  return `${formatRentalDay(rental.shiftStart, locale)} ${EN_DASH} ${formatRentalDay(rental.shiftEnd, locale)}`;
}

function formatRange(dates: { startDate: string; endDate: string; dayCount: number }, locale: string) {
  const unit = dates.dayCount === 1 ? (locale.startsWith('fr') ? 'jour' : 'day') : locale.startsWith('fr') ? 'jours' : 'days';
  return `${formatRentalDay(dates.startDate, locale)} → ${formatRentalDay(dates.endDate, locale)} · ${dates.dayCount} ${unit}`;
}

function money(amount: number, currency?: string) {
  const groups = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const code = currency === 'XAF' || currency === 'XOF' || !currency ? 'FCFA' : currency;
  return `${groups}${NBSP}${code}`;
}

function relatedChips(chips?: AssistantRentalChip[]) {
  return (chips || []).filter((chip) => chip.action === 'category' && chip.id !== 'similar');
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
  card: { borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  image: { width: 64, height: 64, borderRadius: 12 },
  body: { flex: 1, gap: 2 },
  title: { fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: spacing.sm },
  outline: { borderWidth: 1, borderColor: '#0A4FB5', backgroundColor: 'transparent' },
  buttonText: { fontWeight: '700' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center' },
  dateChip: { minHeight: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
});
