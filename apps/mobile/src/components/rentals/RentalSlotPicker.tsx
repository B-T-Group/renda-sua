import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCreateRentalRequest } from '../../hooks/useCreateRentalRequest';
import { trackSiteEvent } from '../../services/analytics/AppEventsService';
import { consumeRentalRequestAttribution } from '../../utils/rentalAssistantAttribution';
import type { ClientRootStackParamList, GuestRootStackParamList } from '../../navigation/types';
import type { RentalTakenWindow } from '../../types/rentals';
import { RentalRequestScreenForm } from './request/RentalRequestScreenForm';
import { cardWindowErrorMessage } from '../../utils/rentals/cardWindow';
import { submitRuleText } from '../../utils/rentals/dayHoursCopy';
import { CardWindowNotice } from './request/CardWindowNotice';
import {
  estimateTotalFromSelectionRanges,
  localPickerInstantToRequestParts,
  remainingUnitsInRange,
  requestedSlotUtcIso,
  totalBillableHours,
  type SelectionRange,
} from '../../utils/rentals';
import {
  formatRentalPeriod,
  formatRequestAmount,
  modifySaveNeedsConfirm,
  readPriceConfirmQuote,
  type PriceConfirmQuote,
  rentalSelectionFingerprint,
  requestPriceCopy,
  requestSelectionLabel,
} from '../../utils/rentals/rentalRequestFormat';
import { RentalModifyPriceSheet } from './RentalModifySheets';

function openedDayCount(rows: SelectionRange[]): number {
  const allDay = rows.filter((row) => row.billing === 'all_day').length;
  return allDay || rows.length;
}

function selectionPeriodWindows(rows: SelectionRange[]) {
  return rows.map((row) => {
    const start = localPickerInstantToRequestParts(row.startMs);
    const end = localPickerInstantToRequestParts(row.endMs);
    return {
      billing: row.billing,
      calendar_date: row.calendarDate,
      start_at: requestedSlotUtcIso(start.dateKey, start.hour, start.minute),
      end_at: requestedSlotUtcIso(end.dateKey, end.hour, end.minute),
    };
  });
}

export interface RentalSlotPickerProps {
  listingId: string;
  isAuthenticated: boolean;
  bookedWindows: RentalTakenWindow[];
  minRentalHours?: number;
  maxRentalHours?: number | null;
  unitsAvailable?: number;
  basePricePerHour?: number;
  basePricePerDay?: number;
  currency?: string;
  onLoginRequired?: () => void;
  onSubmitted?: (requestId: string) => void;
  /** Dates chosen in search. Shown as all-day rows and submitted at the daily rate. */
  initialSelections?: SelectionRange[];
  /** Search dates are already on the sheet, so the empty-state prompt stays hidden. */
  datesFilled?: boolean;
  /** The chosen dates are booked. The request cannot be submitted. */
  requestBlocked?: boolean;
  /** A date edit is still asking the server, so the request stays disabled. */
  requestBusy?: boolean;
  onSeeDates?: () => void;
  itemName?: string;
  itemMeta?: string;
  imageUrl?: string | null;
  dateLine?: string;
  onEditDates?: () => void;
  /** Day-and-hours picker: the server refused the request; reopen the picker showing this text. */
  onServerRuleError?: (text: string) => void;
  unavailableLabel?: string;
  notice?: ReactNode;
  blockedReason?: string;
  cardSendDisabled?: boolean;
  /** Renter edit of a Requested rental. Save stays disabled until something changes. */
  submitMode?: 'create' | 'modify';
  initialUnits?: number;
  initialNotes?: string;
  previousTotal?: number;
  /** Selections the request was opened with, when the draft already differs. */
  savedSelections?: SelectionRange[];
  onModifySave?: (body: {
    rentalLocationListingId: string;
    requestedStartAt: string;
    requestedEndAt: string;
    windows: Array<{
      requestedStartAt: string;
      requestedEndAt: string;
      billing?: 'all_day';
      calendarDate?: string;
    }>;
    unitsRequested: number;
    clientRequestNote?: string;
    confirmedTotal?: { amount: number; currency: string };
  }) => Promise<void>;
}

/**
 * Rental request form (create and modify). Days and hours are chosen in the day-and-hours
 * sheet the screen owns; this form shows them, units, notes, price and sends the request.
 */
