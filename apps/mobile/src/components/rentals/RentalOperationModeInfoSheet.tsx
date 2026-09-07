import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export interface RentalOperationModeInfoSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

export function RentalOperationModeInfoSheet({
  visible,
  onDismiss,
}: RentalOperationModeInfoSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              maxHeight: screenHeight * 0.6,
              borderRadius: borderRadius.xl,
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={{ color: colors.text.primary }}>
            {t('rentals.catalog.modeInfo.title', 'Rental modes')}
          </Text>
          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            <View>
              <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
                {t('rentals.catalog.modeOperated', 'Operated')}
              </Text>
              <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xxs }]}>
                {t(
                  'rentals.catalog.modeInfo.operatedBody',
                  'The business runs this with you at their location — like equipment rental on-site or a guided service.'
                )}
              </Text>
            </View>
            <View>
              <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
                {t('rentals.catalog.modeTakeHome', 'Take-home')}
              </Text>
              <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xxs }]}>
                {t(
                  'rentals.catalog.modeInfo.takeHomeBody',
                  'Pick up the item, use it off-site, and return it by your booked end time.'
                )}
              </Text>
            </View>
          </View>
          <View style={[styles.actions, { marginTop: spacing.lg }]}>
            <Button mode="contained" onPress={onDismiss} style={{ flex: 1 }}>
              {t('common.gotIt', 'Got it')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    padding: 20,
  },
  actions: {
    flexDirection: 'row',
  },
});
