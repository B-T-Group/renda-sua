import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { bookedUntil, instantClock, returnInstantIso, type EarlyReturnBooking } from '../../utils/rentals/earlyReturn';
import { EdgeCard, MoneyLines } from './EarlyReturnParts';

/** AC10 (mock 05 / 05b): completed early return — time, booked end, and what was paid. */
export function RenterReturnedEarlyCard(props: {
  booking: EarlyReturnBooking;
  timeZone: string;
  price: string;
  /** Card deposit released; empty for MoMo / XAF. */
  deposit: string;
  /** Card hold (rental + deposit); empty when not a card hold. */
  hold: string;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const time = instantClock(returnInstantIso(props.booking), lang, props.timeZone);
  const card = Boolean(props.deposit);
  return (
    <View testID="renter-returned-early">
      <EdgeCard
        tone="green"
        icon="check"
        title={t('rentals.earlyReturn.returnedEarly', 'Returned early · {{time}}', { time })}
        body={t('rentals.earlyReturn.bookedUntil', 'Booked until {{time}}', { time: bookedUntil(props.booking, lang, props.timeZone) })}
      />
      {card ? (
        <MoneyLines
          rows={[
            { label: t('rentals.earlyReturn.rentalCharged', 'Rental charged'), value: props.price },
            { label: t('rentals.earlyReturn.depositReleased', 'Deposit released'), value: props.deposit, positive: true },
          ]}
          note={props.hold ? t('rentals.earlyReturn.holdClosed', 'The {{amount}} card hold is closed.', { amount: props.hold }) : undefined}
        />
      ) : (
        <MoneyLines
          rows={[{ label: t('rentals.earlyReturn.paidMomo', 'Paid by Mobile Money'), value: props.price }]}
          note={t('rentals.earlyReturn.momoNoRefund', 'Full price, no refund for unused time')}
        />
      )}
    </View>
  );
}
