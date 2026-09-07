import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { MaterialCommunityIcons as MaterialIconsType } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

type IconName = React.ComponentProps<typeof MaterialIconsType>['name'];

export interface CheckoutProgressStepperProps {
  steps: Array<{
    key: string;
    label: string;
    icon?: IconName;
  }>;
  currentStep: string;
}

const DEFAULT_ICONS: Record<string, IconName> = {
  cart: 'cart-outline',
  checkout: 'map-marker-outline',
  pay: 'credit-card-outline',
};

/**
 * Progress stepper for multi-step checkout flow (Cart → Checkout → Pay).
 * Option A: icon-first rail with nowrap labels and absolute connectors.
 * Completed steps show a check; current step shows its icon; upcoming steps show muted icon.
 */
export function CheckoutProgressStepper({
  steps,
  currentStep,
}: CheckoutProgressStepperProps) {
  const { colors, typography, spacing } = useTheme();

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;
        const icon = step.icon ?? DEFAULT_ICONS[step.key] ?? 'circle-outline';
        const onFilledCircle = isCompleted || isCurrent;
        const iconColor = onFilledCircle
          ? colors.primary.contrast
          : colors.text.secondary;

        return (
          <View key={step.key} style={styles.stepColumn}>
            <View style={styles.railRow}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: onFilledCircle
                      ? colors.primary.main
                      : 'transparent',
                    borderColor: onFilledCircle
                      ? colors.primary.main
                      : colors.divider,
                  },
                ]}
              >
                {isCompleted ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={16}
                    color={iconColor}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={icon}
                    size={16}
                    color={iconColor}
                  />
                )}
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: isCompleted
                        ? colors.primary.main
                        : colors.divider,
                    },
                  ]}
                />
              )}
            </View>

            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={[
                typography.caption,
                {
                  marginTop: spacing.xxs,
                  color:
                    isCurrent || isCompleted
                      ? colors.text.primary
                      : colors.text.secondary,
                  fontWeight: isCurrent ? '600' : '400',
                },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepColumn: {
    flex: 1,
    alignItems: 'center',
  },
  railRow: {
    position: 'relative',
    width: '100%',
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  connector: {
    position: 'absolute',
    left: '50%',
    right: '-50%',
    height: 2,
    top: 15,
    zIndex: 1,
  },
});
