import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getClientBookings, getClientRequests } from '../services/rentalsApi';
import storage from '../services/storage/StorageService';
import type { ClientRentalBookingRow, ClientRentalRequestRow } from '../types/rentals';
import {
  trackMyRentalsEntryTap,
  trackNextRentalCardImpression,
} from '../utils/rentals/myRentalsEntryAnalytics';
import { presentSearchFirstEntry } from '../utils/rentals/presentSearchFirstEntry';
import {
  bookingDismissVersion,
  claimNextCardImpression,
  consumePendingMyRentals,
  formatMyRentalsBadge,
  formatNextRentalPeriod,
  isNextCardDismissed,
  loadDismissal,
  loadEntryCache,
  myRentalsTodoCount,
  rememberPendingMyRentals,
  resolveMyRentalsHeaderTap,
  rowsAfterFetch,
  saveDismissal,
  saveEntryCache,
  selectNextRental,
  type EntryCache,
  type NextCardDismissal,
} from '../utils/rentals/myRentalsEntry';

type CachedRows = EntryCache<ClientRentalBookingRow, ClientRentalRequestRow>;

type StackNav = { getParent: () => unknown; navigate?: (name: string, params: object) => void };

function openRoot(navigation: StackNav, name: string, params: object) {
  const parent = (navigation.getParent() as StackNav | undefined) ?? navigation;
  parent.navigate?.(name, params);
}

function login(navigation: StackNav) {
  openRoot(navigation, 'GuestTabs', { screen: 'GuestAuth', params: { screen: 'Login' } });
}

async function pullEntryRows(): Promise<CachedRows> {
  const [requests, bookings] = await Promise.all([getClientRequests(), getClientBookings()]);
  return { requests, bookings };
}

function bookingThumb(row: ClientRentalBookingRow): string | null {
  const image = row.rental_location_listing?.rental_item?.rental_item_images?.[0];
  return image?.display_url || image?.image_url || null;
}

function dayLabel(count: number, t: TFunction): string {
  if (count === 1) return t('rentals.searchFirst.oneDay', '1 day');
  return t('rentals.searchFirst.dayCount', '{{count}} days', { count });
}

function statusLabel(status: string, t: TFunction): string {
  if (status === 'active' || status === 'awaiting_return') {
    return t('rentals.phases.inProgress', 'In progress');
  }
  return t('rentals.modify.accepted', 'Accepted');
}

export function useMyRentalsLandingEntry(enabled: boolean, signedIn: boolean) {
  const navigation = useNavigation<StackNav>();
  const [rows, setRows] = useState<CachedRows | null>(null);
  const [dismissal, setDismissal] = useState<NextCardDismissal | null>(null);

  useEffect(() => {
    if (!enabled || !signedIn) return;
    let live = true;
    void loadEntryCache(storage).then((cached) => {
      if (live && cached) setRows((current) => current ?? (cached as CachedRows));
    });
    void loadDismissal(storage).then((saved) => {
      if (live) setDismissal(saved);
    });
    void pullEntryRows()
      .then((next) => {
        if (!live) return;
        setRows(rowsAfterFetch(null, { ok: true, rows: next }));
        void saveEntryCache(storage, next);
      })
      .catch(() => {
        if (live) setRows((previous) => rowsAfterFetch(previous, { ok: false }));
      });
    return () => {
      live = false;
    };
  }, [enabled, signedIn]);

  const todoCount = signedIn && rows ? myRentalsTodoCount(rows.requests, rows.bookings, new Date()) : 0;
  const nextBooking = useMemo(() => pickNext(rows, dismissal, signedIn), [dismissal, rows, signedIn]);

  useEffect(() => {
    if (!nextBooking || !claimNextCardImpression(nextBooking.id)) return;
    trackNextRentalCardImpression();
  }, [nextBooking]);

  const onHeaderPress = useCallback(() => {
    trackMyRentalsEntryTap('header_icon');
    const decision = resolveMyRentalsHeaderTap(signedIn, todoCount);
    if (decision.action === 'sign_in') {
      void rememberPendingMyRentals(storage, 'upcoming');
      login(navigation);
      return;
    }
    openRoot(navigation, 'ClientMyRentals', { segment: decision.segment });
  }, [navigation, signedIn, todoCount]);

  const onOpenNext = useCallback(() => {
    if (!nextBooking) return;
    trackMyRentalsEntryTap('next_card');
    openRoot(navigation, 'RentalBookingDetail', { bookingId: nextBooking.id });
  }, [navigation, nextBooking]);

  const onDismissNext = useCallback(() => {
    if (!nextBooking) return;
    const record = { bookingId: nextBooking.id, version: bookingDismissVersion(nextBooking) };
    setDismissal(record);
    void saveDismissal(storage, record);
  }, [nextBooking]);

  return {
    badge: signedIn ? formatMyRentalsBadge(todoCount) : null,
    todoCount: signedIn ? todoCount : 0,
    nextBooking: enabled ? nextBooking : null,
    onHeaderPress,
    onOpenNext,
    onDismissNext,
  };
}

