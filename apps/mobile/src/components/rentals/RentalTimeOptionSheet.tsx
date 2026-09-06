import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from '../common/AppModal';
import { useTheme } from '../../contexts/ThemeContext';

export type RentalTimeOption = {
  valueMs: number;
  label: string;
};

type Props = {
  visible: boolean;
  title: string;
  options: RentalTimeOption[];
  selectedMs?: number | '';
  onSelect: (valueMs: number) => void;
  onDismiss: () => void;
};

function TimeOptionRow({
  option,
  selected,
  onSelect,
}: {
  option: RentalTimeOption;
  selected: boolean;
  onSelect: (valueMs: number) => void;
}) {
  const { spacing, borderRadius } = useTheme();
  return (
    <Button
      mode={selected ? 'contained-tonal' : 'text'}
      onPress={() => onSelect(option.valueMs)}
      style={[styles.optionBtn, { marginBottom: spacing.xxs, borderRadius: borderRadius.md }]}
      contentStyle={styles.optionContent}
      accessibilityState={{ selected }}
    >
      {option.label}
    </Button>
  );
}

export function RentalTimeOptionSheet({
  visible,
  title,
  options,
  selectedMs,
  onSelect,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel', 'Cancel')}
      >
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              paddingBottom: insets.bottom + spacing.md,
              maxHeight: screenHeight * 0.7,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            variant="titleLarge"
            style={[styles.title, { color: colors.text.primary, paddingHorizontal: spacing.md }]}
          >
            {title}
          </Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}
          >
            {options.map((option) => (
              <TimeOptionRow
                key={option.valueMs}
                option={option}
                selected={selectedMs === option.valueMs}
                onSelect={onSelect}
              />
            ))}
          </ScrollView>
          <View style={[styles.footer, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
            <Button mode="text" onPress={onDismiss}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </View>
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
  title: {
    fontWeight: '700',
    paddingTop: 20,
    paddingBottom: 8,
  },
  optionBtn: {
    justifyContent: 'flex-start',
  },
  optionContent: {
    justifyContent: 'flex-start',
    minHeight: 44,
  },
  footer: {
    alignItems: 'flex-end',
  },
});
