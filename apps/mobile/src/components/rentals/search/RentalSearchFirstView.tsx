import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../../contexts/ThemeContext';
import { rentalCategoryIcon } from '../../../utils/rentals/rentalCategoryIcon';
import { formatRangeDates, type RentalDateRange } from '../../../utils/rentals/rentalSearchDates';
import { RentalSearchDateSheet } from './RentalSearchDateSheet';
import { RentalSearchResultCard, type RentalSearchCardModel } from './RentalSearchResultCard';

export type RentalSearchMode = 'landing' | 'typing' | 'results' | 'browse';

export interface RentalSearchCategory {
  id: string;
  name: string;
}

export interface RentalSearchSuggestionRow {
  kind: 'category' | 'listing';
  id: string;
  label: string;
  subtitle: string | null;
}

export interface RentalSearchFirstViewProps {
  marketLabel: string;
  mode: RentalSearchMode;
  query: string;
  dates: RentalDateRange | null;
  draftDates: RentalDateRange | null;
  dateSheetOpen: boolean;
  categories: RentalSearchCategory[];
  moreCategories: RentalSearchCategory[];
  moreOpen: boolean;
  suggestions: RentalSearchSuggestionRow[];
  recent: string[];
  cards: RentalSearchCardModel[];
  activeCategoryId: string | null;
  takeHome: boolean;
  sortLabel: string;
  datesSkipped: boolean;
  onCycleSort: () => void;
  loading: boolean;
  notifyState: 'idle' | 'saving' | 'saved';
  onQueryChange: (value: string) => void;
  onFocusQuery: () => void;
  onSubmitQuery: () => void;
  onBack: () => void;
  onOpenDates: () => void;
  onSkipDates: () => void;
  onDraftDates: (range: RentalDateRange) => void;
  onApplyDates: () => void;
  onCloseDates: () => void;
  onCategory: (id: string) => void;
  onMore: () => void;
  onBrowseAll: () => void;
  onSuggestion: (row: RentalSearchSuggestionRow) => void;
  onRecent: (term: string) => void;
  onRent: (id: string) => void;
  onSeeDates: (id: string) => void;
  onToggleTakeHome: () => void;
  onToggleCheapest: () => void;
  onNearby: (range: RentalDateRange) => void;
  nearby: RentalDateRange[];
  similar: RentalSearchCategory[];
  onNotify: () => void;
  bottomInset: number;
}

export function RentalSearchFirstView(props: RentalSearchFirstViewProps) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const title =
    props.mode === 'results'
      ? t('rentals.searchFirst.results', 'Results')
      : props.mode === 'browse'
        ? t('rentals.searchFirst.browseAll', 'Browse all')
        : props.mode === 'typing'
          ? t('rentals.searchFirst.search', 'Search')
          : t('rentals.browseTitle', 'Rentals');
  const showDates = props.dates
    ? `${formatRangeDates(props.dates, i18n.language)} · ${t('rentals.searchFirst.dayCount', '{{count}} days', { count: props.dates.dayCount })}`
    : null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }} testID={`rental-search-${props.mode}`}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: props.bottomInset + spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          {props.mode === 'landing' ? <View style={styles.backSpacer} /> : (
            <Pressable onPress={props.onBack} accessibilityRole="button" testID="rental-search-back">
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
            </Pressable>
          )}
          <Text variant="titleLarge" style={{ color: colors.text.primary, fontWeight: '700' }}>{title}</Text>
          <View style={styles.backSpacer} />
        </View>
        {props.mode === 'landing' ? (
          <Text style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>{props.marketLabel}</Text>
        ) : null}
        <View style={[styles.search, { borderColor: props.mode === 'typing' ? colors.primary.main : colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.lg }]}>
          <MaterialCommunityIcons name="magnify" size={22} color={colors.text.secondary} />
          <TextInput
            testID="rental-search-input"
            value={props.query}
            onChangeText={props.onQueryChange}
            onFocus={props.onFocusQuery}
            onSubmitEditing={props.onSubmitQuery}
            placeholder={
              props.mode === 'browse'
                ? t('rentals.searchFirst.searchInAll', 'Search in all rentals...')
                : t('rentals.searchFirst.searchPlaceholder', 'Search cameras, tools, sound...')
            }
            placeholderTextColor={colors.text.secondary}
            style={[styles.input, { color: colors.text.primary }]}
            returnKeyType="search"
          />
          {props.query ? (
            <Pressable onPress={() => props.onQueryChange('')} accessibilityLabel={t('common.clear', 'Clear')}>
              <MaterialCommunityIcons name="close" size={18} color={colors.text.secondary} />
            </Pressable>
          ) : null}
        </View>
        <DateRow {...props} label={showDates} />
        {props.mode === 'typing' ? <Typing {...props} /> : null}
        {props.mode === 'landing' ? <Landing {...props} /> : null}
        {props.mode === 'browse' || props.mode === 'results' ? <Filters {...props} /> : null}
        {props.mode === 'results' || props.mode === 'browse' ? <ResultList {...props} /> : null}
      </ScrollView>
      <RentalSearchDateSheet
        visible={props.dateSheetOpen}
        value={props.draftDates}
        onChange={props.onDraftDates}
        onApply={props.onApplyDates}
        onClose={props.onCloseDates}
      />
    </View>
  );
}

