import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';

export interface ReelPlayerNativeProps {
  uri: string;
  active: boolean;
  posterUri?: string | null;
}

/** Only import this file when `isExpoVideoAvailable()` is true. */
export function ReelPlayerNative({ uri, active }: ReelPlayerNativeProps) {
  const { t } = useTranslation();
  const [userPaused, setUserPaused] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!active) {
      setUserPaused(false);
    }
  }, [active]);

  useEffect(() => {
    if (active && !userPaused) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, userPaused, player]);

  const paused = active && userPaused;

  return (
    <Pressable
      style={styles.wrap}
      onPress={() => {
        if (!active) return;
        setUserPaused((prev) => !prev);
      }}
      accessibilityRole="button"
      accessibilityLabel={
        paused
          ? t('reels.play', 'Play')
          : t('reels.pause', 'Pause')
      }
    >
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      {paused ? (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.playBadge}>
            <MaterialCommunityIcons name="play" size={48} color="#fff" />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, width: '100%', height: '100%' },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
});
