import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

const MAX_PLAY_THROUGH_COUNT = 2;

export interface ReelPlayerNativeProps {
  uri: string;
  active: boolean;
  posterUri?: string | null;
  preloadUri?: string | null;
  /** Fired after the reel has played through this many times (default 2). */
  onMaxLoopsReached?: () => void;
  onDoubleTap?: () => void;
}

function PreloadPlayer({ uri }: { uri: string }) {
  useVideoPlayer(uri, (player) => {
    player.pause();
  });
  return null;
}

/** Only import this file when `isExpoVideoAvailable()` is true. */
export function ReelPlayerNative({
  uri,
  active,
  preloadUri,
  onMaxLoopsReached,
  onDoubleTap,
}: ReelPlayerNativeProps) {
  const { t } = useTranslation();
  const [userPaused, setUserPaused] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const playThroughCountRef = useRef(0);
  const onMaxLoopsRef = useRef(onMaxLoopsReached);
  onMaxLoopsRef.current = onMaxLoopsReached;

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = false;
  });
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setUserPaused(false);
      playThroughCountRef.current = 0;
    }
  }, [active]);

  useEffect(() => {
    if (active && !userPaused) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, userPaused, player]);

  useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      if (!active) return;
      playThroughCountRef.current += 1;
      if (playThroughCountRef.current !== MAX_PLAY_THROUGH_COUNT) return;
      onMaxLoopsRef.current?.();
    });
    return () => sub.remove();
  }, [active, player]);

  const paused = active && userPaused;

  return (
    <Pressable
      style={styles.wrap}
      onPress={() => {
        if (!active) return;
        const now = Date.now();
        if (now - lastTapRef.current < 280) {
          lastTapRef.current = 0;
          setShowHeart(true);
          setTimeout(() => setShowHeart(false), 700);
          onDoubleTap?.();
          return;
        }
        lastTapRef.current = now;
        setTimeout(() => {
          if (lastTapRef.current !== now) return;
          setUserPaused((prev) => !prev);
        }, 280);
      }}
      accessibilityRole="button"
      accessibilityLabel={
        paused
          ? t('reels.play', 'Play')
          : t('reels.pause', 'Pause')
      }
    >
      {preloadUri && preloadUri !== uri ? <PreloadPlayer uri={preloadUri} /> : null}
      {showHeart ? (
        <Animated.View entering={ZoomIn.duration(200)} style={styles.heart} pointerEvents="none">
          <MaterialCommunityIcons name="heart" size={88} color="#fff" />
        </Animated.View>
      ) : null}
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
  heart: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
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
