import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Appbar, ProgressBar, Text } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';

export interface BusinessListingWizardShellProps {
  title: string;
  stepIndex: number;
  stepCount: number;
  stepLabel: string;
  progressLabel: string;
  onBack: () => void;
  onRestart?: () => void;
  subPageRow?: React.ReactNode;
  children: React.ReactNode;
}

/** Shared chrome for sale-item and rental photo wizards. */
export function BusinessListingWizardShell({
  title,
  stepIndex,
  stepCount,
  stepLabel,
  progressLabel,
  onBack,
  onRestart,
  subPageRow,
  children,
}: BusinessListingWizardShellProps) {
  const { colors } = useTheme();
  const progress = (stepIndex + 1) / stepCount;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <Appbar.Header mode="small" elevated>
        <Appbar.BackAction onPress={onBack} />
        <Appbar.Content title={title} />
        {onRestart && <Appbar.Action icon="restart" onPress={onRestart} />}
      </Appbar.Header>
      <View style={styles.progressWrap}>
        <Text variant="labelMedium" style={{ color: colors.text.secondary, marginBottom: 4 }}>
          {progressLabel}
          {' · '}
          {stepLabel}
        </Text>
        <ProgressBar progress={progress} />
        {subPageRow}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressWrap: { paddingHorizontal: 16, paddingVertical: 8 },
});
