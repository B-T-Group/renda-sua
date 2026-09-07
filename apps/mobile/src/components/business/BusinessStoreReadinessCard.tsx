import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import type { ReadinessStep } from '../../utils/businessStoreReadiness';
import { readinessPercent } from '../../utils/businessStoreReadiness';
import {
  BusinessStoreReadinessRing,
  useReadinessPercentAnim,
} from './BusinessStoreReadinessRing';

type Props = {
  steps: ReadinessStep[];
  onStepPress: (id: ReadinessStep['id']) => void;
};

const STEP_LABELS: Record<ReadinessStep['id'], { key: string; fallback: string }> = {
  logo: { key: 'business.readiness.steps.logo', fallback: 'Add a business logo' },
  hours: {
    key: 'business.readiness.steps.hours',
    fallback: 'Customize business hours',
  },
  catalog_10: {
    key: 'business.readiness.steps.catalog10Progress',
    fallback: 'Reach 10 approved products ({{current}}/{{target}})',
  },
  mm_phone: {
    key: 'business.readiness.steps.mmPhone',
    fallback: 'Confirm mobile money number',
  },
};

function StepRow({
  step,
  isCurrent,
  label,
  index,
}: {
  step: ReadinessStep;
  isCurrent: boolean;
  label: string;
  index: number;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: 80 + index * 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: 80 + index * 70,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={[styles.stepRow, { opacity, transform: [{ translateY }] }]}>
      <MaterialCommunityIcons
        name={
          step.done
            ? 'check-circle'
            : isCurrent
              ? 'circle-slice-8'
              : 'circle-outline'
        }
        size={20}
        color={
          step.done
            ? colors.success.main
            : isCurrent
              ? colors.primary.main
              : colors.text.secondary
        }
      />
      <Text
        variant="bodyMedium"
        style={{
          flex: 1,
          minWidth: 0,
          color: colors.text.primary,
          textDecorationLine: step.done ? 'line-through' : 'none',
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export function BusinessStoreReadinessCard({ steps, onStepPress }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const percent = readinessPercent(steps);
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done);
  const ringAnim = useReadinessPercentAnim(percent);
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(titleY, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [titleOpacity, titleY]);

  const labelFor = (step: ReadinessStep) => {
    const meta = STEP_LABELS[step.id];
    if (step.id === 'catalog_10') {
      return t(meta.key, meta.fallback, {
        current: step.current ?? 0,
        target: step.target ?? 10,
      });
    }
    return t(meta.key, meta.fallback);
  };

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
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        style={styles.header}
        accessibilityRole="button"
      >
        <Animated.View
          style={{
            flex: 1,
            minWidth: 0,
            opacity: titleOpacity,
            transform: [{ translateY: titleY }],
          }}
        >
          <Text
            variant="titleMedium"
            style={{ color: colors.text.primary, fontWeight: '700' }}
          >
            {t('business.readiness.title', 'Your store is {{percent}}% ready', {
              percent: ringAnim.displayPercent,
            })}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: colors.text.secondary, marginTop: 2 }}
          >
            {t('ftue.checklist.progress', '{{done}} of {{total}} complete', {
              done: doneCount,
              total: steps.length,
            })}
          </Text>
        </Animated.View>
        <BusinessStoreReadinessRing {...ringAnim} />
      </Pressable>

      {!collapsed ? (
        <View style={{ marginTop: spacing.sm, gap: 8 }}>
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              isCurrent={step.id === current?.id}
              label={labelFor(step)}
              index={index}
            />
          ))}
          {current ? (
            <Button
              mode="contained"
              style={{ marginTop: spacing.xs }}
              onPress={() => onStepPress(current.id)}
            >
              {t('business.readiness.cta', 'Continue')}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
