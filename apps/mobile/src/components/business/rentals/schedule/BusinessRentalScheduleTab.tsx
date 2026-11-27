import React, { useCallback, useMemo } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { EmptyState } from '../../../common/EmptyState';
import { ErrorState } from '../../../common/ErrorState';
import { RentalScheduleEmptyIllustration } from '../../../illustrations/RentalScheduleEmptyIllustration';
import { useTheme } from '../../../../contexts/ThemeContext';
import {
  ALL_SCHEDULE_ITEMS,
  useBusinessRentalSchedule,
  type ScheduleItemOption,
} from '../../../../hooks/useBusinessRentalSchedule';
import type { BusinessRentalScheduleRow } from '../../../../types/rentals';
import {
  groupScheduleRows,
  type ScheduleSectionKey,
} from '../../../../utils/rentals/businessSchedule';
import { BusinessRentalScheduleCard } from './BusinessRentalScheduleCard';
import { BusinessRentalScheduleSkeleton } from './BusinessRentalScheduleSkeleton';
import { RentalItemFilterChips } from './RentalItemFilterChips';

export interface BusinessRentalScheduleTabProps {
  items: ScheduleItemOption[];
  contentBottomPadding: number;
  onOpenBooking: (bookingId: string) => void;
}

const SECTION_COPY: Record<ScheduleSectionKey, [string, string]> = {
  today: ['business.rentals.schedule.sections.today', 'Today'],
  upcoming: ['business.rentals.schedule.sections.upcoming', 'Upcoming'],
  past: ['business.rentals.schedule.sections.past', 'Past'],
};

function SectionHeader({ sectionKey, count }: { sectionKey: ScheduleSectionKey; count: number }) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const [key, fallback] = SECTION_COPY[sectionKey];
  return (
    <View style={[styles.sectionHeader, { paddingTop: spacing.xs, paddingBottom: spacing.xs }]}>
      <Text accessibilityRole="header" style={[typography.subtitle2, { color: colors.text.primary }]}>
        {t(key, fallback)}
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>{count}</Text>
    </View>
  );
}

function ScheduleEmpty({ items, selectedId, onShowAll }: { items: ScheduleItemOption[]; selectedId: string; onShowAll: () => void }) {
  const { t } = useTranslation();
  const selected = items.find((item) => item.id === selectedId);
  const illustration = (
    <RentalScheduleEmptyIllustration
      accessibilityLabel={t('business.rentals.schedule.emptyIllustrationA11y', 'Empty calendar')}
    />
  );
  if (items.length === 0) {
    return (
      <EmptyState
        illustration={illustration}
        title={t('business.rentals.schedule.noItemsTitle', 'No rental items yet')}
        body={t('business.rentals.schedule.noItemsBody', 'Add a rental in your catalog to start receiving bookings.')}
      />
    );
  }
  return (
    <EmptyState
      illustration={illustration}
      title={t('business.rentals.schedule.emptyTitle', 'Nothing scheduled')}
      body={
        selected
          ? t('business.rentals.schedule.emptyItemBody', 'No upcoming bookings for {{item}}.', { item: selected.name })
          : t('business.rentals.schedule.emptyBody', 'Confirmed bookings appear here with their date, time and price.')
      }
      actionLabel={selected ? t('business.rentals.schedule.showAll', 'Show all items') : undefined}
      onAction={selected ? onShowAll : undefined}
    />
  );
}

export function BusinessRentalScheduleTab({ items, contentBottomPadding, onOpenBooking }: BusinessRentalScheduleTabProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { rows, selectedId, setSelectedId, loading, refreshing, error, refresh } = useBusinessRentalSchedule(items);
  const sections = useMemo(() => groupScheduleRows(rows, Date.now()), [rows]);
  const showAll = useCallback(() => setSelectedId(ALL_SCHEDULE_ITEMS), [setSelectedId]);
  const showItemName = selectedId === ALL_SCHEDULE_ITEMS && items.length > 1;

  const renderItem = useCallback(
    ({ item }: { item: BusinessRentalScheduleRow }) => (
      <BusinessRentalScheduleCard row={item} showItemName={showItemName} onPress={onOpenBooking} />
    ),
    [onOpenBooking, showItemName]
  );

  let emptyComponent: React.ReactElement;
  if (loading) emptyComponent = <BusinessRentalScheduleSkeleton />;
  else if (error) {
    emptyComponent = (
      <ErrorState
        title={error}
        actionLabel={t('common.retry', 'Retry')}
        onRetry={() => void refresh()}
      />
    );
  } else emptyComponent = <ScheduleEmpty items={items} selectedId={selectedId} onShowAll={showAll} />;

  return (
    <SectionList
      sections={sections}
      keyExtractor={(row) => row.id}
      renderItem={renderItem}
      renderSectionHeader={({ section }) => <SectionHeader sectionKey={section.key} count={section.data.length} />}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: contentBottomPadding }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          colors={[colors.primary.main]}
          tintColor={colors.primary.main}
        />
      }
      ListHeaderComponent={<RentalItemFilterChips items={items} selectedId={selectedId} onSelect={setSelectedId} />}
      ListEmptyComponent={emptyComponent}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
