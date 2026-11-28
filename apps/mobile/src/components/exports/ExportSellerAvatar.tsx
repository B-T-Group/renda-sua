import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { exportSellerMonogram, exportSellerTint } from '../../utils/exportSellers';

export interface ExportSellerAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: number;
}

/** Location logo on a white rounded plate, or a monogram on a non-purple tint when missing or broken. */
export function ExportSellerAvatar({ name, logoUrl, size = 56 }: ExportSellerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const radius = Math.round(size * 0.22);
  if (logoUrl && !failed) {
    return (
      <View
        testID="export-seller-logo"
        style={[styles.plate, { width: size, height: size, borderRadius: radius }]}
      >
        <Image
          source={{ uri: logoUrl }}
          onError={() => setFailed(true)}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={{ width: size - 8, height: size - 8 }}
        />
      </View>
    );
  }
  return (
    <View
      testID="export-seller-monogram"
      style={[
        styles.plate,
        { width: size, height: size, borderRadius: radius, backgroundColor: exportSellerTint(name), borderWidth: 0 },
      ]}
    >
      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: Math.round(size * 0.36) }}>
        {exportSellerMonogram(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D8DEE8',
    overflow: 'hidden',
  },
});