function pickNext(
  rows: CachedRows | null,
  dismissal: NextCardDismissal | null,
  signedIn: boolean
): ClientRentalBookingRow | null {
  if (!signedIn || !rows) return null;
  const picked = selectNextRental(rows.bookings, new Date());
  if (!picked || isNextCardDismissed(picked, dismissal)) return null;
  return picked;
}

export function useSearchFirstMyRentals(enabled: boolean, signedIn: boolean, hideHeader = false) {
  const { t, i18n } = useTranslation();
  const entry = useMyRentalsLandingEntry(enabled, signedIn);
  if (!enabled) return undefined;
  const next = entry.nextBooking;
  const label = t('rentals.searchFirst.myRentals', 'My rentals');
  return presentSearchFirstEntry(
    {
      label,
      badge: entry.badge,
      accessibilityLabel:
        entry.todoCount > 0
          ? t('rentals.searchFirst.myRentalsCount', 'My rentals, {{count}} to do', { count: entry.todoCount })
          : label,
      onPress: entry.onHeaderPress,
      next: next
        ? {
            name: next.rental_location_listing?.rental_item?.name ?? '',
            period: formatNextRentalPeriod(next.start_at, next.end_at, i18n.language, (count) =>
              dayLabel(count, t)
            ),
            statusLabel: statusLabel(next.status, t),
            imageUrl: bookingThumb(next),
            onOpen: entry.onOpenNext,
            onDismiss: entry.onDismissNext,
          }
        : null,
    },
    hideHeader
  );
}

/** Badge count for the client Rentals tab. Keeps the last rows when a refresh fails. */
export function useMyRentalsTodoCount(enabled: boolean, signedIn: boolean) {
  const [rows, setRows] = useState<CachedRows | null>(null);

  useEffect(() => {
    if (!enabled || !signedIn) return;
    let live = true;
    void loadEntryCache(storage).then((cached) => {
      if (live && cached) setRows((current) => current ?? (cached as CachedRows));
    });
    void pullEntryRows()
      .then((next) => {
        if (!live) return;
        setRows(next);
        void saveEntryCache(storage, next);
      })
      .catch(() => {
        if (live) setRows((previous) => rowsAfterFetch(previous, { ok: false }));
      });
    return () => {
      live = false;
    };
  }, [enabled, signedIn]);

  const todoCount = signedIn && rows ? myRentalsTodoCount(rows.requests, rows.bookings, new Date()) : 0;
  return {
    todoCount: signedIn ? todoCount : 0,
    badge: signedIn ? formatMyRentalsBadge(todoCount) : null,
  };
}

export function useResumePendingMyRentals(active = true) {
  const navigation = useNavigation<StackNav>();
  useEffect(() => {
    if (!active) return;
    let live = true;
    void consumePendingMyRentals(storage).then((segment) => {
      if (!live || !segment) return;
      openRoot(navigation, 'ClientMyRentals', { segment });
    });
    return () => {
      live = false;
    };
  }, [active, navigation]);
}
