import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { trackChecklistStepCompleted, trackChecklistViewed } from '../../utils/ftueAnalytics';

export type ActivationStep = {
  id: string;
  label: string;
  done: boolean;
  current?: boolean;
  onPress?: () => void;
};

type Props = {
  persona: 'client' | 'agent' | 'business';
  title: string;
  steps: ActivationStep[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function ActivationChecklistCard({
  persona,
  title,
  steps,
  collapsed,
  onToggleCollapsed,
  onRefresh,
  refreshing = false,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => s.current && !s.done) ?? steps.find((s) => !s.done);

  useEffect(() => {
    trackChecklistViewed(persona);
  }, [persona]);

  if (steps.length === 0 || doneCount === steps.length) return null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary.light,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={onToggleCollapsed}
          style={styles.headerText}
          accessibilityRole={onToggleCollapsed ? 'button' : undefined}
        >
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {title}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 2 }}>
            {t('ftue.checklist.progress', '{{done}} of {{total}} complete', {
              done: doneCount,
              total: steps.length,
            })}
          </Text>
        </Pressable>
        {onRefresh ? (
          refreshing ? (
            <ActivityIndicator
              size="small"
              color={colors.primary.main}
              style={styles.refreshSpin}
            />
          ) : (
            <IconButton
              icon="refresh"
              size={22}
              onPress={onRefresh}
              disabled={refreshing}
              accessibilityLabel={t('common.refresh', 'Refresh')}
              style={styles.refreshBtn}
            />
          )
        ) : null}
        <View
          style={[
            styles.ring,
            { borderColor: colors.primary.main, backgroundColor: colors.primaryTint },
          ]}
        >
          <Text variant="labelMedium" style={{ color: colors.primary.main, fontWeight: '700' }}>
            {doneCount}/{steps.length}
          </Text>
        </View>
      </View>

      {!collapsed ? (
        <View style={{ marginTop: spacing.sm, gap: 8 }}>
          {steps.map((step) => (
            <View key={step.id} style={styles.stepRow}>
              <MaterialCommunityIcons
                name={step.done ? 'check-circle' : step.current ? 'circle-slice-8' : 'circle-outline'}
                size={20}
                color={
                  step.done
                    ? colors.success.main
                    : step.current
                      ? colors.primary.main
                      : colors.text.secondary
                }
              />
              <Text
                variant="bodyMedium"
                style={{
                  flex: 1,
                  color: colors.text.primary,
                  textDecorationLine: step.done ? 'line-through' : 'none',
                }}
              >
                {step.label}
              </Text>
            </View>
          ))}
          {current?.onPress ? (
            <Button
              mode="contained"
              style={{ marginTop: spacing.xs }}
              onPress={() => {
                trackChecklistStepCompleted(persona, current.id);
                current.onPress?.();
              }}
            >
              {t('ftue.checklist.continue', 'Continue')}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerText: { flex: 1, minWidth: 0 },
  refreshBtn: { margin: 0 },
  refreshSpin: { width: 40, height: 40, justifyContent: 'center' },
  ring: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
