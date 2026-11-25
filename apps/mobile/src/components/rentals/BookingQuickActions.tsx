import { Share, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { rentalCalendarIcs } from '../../utils/rentals/confirmationFormat';

interface Props {
  title: string;
  start?: string | null;
  end?: string | null;
  location?: string | null;
  showCancel: boolean;
  onMessage: () => void;
  onCancel: () => void;
}

export function BookingQuickActions(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
      <IconButton icon="message-outline" iconColor={colors.text.primary} accessibilityLabel={t('rentals.messages', 'Messages')} onPress={props.onMessage} />
      <IconButton icon="calendar" iconColor={colors.text.primary} accessibilityLabel={t('rentals.addToCalendar', 'Add to calendar')} onPress={() => void shareCalendar(props)} />
      {props.showCancel ? (
        <IconButton icon="close-circle-outline" iconColor={colors.error.main} accessibilityLabel={t('rentals.cancelBooking', 'Cancel booking')} onPress={props.onCancel} />
      ) : null}
    </View>
  );
}

async function shareCalendar(props: Props): Promise<void> {
  const ics = rentalCalendarIcs({ title: props.title, start: props.start, end: props.end, location: props.location });
  await Share.share({ message: ics, title: props.title });
}
