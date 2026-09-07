import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal } from './AppModal';
import { useTheme } from '../../contexts/ThemeContext';

export type LightboxImage = { id?: string; image_url: string };

export interface ImageLightboxProps {
  visible: boolean;
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const SWIPE_THRESHOLD = 56;

function clampIndex(next: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, next), length - 1);
}

/**
 * Index-driven lightbox — renders `images[index]` directly (no FlatList paging).
 * Avoids RN Modal + paging scroll races that always landed on the wrong page.
 */
export function ImageLightbox({
  visible,
  images,
  index,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const { t } = useTranslation();
  const { typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const indexRef = useRef(index);
  const imagesLenRef = useRef(images.length);

  const headerH = 52;
  const pageH = Math.max(220, winH - insets.top - insets.bottom - headerH);
  const safeIndex = clampIndex(index, images.length);
  const current = images[safeIndex];
  const showNav = images.length > 1;

  useEffect(() => {
    indexRef.current = safeIndex;
  }, [safeIndex]);

  useEffect(() => {
    imagesLenRef.current = images.length;
  }, [images.length]);

  const goTo = useCallback(
    (next: number) => {
      const i = clampIndex(next, imagesLenRef.current);
      indexRef.current = i;
      onIndexChange(i);
    },
    [onIndexChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (!showNav) return;
          if (g.dx <= -SWIPE_THRESHOLD) goTo(indexRef.current + 1);
          else if (g.dx >= SWIPE_THRESHOLD) goTo(indexRef.current - 1);
        },
      }),
    [goTo, showNav]
  );

  if (!visible) return null;

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={[styles.header, { height: headerH }]}>
          <Text style={[typography.caption, { color: '#fff', marginLeft: 12 }]}>
            {images.length > 0 ? `${safeIndex + 1} / ${images.length}` : ''}
          </Text>
          <IconButton
            icon="close"
            iconColor="#fff"
            onPress={onClose}
            accessibilityLabel={t('common.cancel', 'Close')}
          />
        </View>

        <View
          style={{ height: pageH, position: 'relative', width: winW }}
          {...panResponder.panHandlers}
        >
          <View style={[styles.page, { width: winW, height: pageH }]}>
            {current?.image_url ? (
              <Image
                key={`${current.id ?? 'img'}-${safeIndex}-${current.image_url}`}
                source={{ uri: current.image_url }}
                style={{ width: winW, height: pageH }}
                resizeMode="contain"
              />
            ) : null}
          </View>

          {showNav ? (
            <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
              <Pressable
                onPress={() => goTo(safeIndex - 1)}
                disabled={safeIndex <= 0}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.sideNavBtn,
                  styles.sideNavLeft,
                  { opacity: safeIndex <= 0 ? 0.35 : pressed ? 0.75 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(
                  'business.rentals.catalog.prevPhoto',
                  'Previous photo'
                )}
              >
                <MaterialCommunityIcons name="chevron-left" size={32} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => goTo(safeIndex + 1)}
                disabled={safeIndex >= images.length - 1}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.sideNavBtn,
                  styles.sideNavRight,
                  {
                    opacity:
                      safeIndex >= images.length - 1 ? 0.35 : pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t(
                  'business.rentals.catalog.nextPhoto',
                  'Next photo'
                )}
              >
                <MaterialCommunityIcons name="chevron-right" size={32} color="#fff" />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  page: { justifyContent: 'center', alignItems: 'center' },
  sideNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  sideNavLeft: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -22,
  },
  sideNavRight: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -22,
  },
});
