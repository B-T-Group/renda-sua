import React from 'react';
import { Button, Dialog, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { brandFaceStyle } from '../../theme/fonts';
import { dueTimeOptionLabel, formatReturnClock } from '../../utils/rentals/returnDue';

interface Props {
  /** Return due on the listing wall clock (return_due_at after an hourly early start, else end_at). */
  dueAt: string | null;
  /** Listing time zone: 12-hour clock for English in the Americas. */
  timeZone: string;
  busy: boolean;
  /** The chosen return time; the due option passes the stored wall-clock due like before. */
  onPick: (at: Date) => void;
}

/**
 * "Confirm return" title. Paper's theme carries no brand fonts, so set Inter here
 * (otherwise the dialog falls back to the system font).
 */
export function ReturnDialogTitle() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Dialog.Title style={[brandFaceStyle('600'), { color: colors.text.primary }]}>
      {t('rentals.confirmReturn', 'Confirm return')}
    </Dialog.Title>
  );
}

/** Business "Confirm return" dialog: the overtime hint and the "Use current time" / "Use due time · 1:00 PM" shortcuts. */
export function ReturnTimeOptions({ dueAt, timeZone, busy, onPick }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, typography } = useTheme();
  const label = [brandFaceStyle('600')];
  return (
    <>
      <Text style={[typography.body2, { marginBottom: 12, color: colors.text.secondary }]}>
        {dueAt
          ? t('rentals.returnAtHintDue', 'Early returns still pay the full rental total. Time after {{time}} is billed as overtime.', {
              time: formatReturnClock(dueAt, i18n.language, timeZone),
            })
          : t(
              'rentals.returnAtHint',
              'Select when the item was returned. Early returns still pay the full rental total; time after the booked end is billed as overtime.'
            )}
      </Text>
      <Button mode="outlined" style={{ marginBottom: 10 }} labelStyle={label} disabled={busy} onPress={() => onPick(new Date())}>
        {t('rentals.returnUseNow', 'Use current time')}
      </Button>
      {dueAt ? (
        <Button mode="outlined" style={{ marginBottom: 10 }} labelStyle={label} disabled={busy} onPress={() => onPick(new Date(dueAt))}>
          {dueTimeOptionLabel(dueAt, i18n.language, timeZone, t)}
        </Button>
      ) : null}
    </>
  );
}
