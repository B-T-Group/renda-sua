import { View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  /** cancelFeeResult(): what happens to a paid reservation fee if the renter cancels now. */
  fee: 'none' | 'refund' | 'keep';
  feeLabel?: string;
  /** The renter's flag on the pickup check is still open (refund). */
  flagged?: boolean;
  loading?: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
}

/** Renter cancel sheet with the fee refund / keep copy (README §4). */
export function CancelBookingDialog(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const body =
    props.fee === 'refund'
      ? props.flagged
        ? t('rentals.cancelSheet.refundFlag', 'Your flag on the item check is still open, so you get the {{fee}} reservation fee back.', { fee: props.feeLabel })
        : t('rentals.cancelSheet.refund', 'This booking hasn’t started, so cancellation is free. You get the {{fee}} reservation fee back.', { fee: props.feeLabel })
      : props.fee === 'keep'
        ? t('rentals.cancelSheet.keep', 'It’s the pickup day, so the business keeps the {{fee}} reservation fee. Nothing else is charged.', { fee: props.feeLabel })
        : t('rentals.bookingDetail.cancelBeforeStartMessage', 'This booking has not started, so cancellation is free. Any card hold or wallet hold is released.');
  return (
    <Portal>
      <Dialog visible={props.visible} onDismiss={props.onDismiss} testID="cancel-booking-dialog">
        <Dialog.Title>{t('rentals.cancelBooking', 'Cancel booking')}</Dialog.Title>
        <Dialog.Content>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <MaterialCommunityIcons
              name={props.fee === 'keep' ? 'alert-outline' : 'restore'}
              size={18}
              color={props.fee === 'keep' ? colors.warning.dark : colors.text.secondary}
              style={{ marginTop: 2 }}
            />
            <Text style={{ marginLeft: 8, flex: 1, color: props.fee === 'keep' ? colors.warning.dark : colors.text.primary }}>{body}</Text>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={props.onDismiss} disabled={props.loading}>{t('rentals.cancelSheet.keepBooking', 'Keep booking')}</Button>
          <Button onPress={props.onConfirm} loading={props.loading} textColor={colors.error.main}>
            {t('rentals.cancelBooking', 'Cancel booking')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
