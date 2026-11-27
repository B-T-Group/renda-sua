import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, IconButton } from 'react-native-paper';
import { HeaderSettingsButton } from '../common/HeaderSettingsButton';
import { useTheme } from '../../contexts/ThemeContext';

const MAX_BADGE_COUNT = 9;

interface RentalMessagesHeaderRightProps {
  showMessages: boolean;
  unreadCount: number;
  onOpenMessages: () => void;
}

export function RentalMessagesHeaderRight({
  showMessages,
  unreadCount,
  onOpenMessages,
}: RentalMessagesHeaderRightProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label =
    unreadCount > 0
      ? t('rentals.messages.openWithUnread', 'Messages, {{count}} unread', {
          count: unreadCount,
        })
      : t('rentals.messages.title', 'Messages');

  return (
    <View style={styles.row}>
      {showMessages ? (
        <View>
          <IconButton
            icon="message-text-outline"
            accessibilityLabel={label}
            onPress={onOpenMessages}
          />
          {unreadCount > 0 ? (
            <Badge
              size={16}
              style={[styles.badge, { backgroundColor: colors.error.main }]}
            >
              {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
            </Badge>
          ) : null}
        </View>
      ) : null}
      <HeaderSettingsButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  badge: { position: 'absolute', top: 4, right: 4 },
});
