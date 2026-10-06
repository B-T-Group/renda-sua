import { Alert, View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '@/contexts/ThemeContext';
import { useStore } from '@/stores/RootStore';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export const AssistantHeaderTitle = observer(function AssistantHeaderTitle() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const store = useStore();
  const { assistant } = store;

  const statusLabel = assistant.errorKind === 'network'
    ? t('assistant.subtitleOffline', 'Offline')
    : assistant.isSending
    ? t('assistant.subtitleThinking', 'Thinking…')
    : t('assistant.subtitle', 'AI · Replies in seconds');

  return (
    <View style={styles.headerTitleContainer}>
      <View style={[styles.miniOrb, { backgroundColor: colors.primary.main }]}>
        <MaterialIcons name="smart-toy" size={20} color={colors.primary.contrast} />
      </View>
      <View>
        <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
          {t('assistant.title', 'RendaSua Assistant')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]} numberOfLines={1}>
          {statusLabel}
        </Text>
      </View>
    </View>
  );
});

interface StartOverButtonProps {
  onPress: () => void;
}

export const AssistantHeaderRight = observer(function AssistantHeaderRight({
  onPress,
}: StartOverButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const store = useStore();
  const { assistant } = store;

  if (assistant.messages.length === 0) {
    return null;
  }

  const confirmStartOver = () => {
    Alert.alert(
      t('assistant.startOverConfirmTitle', 'Start over?'),
      t('assistant.startOverConfirmMessage', 'This clears the conversation.'),
      [
        { text: t('assistant.startOverConfirmCancel', 'Cancel'), style: 'cancel' },
        {
          text: t('assistant.startOverConfirmAction', 'Start over'),
          style: 'destructive',
          onPress,
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={confirmStartOver}
      accessibilityRole="button"
      accessibilityLabel={t('assistant.startOverA11y', 'Start a new conversation')}
      style={({ pressed }) => [
        styles.headerButton,
        { opacity: pressed ? 0.6 : 1 },
      ]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons name="restart-alt" size={24} color={colors.primary.main} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm - 2,
  },
  miniOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h6,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  headerButton: {
    padding: spacing.xs,
  },
});
