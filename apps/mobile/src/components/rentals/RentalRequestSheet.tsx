import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from '../common/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import { RentalSlotPicker, type RentalSlotPickerProps } from './RentalSlotPicker';

export interface RentalRequestSheetProps extends RentalSlotPickerProps {
  visible: boolean;
  onDismiss: () => void;
  listingName?: string;
  datesBanner?: string;
  dateLine?: string;
  onEditDates?: () => void;
  unavailableLabel?: string;
  quoteLabel?: string;
}

export function RentalRequestSheet({
  visible,
  onDismiss,
  listingName,
  datesBanner,
  dateLine,
  onEditDates,
  unavailableLabel,
  quoteLabel,
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
          {dateLine ? (
            <View style={[styles.dateLine, { paddingHorizontal: spacing.md, marginTop: spacing.xs }]}>
              <Text
                testID="rental-request-dates"
                style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700', flex: 1 }]}
              >
                {dateLine}
              </Text>
              {onEditDates ? (
                <Pressable
                  onPress={onEditDates}
                  testID="rental-request-edit-dates"
                  accessibilityRole="button"
                  accessibilityLabel={t('rentals.searchFirst.edit', 'Edit')}
                  style={styles.editDates}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary.main} />
                  <Text style={{ color: colors.primary.main, fontWeight: '700' }}>
                    {t('rentals.searchFirst.edit', 'Edit')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {datesBanner ? (
            <Text
              style={[
                typography.body2,
                { color: colors.text.secondary, paddingHorizontal: spacing.md, marginTop: spacing.xs },
              ]}
            >
              {datesBanner}
            </Text>
          ) : null}
          {unavailableLabel ? (
            <Text
              testID="rental-request-unavailable"
              style={[
                typography.subtitle2,
                {
                  color: colors.warning.dark,
                  fontWeight: '700',
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {unavailableLabel}
            </Text>
          ) : null}
          {quoteLabel && !unavailableLabel ? (
            <Text
              testID="rental-request-quote"
              style={[
                typography.subtitle1,
                {
                  color: colors.primary.main,
                  fontWeight: '700',
                  paddingHorizontal: spacing.md,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {quoteLabel}
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
  dateLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
