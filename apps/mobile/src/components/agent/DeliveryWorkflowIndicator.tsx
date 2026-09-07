import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

type WorkflowStep = {
  key: string;
  labelKey: string;
  labelDefault: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    key: 'accepted',
    labelKey: 'agent.workflow.accepted',
    labelDefault: 'Accepted',
    icon: 'clipboard-check',
  },
  {
    key: 'navigate_pickup',
    labelKey: 'agent.workflow.navigatePickup',
    labelDefault: 'Navigate\nto Pickup',
    icon: 'store',
  },
  {
    key: 'confirm_pickup',
    labelKey: 'agent.workflow.confirmPickup',
    labelDefault: 'Confirm\nPickup',
    icon: 'package-variant-closed-check',
  },
  {
    key: 'navigate_customer',
    labelKey: 'agent.workflow.navigateCustomer',
    labelDefault: 'Navigate\nto Customer',
    icon: 'map-marker',
  },
  {
    key: 'delivered',
    labelKey: 'agent.workflow.delivered',
    labelDefault: 'Delivered',
    icon: 'check-circle',
  },
];

function orderStatusToWorkflowIndex(status: string): number {
  switch (status) {
    case 'assigned_to_agent':
      return 0;
    case 'picked_up':
      return 2;
    case 'in_transit':
      return 3;
    case 'out_for_delivery':
      return 3;
    case 'delivered':
    case 'complete':
      return 4;
    default:
      return 0;
  }
}

export interface DeliveryWorkflowIndicatorProps {
  currentStatus: string;
}

/**
 * Horizontal stepper showing where the driver is in the delivery lifecycle.
 * Completed steps show a check mark; the active step is highlighted;
 * future steps are dimmed.
 */
export function DeliveryWorkflowIndicator({ currentStatus }: DeliveryWorkflowIndicatorProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const activeIndex = orderStatusToWorkflowIndex(currentStatus);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.xs,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      {WORKFLOW_STEPS.map((step, idx) => {
        const isCompleted = idx < activeIndex;
        const isActive = idx === activeIndex;
        const isFuture = idx > activeIndex;
        const isLast = idx === WORKFLOW_STEPS.length - 1;

        const dotColor = isCompleted
          ? colors.success.main
          : isActive
            ? colors.primary.main
            : colors.text.disabled;

        const labelColor = isCompleted
          ? colors.success.dark
          : isActive
            ? colors.primary.main
            : colors.text.disabled;

        const connectorColor = isCompleted ? colors.success.main : colors.divider;

        return (
          <View key={step.key} style={styles.stepWrapper}>
            <View style={styles.stepCol}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isCompleted ? colors.success.main : isActive ? colors.primary.main : 'transparent',
                    borderColor: dotColor,
                    borderWidth: isActive ? 2 : 1.5,
                    shadowColor: isActive ? colors.primary.main : 'transparent',
                    shadowOpacity: isActive ? 0.3 : 0,
                    shadowRadius: 4,
                    elevation: isActive ? 2 : 0,
                  },
                ]}
              >
                {isCompleted ? (
                  <MaterialCommunityIcons name="check" size={10} color="#fff" />
                ) : isActive ? (
                  <View
                    style={[styles.innerDot, { backgroundColor: colors.primary.main }]}
                  />
                ) : null}
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.label,
                  { color: labelColor, fontWeight: isActive ? '700' : '500' },
                ]}
              >
                {t(step.labelKey, step.labelDefault)}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: connectorColor,
                    marginTop: 10,
                  },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connector: {
    flex: 1,
    height: 1.5,
    marginHorizontal: 2,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  label: {
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12,
    letterSpacing: 0.2,
  },
});
