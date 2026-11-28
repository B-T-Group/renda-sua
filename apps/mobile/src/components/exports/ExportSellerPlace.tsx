import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

/** ISO chip + city ("CA Montreal"). City only when the country is unknown. */
export function ExportSellerPlace({
  country,
  city,
  trailing,
}: {
  country?: string | null;
  city?: string | null;
  /** Appended after the city, e.g. the country name on the seller page. */
  trailing?: string | null;
}) {
  const { colors } = useTheme();
  const text = [city, trailing].filter(Boolean).join(', ');
  if (!country && !text) return null;
  return (
    <View style={styles.row}>
      {country ? (
        <View style={[styles.code, { borderColor: colors.divider }]}>
          <Text style={[styles.codeText, { color: colors.text.secondary }]}>{country}</Text>
        </View>
      ) : null}
      {text ? (
        <Text numberOfLines={1} style={{ color: colors.text.secondary, fontSize: 12, flexShrink: 1 }}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  code: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, minWidth: 26, alignItems: 'center' },
  codeText: { fontSize: 10, fontWeight: '800' },
});
