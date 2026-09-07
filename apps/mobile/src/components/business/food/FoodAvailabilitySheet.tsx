import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import { FoodAvailabilitySection } from './FoodAvailabilitySection';

export interface FoodAvailabilitySheetProps {
  visible: boolean;
  itemId: string;
  businessLocationId: string;
  onDismiss: () => void;
}

export function FoodAvailabilitySheet({
  visible,
  itemId,
  businessLocationId,
  onDismiss,
}: FoodAvailabilitySheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
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
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close', 'Close')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md ?? {},
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl ?? 20,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.text.primary }]}
          >
            {t('business.food.servingHours', 'Serving hours')}
          </Text>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {visible && itemId && businessLocationId ? (
              <FoodAvailabilitySection
                key={`${itemId}-${businessLocationId}`}
                itemId={itemId}
                businessLocationId={businessLocationId}
              />
            ) : null}
          </ScrollView>
          <View style={[styles.actions, { paddingHorizontal: spacing.md }]}>
            <Button mode="text" onPress={onDismiss}>
              {t('common.done', 'Done')}
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
    padding: 16,
  },
  sheet: { overflow: 'hidden' },
  title: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
