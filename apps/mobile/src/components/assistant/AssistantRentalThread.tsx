import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AppText } from '@/components/common/AppText';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/theme/spacing';
import type { AssistantRentalMeta, AssistantResultCard } from '@/utils/assistantResultCards';

const NBSP = '\u00A0';

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
  const { colors } = useTheme();
  const rentalCards = cards.filter((card) => card.rental);
  return (
    <View style={styles.wrap}>
      {rental?.dates ? (
        <Pressable accessibilityRole="button" onPress={onEditDates} style={[styles.chip, { borderColor: colors.divider, backgroundColor: colors.surface }]}>
          <AppText role="bodySmall">{formatRange(rental.dates, i18n.language)}</AppText>
        </Pressable>
      ) : null}
      {rentalCards.map((card) => (
        <RentalCard key={card.id} card={card} onOpen={onOpen} onRequest={onRequest} onShift={onShift} />
      ))}
      {rental?.footnote === 'estimate' ? (
        <AppText role="caption" color={colors.text.secondary}>
          {t('assistant.rental.estimateFootnote', 'Est. price. The business confirms the final price when it accepts your request.')}
        </AppText>
      ) : null}
      {rental?.showAllCount ? (
        <Pressable accessibilityRole="button" onPress={() => onChip(t('assistant.rental.showAll', 'Show all {{count}} results', { count: rental.showAllCount }))}>
          <AppText role="bodySmall" color={colors.primary.main}>
            {t('assistant.rental.showAll', 'Show all {{count}} results', { count: rental.showAllCount })}
          </AppText>
        </Pressable>
      ) : null}
      <View style={styles.chips}>
        {(rental?.chips || []).map((chip) => (
          <Pressable
            key={chip.id}
            accessibilityRole="button"
            onPress={() => (chip.action === 'calendar' ? onEditDates() : onChip(chip.message || chip.label, chip))}
            style={[styles.chip, { borderColor: colors.primary.main, backgroundColor: colors.surface }]}
          >
            <AppText role="bodySmall" color={colors.primary.main}>{chip.label}</AppText>
          </Pressable>
        ))}
      </View>
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
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
      <View style={styles.row}>
        {card.imageUrl ? <Image source={{ uri: card.imageUrl }} style={styles.image} /> : <View style={[styles.image, { backgroundColor: colors.divider }]} />}
        <View style={styles.body}>
          <AppText role="body" numberOfLines={2} style={styles.title}>{card.title}</AppText>
          {rental.businessName ? <AppText role="caption" color={colors.text.secondary}>{rental.businessName}</AppText> : null}
          {rental.city ? <AppText role="caption" color={colors.text.secondary}>{rental.city}</AppText> : null}
          <AppText role="caption" color={booked ? colors.warning?.main || '#B86E00' : colors.success?.main || '#1B7F4E'}>
            {statusLabel(rental, t, i18n.language)}
          </AppText>
          <AppText role="body">{priceLine(rental, i18n.language, booked)}</AppText>
          {rental.deposit ? (
            <AppText role="caption" color={colors.text.secondary}>
              {t('assistant.rental.deposit', 'Deposit {{amount}}', { amount: money(rental.deposit, rental.currency) })}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={booked ? t('assistant.rental.tryDates', 'Try these dates') : t('assistant.rental.request', 'Request rental')}
          onPress={() => (booked ? onShift(card) : rental.cta === 'sign_in' || rental.cta === 'request' ? onRequest(card) : onOpen(card))}
          style={[styles.button, booked ? styles.outline : { backgroundColor: colors.primary.main }]}
        >
          <AppText role="bodySmall" color={booked ? colors.primary.main : colors.primary.contrast} style={styles.buttonText}>
            {booked ? formatShift(rental, i18n.language) : rental.cta === 'sign_in' ? t('assistant.rental.signIn', 'Sign in to request') : t('assistant.rental.request', 'Request rental')}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('assistant.rental.details', 'Listing details')} onPress={() => onOpen(card)} style={styles.icon}>
          <AppText role="bodySmall">i</AppText>
        </Pressable>
      </View>
    </View>
  );
}

function statusLabel(rental: NonNullable<AssistantResultCard['rental']>, t: TFunction, locale: string) {
  if (rental.availability === 'unavailable' && rental.nextAvailableDate) {
    return t('assistant.rental.freeFrom', 'Free from {{date}}', { date: shortDate(rental.nextAvailableDate, locale) });
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
  return `${shortDate(rental.shiftStart, locale)} – ${shortDate(rental.shiftEnd, locale)}`;
}

function formatRange(dates: { startDate: string; endDate: string; dayCount: number }, locale: string) {
  const unit = dates.dayCount === 1 ? (locale.startsWith('fr') ? 'jour' : 'day') : locale.startsWith('fr') ? 'jours' : 'days';
  return `${shortDate(dates.startDate, locale)} → ${shortDate(dates.endDate, locale)} · ${dates.dayCount} ${unit}`;
}

function shortDate(iso: string, locale: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function money(amount: number, currency?: string) {
  const groups = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const code = currency === 'XAF' || currency === 'XOF' || !currency ? 'FCFA' : currency;
  return `${groups}${NBSP}${code}`;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
  card: { borderWidth: 1, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  image: { width: 64, height: 64, borderRadius: 12 },
  body: { flex: 1, gap: 2 },
  title: { fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  outline: { borderWidth: 1, borderColor: '#0A4FB5', backgroundColor: 'transparent' },
  buttonText: { fontWeight: '700' },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center' },
});
