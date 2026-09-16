import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { isExpoVideoAvailable } from '@/utils/expoVideoAvailability';

interface Props {
  uri: string;
  active: boolean;
  posterUri?: string | null;
  onMaxLoopsReached?: () => void;
}

/**
 * Plays a reel when the native binary includes expo-video.
 * Older installs (pre-reels native build) get a thumbnail + upgrade message instead of crashing.
 */
export function ReelPlayer({ uri, active, posterUri, onMaxLoopsReached }: Props) {
  if (!isExpoVideoAvailable()) {
    return <ReelPlayerUnavailable posterUri={posterUri} />;
  }

  // Lazy require so expo-video is never evaluated on binaries without ExpoVideo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ReelPlayerNative } = require('./ReelPlayerNative') as typeof import('./ReelPlayerNative');
  return (
    <ReelPlayerNative
      uri={uri}
      active={active}
      posterUri={posterUri}
      onMaxLoopsReached={onMaxLoopsReached}
    />
  );
}

function ReelPlayerUnavailable({ posterUri }: { posterUri?: string | null }) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={styles.posterPlaceholder} />
      )}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          {t(
            'reels.updateRequired',
            'Update the app to play reels on this device.'
          )}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  poster: { ...StyleSheet.absoluteFillObject },
  posterPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  bannerText: { color: '#fff', textAlign: 'center', fontSize: 14 },
});
