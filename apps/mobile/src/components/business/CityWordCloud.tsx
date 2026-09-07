import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface CityWordCloudItem {
  name: string;
  count: number;
}

export interface CityWordCloudProps {
  cities: CityWordCloudItem[];
  emptyLabel: string;
}

function fontSizeFor(count: number, min: number, max: number): number {
  if (max <= min) return 22;
  const t = (count - min) / (max - min);
  return 13 + t * 22;
}

export function CityWordCloud({ cities, emptyLabel }: CityWordCloudProps) {
  const { colors, spacing, borderRadius } = useTheme();
  const layout = useMemo(() => {
    if (!cities.length) return [];
    const counts = cities.map((c) => c.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const palette = [
      colors.primary.main,
      colors.primary.dark,
      colors.secondary.main,
      colors.info.main,
      colors.success.main,
    ];
    return cities.map((city, index) => ({
      ...city,
      fontSize: fontSizeFor(city.count, min, max),
      color: palette[index % palette.length],
      opacity: max <= min ? 1 : 0.55 + ((city.count - min) / (max - min)) * 0.45,
    }));
  }, [cities, colors]);

  if (!layout.length) {
    return (
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, textAlign: 'center', paddingVertical: 40 }}
      >
        {emptyLabel}
      </Text>
    );
  }

  return (
    <View
      style={[
        styles.cloud,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          minHeight: 260,
        },
      ]}
    >
      {layout.map((city) => (
        <Text
          key={city.name}
          style={{
            color: city.color,
            opacity: city.opacity,
            fontSize: city.fontSize,
            fontWeight: '700',
            lineHeight: city.fontSize * 1.25,
            marginHorizontal: 6,
            marginVertical: 4,
          }}
        >
          {city.name}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: {
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