function DateRow({ dates, mode, datesSkipped, onOpenDates, onSkipDates, label }: RentalSearchFirstViewProps & { label: string | null }) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const optional = datesSkipped || (mode === 'browse' && !dates);
  const showSkip = mode === 'landing' && !dates && !datesSkipped;
  return (
    <View style={[styles.dateRow, { borderColor: colors.primary.main, backgroundColor: colors.primary.main + '12', borderRadius: borderRadius.lg, marginTop: spacing.sm }]}>
      <MaterialCommunityIcons name="calendar" size={22} color={colors.primary.main} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text.secondary, fontSize: 11, fontWeight: '700' }}>
          {dates
            ? t('rentals.searchFirst.yourDates', 'YOUR DATES')
            : optional
              ? t('rentals.searchFirst.datesOptional', 'DATES (OPTIONAL)')
              : t('rentals.searchFirst.whenNeed', 'WHEN DO YOU NEED IT?')}
        </Text>
        <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
          {label ?? (optional
            ? t('rentals.searchFirst.addToSee', "Add to see what's free")
            : t('rentals.searchFirst.addDates', 'Add start & end dates'))}
        </Text>
      </View>
      {showSkip ? (
        <Pressable onPress={onSkipDates} testID="rental-search-skip-dates">
          <Text style={{ color: colors.primary.main, fontWeight: '700' }}>{t('rentals.searchFirst.skip', 'Skip')}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onOpenDates} testID="rental-search-edit-dates">
          <Text style={{ color: colors.primary.main, fontWeight: '700' }}>
            {dates ? t('rentals.searchFirst.edit', 'Edit') : t('rentals.searchFirst.add', 'Add')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Landing(props: RentalSearchFirstViewProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View>
      <Text style={[styles.section, { color: colors.text.secondary, marginTop: spacing.md }]}>
        {t('rentals.searchFirst.categories', 'CATEGORIES')}
      </Text>
      <CategoryRow {...props} />
      <View style={styles.browseRow}>
        <Pressable onPress={props.onBrowseAll} testID="rental-search-browse-all">
          <Text style={{ color: colors.primary.main, fontWeight: '700' }}>
            {t('rentals.searchFirst.browseAll', 'Browse all')} →
          </Text>
        </Pressable>
      </View>
      <View style={[styles.tip, { backgroundColor: colors.primary.main + '14' }]}>
        <Text style={{ color: colors.text.primary }}>
          {t(
            'rentals.searchFirst.tip',
            "Tip: add dates to see what's free for your trip. You can skip and filter later."
          )}
        </Text>
      </View>
      <View style={styles.landingEmpty}>
        <MaterialCommunityIcons name="magnify" size={42} color={colors.text.disabled} />
        <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 8 }}>
          {t('rentals.searchFirst.emptyLanding', 'Search or pick a category')}
        </Text>
        <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {t('rentals.searchFirst.noFeed', 'No scrolling feed on landing')}
        </Text>
      </View>
    </View>
  );
}