export function RentalSlotPicker({
  listingId,
  isAuthenticated,
  bookedWindows,
  minRentalHours = 1,
  maxRentalHours = null,
  unitsAvailable = 1,
  basePricePerHour = 0,
  basePricePerDay = 0,
  currency = 'XAF',
  onLoginRequired,
  onSubmitted,
  initialSelections = [],
  datesFilled = false,
  requestBlocked = false,
  requestBusy = false,
  onSeeDates,
  itemName,
  itemMeta,
  imageUrl,
  dateLine,
  onEditDates,
  onServerRuleError,
  unavailableLabel,
  notice,
  blockedReason,
  cardSendDisabled = false,
  submitMode = 'create',
  initialUnits = 1,
  initialNotes = '',
  previousTotal,
  savedSelections,
  onModifySave,
}: RentalSlotPickerProps) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { submit, loading: submitting } = useCreateRentalRequest();
  const [selections] = useState<SelectionRange[]>(initialSelections);
  const [unitsRequested, setUnitsRequested] = useState(initialUnits);
  const [notes, setNotes] = useState(initialNotes);
  const [priceUpOpen, setPriceUpOpen] = useState(false);
  const [serverQuote, setServerQuote] = useState<PriceConfirmQuote | null>(null);
  const openedFingerprint = useMemo(
    () => rentalSelectionFingerprint(savedSelections ?? initialSelections, initialUnits, initialNotes),
    [initialNotes, initialSelections, initialUnits, savedSelections]
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [cardFallback, setCardFallback] = useState<string | null>(null);

  const stock = Math.max(1, Math.floor(Number(unitsAvailable)) || 1);

  const remainingForSelection = useMemo(() => {
    if (selections.length === 0) return stock;
    let minRem = stock;
    for (const r of selections) {
      const rem = remainingUnitsInRange(r.startMs, r.endMs, bookedWindows, stock);
      if (rem < minRem) minRem = rem;
    }
    return minRem;
  }, [bookedWindows, selections, stock]);

  useEffect(() => {
    setUnitsRequested((prev) => Math.min(Math.max(1, prev), Math.max(1, remainingForSelection)));
  }, [remainingForSelection]);

  const effectiveSelections = selections;

  const hoursTotal = useMemo(() => totalBillableHours(effectiveSelections), [effectiveSelections]);
  const { total: estimatedTotal } = useMemo(
    () =>
      estimateTotalFromSelectionRanges(
        effectiveSelections,
        basePricePerHour,
        basePricePerDay,
        unitsRequested
      ),
    [basePricePerDay, basePricePerHour, effectiveSelections, unitsRequested]
  );

  /** Min/max hours apply per hour block (full days exempt), matching the server. Lead time and free hours were checked in the sheet. */
  const validateBeforeSubmit = (): string | null => {
    if (effectiveSelections.length === 0) {
      return t('rentals.requestForm.addOneRange', 'Add at least one time range.');
    }
    const blocks = effectiveSelections.filter((r) => r.billing !== 'all_day');
    const hoursOf = (r: SelectionRange) => Math.max(1, Math.ceil((r.endMs - r.startMs) / 3600000));
    if (blocks.some((r) => hoursOf(r) < minRentalHours)) {
      return t('rentals.requestForm.belowMinHours', 'Selected time is below minimum hours.');
    }
    if (maxRentalHours != null && blocks.some((r) => hoursOf(r) > maxRentalHours)) {
      return t('rentals.requestForm.aboveMaxHours', 'Selected time exceeds maximum hours.');
    }
    if (unitsRequested < 1 || unitsRequested > remainingForSelection) {
      return t(
        'rentals.requestForm.unitsUnavailable',
        'Not enough units available for the selected times.'
      );
    }
    return null;
  };

  const submitRequest = async () => {
    if (requestBlocked || requestBusy) return;
    const err = validateBeforeSubmit();
    if (err) {
      setMsg(err);
      return;
    }
    const windows = effectiveSelections.map((r) => {
      const s = localPickerInstantToRequestParts(r.startMs);
      const e = localPickerInstantToRequestParts(r.endMs);
      const base = {
        requestedStartAt: requestedSlotUtcIso(s.dateKey, s.hour, s.minute),
        requestedEndAt: requestedSlotUtcIso(e.dateKey, e.hour, e.minute),
      };
      if (r.billing === 'all_day' && r.calendarDate) {
        return { ...base, billing: 'all_day' as const, calendarDate: r.calendarDate };
      }
      return base;
    });
    const starts = effectiveSelections.map((r) => r.startMs);
    const ends = effectiveSelections.map((r) => r.endMs);
    const envS = localPickerInstantToRequestParts(Math.min(...starts));
    const envE = localPickerInstantToRequestParts(Math.max(...ends));
    try {
      const res = await submit({
        rentalLocationListingId: listingId,
        requestedStartAt: requestedSlotUtcIso(envS.dateKey, envS.hour, envS.minute),
        requestedEndAt: requestedSlotUtcIso(envE.dateKey, envE.hour, envE.minute),
        windows,
        unitsRequested,
        clientRequestNote: notes.trim() || undefined,
      });
      const attribution = consumeRentalRequestAttribution(listingId);
      if (attribution) {
        trackSiteEvent({
          eventType: 'assistant.attributed.rental_request_created',
          metadata: {
            thread_id: attribution.threadId,
            listing_id: listingId,
            minutes_since_tap: attribution.minutes,
          },
        });
      }
      if (onSubmitted) {
        onSubmitted(res.requestId);
        return;
      }
      (
        navigation as unknown as NativeStackNavigationProp<ClientRootStackParamList>
      ).navigate('RentalRequestSubmitted', { requestId: res.requestId });
    } catch (e: unknown) {
      if (dayHoursRuleError(e)) return;
      const friendly = cardWindowErrorMessage(e, i18n.language);
      setCardFallback(friendly);
      setMsg(friendly ?? (e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed')));
    }
  };

  /** Day-and-hours server rules: say why in EN/FR and send the renter back to the sheet. */
  function dayHoursRuleError(e: unknown): boolean {
    const text = submitRuleText(e, i18n.language);
    if (!text) return false;
    setCardFallback(null);
    if (onServerRuleError) {
      setMsg(null);
      onServerRuleError(text);
    } else {
      setMsg(text);
      onEditDates?.();
    }
    return true;
  }

  const buildModifyBody = () => {
    const windows = effectiveSelections.map((r) => {
      const s = localPickerInstantToRequestParts(r.startMs);
      const e = localPickerInstantToRequestParts(r.endMs);
      const base = {
        requestedStartAt: requestedSlotUtcIso(s.dateKey, s.hour, s.minute),
        requestedEndAt: requestedSlotUtcIso(e.dateKey, e.hour, e.minute),
      };
      return r.billing === 'all_day' && r.calendarDate
        ? { ...base, billing: 'all_day' as const, calendarDate: r.calendarDate }
        : base;
    });
    const starts = effectiveSelections.map((r) => r.startMs);
    const ends = effectiveSelections.map((r) => r.endMs);
    const envS = localPickerInstantToRequestParts(Math.min(...starts));
    const envE = localPickerInstantToRequestParts(Math.max(...ends));
    return {
      rentalLocationListingId: listingId,
      requestedStartAt: requestedSlotUtcIso(envS.dateKey, envS.hour, envS.minute),
      requestedEndAt: requestedSlotUtcIso(envE.dateKey, envE.hour, envE.minute),
      windows,
      unitsRequested,
      clientRequestNote: notes.trim() || undefined,
    };
  };

  const commitModify = async (confirmed?: { amount: number; currency: string }) => {
    if (!onModifySave) return;
    setPriceUpOpen(false);
    try {
      const body = buildModifyBody();
      await onModifySave(confirmed ? { ...body, confirmedTotal: confirmed } : body);
      setServerQuote(null);
    } catch (e: unknown) {
      const quote = readPriceConfirmQuote(e);
      if (quote) {
        setServerQuote(quote);
        setPriceUpOpen(true);
        return;
      }
      if (dayHoursRuleError(e)) return;
      const friendly = cardWindowErrorMessage(e, i18n.language);
      setCardFallback(friendly);
      setMsg(friendly ?? (e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed')));
    }
  };

  const allDayLabel = t('rentals.requestForm.allDayLabel', 'All day');
  const modifying = submitMode === 'modify';
  const dirty = rentalSelectionFingerprint(effectiveSelections, unitsRequested, notes) !== openedFingerprint;
  const dayCountLabel = (count: number) =>
    t('rentals.requestForm.dayCount', '{{count}} day', { count });
  const shownDateLine = modifying && effectiveSelections.length
    ? formatRentalPeriod(selectionPeriodWindows(effectiveSelections), i18n.language, dayCountLabel)
    : dateLine;
  const savedDateLine = modifying && savedSelections?.length
    ? formatRentalPeriod(selectionPeriodWindows(savedSelections), i18n.language, dayCountLabel)
    : dateLine;
  const price = requestBlocked
    ? { totalAmount: '—' }
    : requestPriceCopy({
        rows: effectiveSelections,
        hours: hoursTotal,
        units: unitsRequested,
        total: estimatedTotal,
        dayRate: basePricePerDay,
        hourRate: basePricePerHour,
        currency,
        language: i18n.language,
        t,
      });
  return (
    <View style={styles.screen}>
      <RentalRequestScreenForm
        itemName={itemName ?? ''}
        itemMeta={itemMeta}
        imageUrl={imageUrl}
        dateLine={shownDateLine}
        onEditDates={onEditDates}
        datesFilled={datesFilled}
        unavailableLabel={unavailableLabel}
        notice={
          <>
            {notice}
            {cardFallback && onEditDates ? (
              <CardWindowNotice
                tone="error"
                title={i18n.language.startsWith('fr') ? 'Impossible de continuer' : 'Can’t continue with these dates'}
                body={cardFallback}
                action={i18n.language.startsWith('fr') ? 'Modifier les dates' : 'Change dates'}
                onAction={onEditDates}
              />
            ) : null}
          </>
        }
        onSeeDates={onSeeDates}
        rows={selections.map((row) => ({
          id: row.id,
          label: requestSelectionLabel(row, i18n.language, allDayLabel),
        }))}
        units={unitsRequested}
        unitsMax={remainingForSelection}
        stock={stock}
        onChangeUnits={(next) =>
          setUnitsRequested(Math.min(Math.max(1, next), Math.max(1, remainingForSelection)))
        }
        notes={notes}
        onChangeNotes={setNotes}
        priceLabel={price.priceLabel}
        priceAmount={price.priceAmount}
        hoursCaption={price.hoursCaption}
        totalAmount={price.totalAmount}
        previousAmount={
          modifying && previousTotal != null && Math.abs(estimatedTotal - previousTotal) > 0.009
            ? formatRequestAmount(previousTotal, currency, i18n.language)
            : undefined
        }
        legal={
          modifying
            ? t('rentals.modify.businessSees', 'The business will see your changes before accepting.')
            : undefined
        }
        blockedReason={blockedReason}
        message={msg}
        sendLabel={
          modifying
            ? t('rentals.modify.save', 'Save changes')
            : isAuthenticated || requestBlocked
              ? t('rentals.requestForm.confirmSend', 'Send request')
              : t('rentals.searchFirst.signInToRequest', 'Sign in to request a rental')
        }
        sendIcon={modifying ? 'check' : isAuthenticated || requestBlocked ? 'send' : 'login'}
        sendDisabled={
          submitting ||
          requestBlocked ||
          requestBusy ||
          cardSendDisabled ||
          (modifying ? !dirty || effectiveSelections.length === 0 : isAuthenticated && effectiveSelections.length === 0)
        }
        sending={submitting}
        onSend={() => {
          if (modifying) {
            const err = validateBeforeSubmit();
            if (err) {
              setMsg(err);
              return;
            }
            if (modifySaveNeedsConfirm(estimatedTotal, previousTotal ?? estimatedTotal)) {
              setPriceUpOpen(true);
              return;
            }
            void commitModify();
            return;
          }
          if (!isAuthenticated) {
            if (onLoginRequired) {
              onLoginRequired();
              return;
            }
            (
              navigation as unknown as NativeStackNavigationProp<GuestRootStackParamList>
            ).navigate('GuestTabs', { screen: 'GuestAuth', params: { screen: 'Login' } });
            return;
          }
          void submitRequest();
        }}
      />
      <RentalModifyPriceSheet
        visible={priceUpOpen}
        title={t('rentals.modify.confirmTitle', 'Update your request?')}
        body={t(
          'rentals.modify.confirmBody',
          'The quoted total went up. The business will see these changes before accepting.'
        )}
        rows={[
          {
            label: t('rentals.modify.dates', 'Dates'),
            from: savedDateLine ?? '',
            to: shownDateLine ?? '',
          },
          {
            label: t('rentals.modify.duration', 'Duration'),
            from: dayCountLabel(openedDayCount(savedSelections ?? initialSelections)),
            to: dayCountLabel(openedDayCount(effectiveSelections)),
          },
          {
            label: t('rentals.requestForm.total', 'Total'),
            from: formatRequestAmount(serverQuote?.previousTotal ?? previousTotal ?? 0, serverQuote?.currency ?? currency, i18n.language),
            to: formatRequestAmount(serverQuote?.total ?? estimatedTotal, serverQuote?.currency ?? currency, i18n.language),
          },
        ]}
        saveLabel={t('rentals.modify.save', 'Save changes')}
        keepLabel={t('rentals.modify.keep', 'Keep current')}
        onSave={() =>
          void commitModify({
            amount: serverQuote?.total ?? estimatedTotal,
            currency: serverQuote?.currency ?? currency,
          })
        }
        onKeep={() => {
          setPriceUpOpen(false);
          setServerQuote(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
