import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from '../common/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import { RentalSlotPicker, type RentalSlotPickerProps } from './RentalSlotPicker';

export interface RentalRequestSheetProps extends RentalSlotPickerProps {
  visible: boolean;
  onDismiss: () => void;
  listingName?: string;
}

export function RentalRequestSheet({
  visible,
  onDismiss,
  listingName,
  ...pickerProps
}: RentalRequestSheetProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityRole="button">
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              maxHeight: screenHeight * 0.88,
              borderRadius: borderRadius.xl,
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + spacing.sm,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.divider }]} />
          <Text variant="titleLarge" style={{ color: colors.text.primary, paddingHorizontal: spacing.md }}>
            {t('rentals.requestRental', 'Request this rental')}
          </Text>
          {listingName ? (
            <Text
              style={[
                typography.body2,
                {
                  color: colors.text.secondary,
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.xxs,
                },
              ]}
              numberOfLines={2}
            >
              {listingName}
            </Text>
          ) : null}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.sm }}
            showsVerticalScrollIndicator={false}
          >
            <RentalSlotPicker {...pickerProps} embedded onSubmitted={(id) => {
              pickerProps.onSubmitted?.(id);
              onDismiss();
            }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
  },
});