function CategoryRow({ categories, moreCategories, moreOpen, activeCategoryId, onCategory, onMore }: RentalSearchFirstViewProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const shown = moreOpen ? [...categories, ...moreCategories] : categories;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
      {shown.map((category) => {
        const active = category.id === activeCategoryId;
        return (
          <Pressable key={category.id} onPress={() => onCategory(category.id)} testID={`rental-search-category-${category.id}`} style={styles.iconItem}>
            <View style={[styles.iconBubble, { backgroundColor: active ? colors.primary.main : colors.surface, borderColor: colors.divider }]}>
              <MaterialCommunityIcons name={rentalCategoryIcon(category.name)} size={22} color={active ? colors.primary.contrast : colors.text.primary} />
            </View>
            <Text numberOfLines={1} style={{ color: colors.text.primary, fontSize: 12 }}>{category.name}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={onMore} testID="rental-search-more" style={styles.iconItem}>
        <View style={[styles.iconBubble, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={colors.text.primary} />
        </View>
        <Text style={{ color: colors.text.primary, fontSize: 12 }}>{t('rentals.searchFirst.more', 'More')}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Typing({ suggestions, recent, onSuggestion, onRecent }: RentalSearchFirstViewProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  return (
    <View>
      <Text style={[styles.section, { color: colors.text.secondary }]}>{t('rentals.searchFirst.suggestions', 'SUGGESTIONS')}</Text>
      {suggestions.map((row) => (
        <Pressable key={`${row.kind}-${row.id}`} onPress={() => onSuggestion(row)} testID={`rental-search-suggestion-${row.id}`} style={[styles.suggest, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: borderRadius.md }]}>
          <MaterialCommunityIcons name={row.kind === 'category' ? rentalCategoryIcon(row.label) : 'magnify'} size={18} color={colors.text.secondary} />
          <View>
            <Text style={{ color: colors.text.primary, fontWeight: '600' }}>{row.label}</Text>
            {row.subtitle ? <Text style={{ color: colors.text.secondary }}>{row.subtitle}</Text> : null}
          </View>
        </Pressable>
      ))}
      <Text style={[styles.section, { color: colors.text.secondary }]}>{t('rentals.searchFirst.recent', 'RECENT')}</Text>
      {recent.map((term, index) => (
        <Pressable key={`${term}-${index}`} onPress={() => onRecent(term)} testID={`rental-search-recent-${index}`} style={[styles.suggest, { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: borderRadius.md }]}>
          <MaterialCommunityIcons name="clock-outline" size={18} color={colors.text.secondary} />
          <Text style={{ color: colors.text.primary }}>{term}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Filters(props: RentalSearchFirstViewProps) {
  const { t } = useTranslation();
  const activeName = [...props.categories, ...props.moreCategories].find((row) => row.id === props.activeCategoryId)?.name;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {activeName ? (
        <Chip label={activeName} active onPress={() => props.onCategory(props.activeCategoryId ?? '')} />
      ) : null}
      <Chip label={t('rentals.searchFirst.price', 'Price')} active={props.sortLabel === 'cheapest'} onPress={props.onToggleCheapest} />
      <Chip label={props.sortLabel === 'relevance' ? t('rentals.searchFirst.sort', 'Sort') : props.sortLabel} active={props.sortLabel !== 'relevance'} onPress={props.onCycleSort} />
      <Chip label={t('rentals.searchFirst.takeHome', 'Take-home')} active={props.takeHome} onPress={props.onToggleTakeHome} />
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { borderColor: active ? colors.primary.main : colors.divider, backgroundColor: active ? colors.primary.main : colors.surface }]}>
      <Text style={{ color: active ? colors.primary.contrast : colors.text.primary }}>{label}</Text>
    </Pressable>
  );
}

function ResultList(props: RentalSearchFirstViewProps) {
  const { t, i18n } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  if (props.loading) {
    return <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>{t('common.loading', 'Loading...')}</Text>;
  }
  if (props.mode === 'results' && props.cards.length === 0) {
    return (
      <View testID="rental-search-empty">
        <Text variant="titleMedium" style={{ color: colors.text.primary, marginTop: spacing.lg, textAlign: 'center' }}>
          {t('rentals.searchFirst.nothingFree', 'Nothing free for those dates')}
        </Text>
        <Text style={{ color: colors.text.secondary, textAlign: 'center', marginTop: 4 }}>
          {t('rentals.searchFirst.nothingFreeBody', 'No “{{query}}” listings are available {{range}}.', {
            query: props.query,
            range: props.dates ? formatRangeDates(props.dates, i18n.language) : '',
          })}
        </Text>
        <Text style={[styles.section, { color: colors.text.secondary }]}>{t('rentals.searchFirst.tryDates', 'TRY NEARBY DATES')}</Text>
        <View style={styles.chips}>
          {props.nearby.map((range) => (
            <Chip key={`${range.startDate}-${range.endDate}`} label={formatRangeDates(range, i18n.language)} active={false} onPress={() => props.onNearby(range)} />
          ))}
        </View>
        <Text style={[styles.section, { color: colors.text.secondary }]}>{t('rentals.searchFirst.similar', 'SIMILAR CATEGORIES')}</Text>
        <CategoryRow {...props} categories={props.similar} moreCategories={[]} />
        {props.dates ? (
          <View style={[styles.tip, { borderColor: colors.divider, borderWidth: 1, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
              {t('rentals.searchFirst.notifyTitle', "Tell me when it's available")}
            </Text>
            <Text style={{ color: colors.text.secondary, marginVertical: 6 }}>
              {t('rentals.searchFirst.notifyBody', "We'll notify you if a matching rental opens for {{range}}.", {
                range: formatRangeDates(props.dates, i18n.language),
              })}
            </Text>
            <Button mode="contained" buttonColor={colors.primary.main} onPress={props.onNotify} loading={props.notifyState === 'saving'} testID="rental-search-notify">
              {props.notifyState === 'saved'
                ? t('rentals.searchFirst.notified', "You'll be notified once.")
                : t('rentals.searchFirst.notify', 'Notify me')}
            </Button>
          </View>
        ) : null}
      </View>
    );
  }
  const available = props.cards.filter((card) => card.available === true).length;
  return (
    <View>
      {props.mode === 'browse' ? <CategoryRow {...props} /> : null}
      <Text style={{ color: colors.text.secondary, marginVertical: spacing.sm }}>
        {props.dates
          ? t('rentals.searchFirst.matches', '{{count}} matches · available for your dates first', { count: props.cards.length })
          : t('rentals.searchFirst.countOnly', '{{count}} rentals · add dates to sort by availability', { count: props.cards.length })}
      </Text>
      {props.cards.map((card) => (
        <RentalSearchResultCard key={card.id} card={card} onRent={props.onRent} onSeeDates={props.onSeeDates} />
      ))}
      {props.dates && available === 0 && props.cards.length > 0 ? (
        <Button mode="contained" buttonColor={colors.primary.main} onPress={props.onNotify} testID="rental-search-notify" style={{ borderRadius: borderRadius.md }}>
          {t('rentals.searchFirst.notify', 'Notify me')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  backSpacer: { width: 24 },
  search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 12, minHeight: 48, gap: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, gap: 10 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, marginTop: 16, marginBottom: 8 },
  iconRow: { gap: 12, paddingVertical: 4 },
  iconItem: { width: 72, alignItems: 'center', gap: 4 },
  iconBubble: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  browseRow: { marginTop: 12 },
  tip: { marginTop: 16, borderRadius: 12, padding: 12 },
  landingEmpty: { alignItems: 'center', marginTop: 48 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
