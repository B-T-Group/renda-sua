import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

const SIZE = 72;
const STROKE = 6;

/** How far an agent is through the objectives on one payment plan. */
export function ObjectiveProgressRing({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (clamped / 100) * circumference;
  const center = SIZE / 2;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      style={styles.wrap}
    >
      <Svg width={SIZE} height={SIZE} style={styles.ring}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.divider}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.primary.main}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
        />
      </Svg>
      <Text variant="labelLarge" style={styles.value}>
        {clamped}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: { transform: [{ rotate: '-90deg' }] },
  value: { position: 'absolute' },
});
