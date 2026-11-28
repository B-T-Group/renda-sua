import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  EXPORT_PROGRESS_STEPS,
  exportOrderIsStopped,
  exportOrderProgressIndex,
} from '../../utils/exportOrders/exportOrderProgress';

const DOT = 22;

function StepDot({ done, current }: { done: boolean; current: boolean }) {
  const { colors } = useTheme();
  const active = done || current;
  return (
    <View
      style={{
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: done ? colors.success.main : active ? colors.primary.main : colors.surface,
        borderWidth: active ? 0 : 2,
        borderColor: colors.border,
      }}
    >
      {done ? <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" /> : null}
      {current ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' }} /> : null}
    </View>
  );
}

function StepRow({ index, currentIndex }: { index: number; currentIndex: number }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const step = EXPORT_PROGRESS_STEPS[index];
  const done = index < currentIndex;
  const current = index === currentIndex;
  const last = index === EXPORT_PROGRESS_STEPS.length - 1;
  return (
    <View testID={`export-progress-${step.key}`} style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ alignItems: 'center' }}>
        <StepDot done={done} current={current} />
        {last ? null : (
          <View style={{ width: 2, height: 20, backgroundColor: done ? colors.success.main : colors.border }} />
        )}
      </View>
      <Text
        variant="bodyMedium"
        style={{
          color: current ? colors.text.primary : colors.text.secondary,
          fontWeight: current ? '700' : '400',
          lineHeight: DOT,
        }}
      >
        {t(`exportOrders.progress.${step.key}`, step.title)}
      </Text>
    </View>
  );
}

export function ExportOrderProgress({ status }: { status: string }) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useTranslation();
  if (exportOrderIsStopped(status)) return null;
  const currentIndex = exportOrderProgressIndex(status);
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: borderRadius.card,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.divider,
        gap: spacing.xs,
      }}
    >
      <Text variant="titleSmall">{t('exportOrders.progress.title', 'Progress')}</Text>
      <View>
        {EXPORT_PROGRESS_STEPS.map((step, index) => (
          <StepRow key={step.key} index={index} currentIndex={currentIndex} />
        ))}
      </View>
    </View>
  );
}
