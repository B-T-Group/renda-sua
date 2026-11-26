import React from 'react';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { dueTimeOptionLabel } from '../../utils/rentals/returnDue';

interface Props {
  /** Return due on the listing wall clock (return_due_at after an hourly early start, else end_at). */
  dueAt: string | null;
  /** Listing time zone: 12-hour clock for English in the Americas. */
  timeZone: string;
  busy: boolean;
  /** The chosen return time; the due option passes the stored wall-clock due like before. */
  onPick: (at: Date) => void;
}

/** Business "Confirm return" dialog: the hint and the "Use current time" / "Use due time · 1:00 PM" shortcuts. */
export function ReturnTimeOptions({ dueAt, timeZone, busy, onPick }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  return (
    <>
      <Text style={{ marginBottom: 12, color: colors.text.secondary }}>
        {t(
          'rentals.returnAtHint',
          'Select when the item was returned. Early returns still pay the full rental total; time after the booked end is billed as overtime.'
        )}
      </Text>
      <Button mode="outlined" style={{ marginBottom: 10 }} disabled={busy} onPress={() => onPick(new Date())}>
        {t('rentals.returnUseNow', 'Use current time')}
      </Button>
      {dueAt ? (
        <Button mode="outlined" style={{ marginBottom: 10 }} disabled={busy} onPress={() => onPick(new Date(dueAt))}>
          {dueTimeOptionLabel(dueAt, i18n.language, timeZone, t)}
        </Button>
      ) : null}
    </>
  );
}
