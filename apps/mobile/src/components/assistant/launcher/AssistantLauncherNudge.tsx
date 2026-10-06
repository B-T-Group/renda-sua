/**
 * First-run nudge (#451 spec §1): a one-time speech bubble anchored above the
 * launcher. Dismiss by ✕, a tap outside, a tap on the orb, "Try it", or after 8 s.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { spacing, borderRadius } from '../../../theme/spacing';
import type { NudgeDismissReason } from '../../../utils/assistantLauncher';

type Props = {
  right: number;
  bottom: number;
  onDismiss: (reason: NudgeDismissReason) => void;
  onTry: () => void;
};

export function AssistantLauncherNudge({ right, bottom, onDismiss, onTry }: Props) {
  const { t } = useTranslation();
  const { colors, shadows } = useTheme();
  return (
    <>
      {/* Tap outside dismisses (one tap; it does not pass through). */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => onDismiss('outside')}
        accessible={false}
        importantForAccessibility="no"
      />
      <View
        style={[
          styles.bubble,
          shadows.md,
          { right, bottom, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        accessibilityViewIsModal={false}
      >
        <View style={styles.row}>
          <Text style={[styles.body, { color: colors.text.primary }]}>
            {t('assistant.nudge.body', 'Hi! I can find items, track your order or reorder for you.')}
          </Text>
          <Pressable
            onPress={() => onDismiss('close')}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.nudge.dismiss', 'Dismiss')}
            hitSlop={12}
            style={styles.close}
          >
            <MaterialIcons name="close" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>
        <Pressable
          onPress={onTry}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.primary.main, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.ctaText, { color: colors.primary.contrast }]}>
            {t('assistant.nudge.cta', 'Try it')}
          </Text>
        </Pressable>
        <View
          style={[styles.tail, { backgroundColor: colors.surface, borderColor: colors.border }]}
          pointerEvents="none"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    maxWidth: 260,
    borderWidth: 1,
    borderRadius: borderRadius.card,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxs },
  body: { flex: 1, fontSize: 14, lineHeight: 20 },
  close: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  cta: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    marginRight: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.button,
    justifyContent: 'center',
  },
  ctaText: { fontSize: 14, fontWeight: '600' },
  tail: {
    position: 'absolute',
    right: 22,
    bottom: -7,
    width: 12,
    height: 12,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
});
