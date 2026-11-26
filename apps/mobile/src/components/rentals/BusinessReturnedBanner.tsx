import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { EARLY_BLUE } from './EarlyReturnParts';

export interface BusinessReturnedEarly {
  /** "3:40 PM – 6:00 PM opens for new bookings once you confirm." */
  frees: string;
  freesWindow?: string;
  onMessage: () => void;
}

export function BusinessReturnedBanner({
  title,
  body,
  onConfirm,
  onProblem,
  early,
}: {
  title: string;
  body: string;
  onConfirm: () => void;
  onProblem: () => void;
  /** Early return (mock 04): ↶ title, ✓ Confirm return, ⚠ / 💬 icon buttons, freed window. */
  early?: BusinessReturnedEarly;
}) {
  const { t } = useTranslation();
  const { spacing, borderRadius, typography, colors } = useTheme();
  if (early) {
    return (
      <View
        testID="business-return-report-early"
        style={{
          borderWidth: 1,
          borderLeftWidth: 4,
          borderColor: colors.divider,
          borderLeftColor: EARLY_BLUE,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginTop: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="undo-variant" size={22} color={EARLY_BLUE} />
          <Text style={[typography.subtitle1, { fontWeight: '700', color: colors.text.primary, marginLeft: 8, flex: 1 }]}>
            {title}
          </Text>
        </View>
        <Text style={[typography.body2, { marginTop: spacing.xs, color: colors.text.primary }]}>{body}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            mode="contained"
            icon="check"
            buttonColor={EARLY_BLUE}
            style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}
            onPress={onConfirm}
            testID="business-early-confirm"
          >
            {t('rentals.earlyReturn.confirm', 'Confirm return')}
          </Button>
          <IconSquare icon="alert-outline" label={t('rentals.earlyReturn.problem', 'Report a problem')} onPress={onProblem} />
          <IconSquare icon="message-outline" label={t('rentals.earlyReturn.message', 'Message')} onPress={early.onMessage} />
        </View>
        {early.freesWindow ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EAF1FB',
              borderRadius: borderRadius.sm,
              padding: spacing.sm,
              marginTop: spacing.md,
            }}
          >
            <MaterialCommunityIcons name="lock-open-variant-outline" size={18} color={EARLY_BLUE} />
            <Text style={[typography.caption, { color: colors.text.secondary, marginLeft: 8, flex: 1 }]}>{early.frees}</Text>
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View
      testID="business-return-report"
      style={{
        borderWidth: 1,
        borderColor: '#0B7A3B55',
        backgroundColor: '#F3F8F4',
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.md,
      }}
    >
      <Text style={[typography.subtitle1, { fontWeight: '700', color: colors.text.primary }]}>
        {title}
      </Text>
      <Text style={[typography.body2, { marginTop: spacing.xs, color: colors.text.primary }]}>{body}</Text>
      <Button mode="contained" buttonColor="#0B7A3B" style={{ marginTop: spacing.md, minHeight: 48 }} onPress={onConfirm}>
        {t('rentals.returnReport.confirmReturn', 'Confirm return')}
      </Button>
      <Button mode="outlined" textColor="#B42318" style={{ marginTop: spacing.sm, minHeight: 48 }} onPress={onProblem}>
        {t('rentals.returnReport.reportProblem', 'Report a problem')}
      </Button>
    </View>
  );
}

function IconSquare({
  icon,
  label,
  onPress,
}: {
  icon: 'alert-outline' | 'message-outline';
  label: string;
  onPress: () => void;
}) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 48,
        height: 48,
        borderWidth: 1,
        borderColor: colors.divider,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.text.primary} />
    </Pressable>
  );
}
