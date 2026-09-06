import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ImageLoadEventData,
} from 'react-native';
import { AppModal } from '../common/AppModal';
import { useTranslation } from 'react-i18next';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const DEFAULT_ASPECT = 1;
const THUMB_SIZE = 56;
const LIGHTBOX_HEADER = 52;
const THUMB_ROW = THUMB_SIZE + 20;

export type InventoryGalleryImage = { id: string; image_url: string };

export interface InventoryItemDetailImageGalleryProps {
  images: InventoryGalleryImage[];
  emptyLabel: string;
  itemName: string;
}

function useHeroIndex(length: number) {
  const [index, setIndex] = useState(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (length <= 1) return;
      const x = e.nativeEvent.contentOffset.x;
      const w = e.nativeEvent.layoutMeasurement.width;
      const i = Math.round(x / w);
      setIndex(Math.min(Math.max(0, i), length - 1));
    },
    [length]
  );
  return { heroIndex: index, onHeroScroll: onScroll };
}

export function InventoryItemDetailImageGallery({
  images,
  emptyLabel,
  itemName,
}: InventoryItemDetailImageGalleryProps) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [aspectById, setAspectById] = useState<Record<string, number>>({});

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxRef = useRef<FlatList<InventoryGalleryImage>>(null);
  const openIndexRef = useRef(0);
  const { heroIndex, onHeroScroll } = useHeroIndex(images.length);

  const maxHeroH = winH * 0.7;
  const activeId = images[heroIndex]?.id;
  const activeAspect = (activeId && aspectById[activeId]) || DEFAULT_ASPECT;
  const heroH = useMemo(
    () => Math.min(Math.max(winW / activeAspect, 160), maxHeroH),
    [winW, activeAspect, maxHeroH]
  );

  const rememberAspect = useCallback((id: string, width: number, height: number) => {
    if (!width || !height) return;
    const next = width / height;
    setAspectById((prev) => (prev[id] === next ? prev : { ...prev, [id]: next }));
  }, []);

  const onHeroImageLoad = useCallback(
    (id: string, e: NativeSyntheticEvent<ImageLoadEventData>) => {
      const src = e.nativeEvent.source;
      rememberAspect(id, src?.width ?? 0, src?.height ?? 0);
    },
    [rememberAspect]
  );

  const openLightbox = useCallback((index: number) => {
    openIndexRef.current = index;
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const i = openIndexRef.current;
    const id = requestAnimationFrame(() => {
      lightboxRef.current?.scrollToIndex({ index: i, animated: false });
    });
    return () => cancelAnimationFrame(id);
  }, [lightboxOpen]);

  const scrollLightboxTo = useCallback((index: number) => {
    const i = Math.min(Math.max(0, index), images.length - 1);
    setLightboxIndex(i);
    lightboxRef.current?.scrollToIndex({ index: i, animated: true });
  }, [images.length]);

  const goPrevLightbox = useCallback(() => scrollLightboxTo(lightboxIndex - 1), [lightboxIndex, scrollLightboxTo]);
  const goNextLightbox = useCallback(() => scrollLightboxTo(lightboxIndex + 1), [lightboxIndex, scrollLightboxTo]);

  const onLightboxMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const w = e.nativeEvent.layoutMeasurement.width;
      setLightboxIndex(Math.min(Math.max(0, Math.round(x / w)), images.length - 1));
    },
    [images.length]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: winW,
      offset: winW * index,
      index,
    }),
    [winW]
  );

  if (images.length === 0) {
    return (
      <View style={[styles.noImg, { backgroundColor: colors.surface }]}>
        <Text style={[typography.body2, { color: colors.text.disabled }]}>{emptyLabel}</Text>
      </View>
    );
  }

  const showDots = images.length > 1;
  const showLightboxNav = images.length > 1;
  const innerH = winH - insets.top - insets.bottom;
  const pageH = Math.max(220, innerH - LIGHTBOX_HEADER - (showLightboxNav ? THUMB_ROW : 0));

  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        decelerationRate="fast"
        data={images}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        style={{ height: heroH }}
        onMomentumScrollEnd={onHeroScroll}
        onScrollEndDrag={onHeroScroll}
        renderItem={({ item: img, index }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('public.items.detail.viewFullImage', 'View full image')}
            onPress={() => openLightbox(index)}
            style={{
              width: winW,
              height: heroH,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Image
              source={{ uri: img.image_url }}
              style={{ width: winW, height: heroH }}
              resizeMode="contain"
              onLoad={(e) => onHeroImageLoad(img.id, e)}
              accessibilityLabel={itemName}
            />
          </Pressable>
        )}
      />
      {showDots ? (
        <View style={styles.dotsRow}>
          {images.map((img, i) => (
            <View
              key={img.id}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === heroIndex ? colors.text.primary : colors.divider,
                  width: i === heroIndex ? 8 : 6,
                  height: i === heroIndex ? 8 : 6,
                  borderRadius: i === heroIndex ? 4 : 3,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      <AppModal
        visible={lightboxOpen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setLightboxOpen(false)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={[styles.modalHeader, { height: LIGHTBOX_HEADER }]}>
            <IconButton
              icon="close"
              iconColor="#fff"
              size={26}
              onPress={() => setLightboxOpen(false)}
              accessibilityLabel={t('public.items.detail.closeGallery', 'Close')}
            />
            <Text style={[typography.body2, { color: '#e5e5e5' }]}>
              {t('public.items.detail.imageCounter', '{{current}} of {{total}}', {
                current: lightboxIndex + 1,
                total: images.length,
              })}
            </Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={{ height: pageH, position: 'relative' }}>
            <FlatList
              ref={lightboxRef}
              data={images}
              keyExtractor={(i) => i.id}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              style={{ height: pageH }}
              getItemLayout={getItemLayout}
              onMomentumScrollEnd={onLightboxMomentumEnd}
              onScrollToIndexFailed={({ index: failed }) => {
                requestAnimationFrame(() => {
                  lightboxRef.current?.scrollToIndex({
                    index: failed,
                    animated: false,
                  });
                });
              }}
              renderItem={({ item: img }) => (
                <View style={[styles.lightboxPage, { width: winW, height: pageH }]}>
                  <Image
                    source={{ uri: img.image_url }}
                    style={{ width: winW, height: pageH }}
                    resizeMode="contain"
                    accessibilityLabel={itemName}
                  />
                </View>
              )}
            />
            {showLightboxNav ? (
              <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
                <IconButton
                  icon="chevron-left"
                  size={36}
                  iconColor="#fff"
                  style={[styles.sideNav, styles.sideNavLeft]}
                  onPress={goPrevLightbox}
                  disabled={lightboxIndex <= 0}
                  accessibilityLabel={t('public.items.card.prevPhoto', 'Previous photo')}
                />
                <IconButton
                  icon="chevron-right"
                  size={36}
                  iconColor="#fff"
                  style={[styles.sideNav, styles.sideNavRight]}
                  onPress={goNextLightbox}
                  disabled={lightboxIndex >= images.length - 1}
                  accessibilityLabel={t('public.items.card.nextPhoto', 'Next photo')}
                />
              </View>
            ) : null}
          </View>

          {showLightboxNav ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbStrip}
              keyboardShouldPersistTaps="handled"
            >
              {images.map((img, i) => {
                const selected = i === lightboxIndex;
                return (
                  <Pressable
                    key={img.id}
                    onPress={() => scrollLightboxTo(i)}
                    style={[
                      styles.thumbWrap,
                      {
                        borderColor: selected ? colors.primary.light : 'transparent',
                        borderWidth: selected ? 2 : 0,
                      },
                    ]}
                    accessibilityLabel={t('public.items.detail.goToPhoto', 'Go to photo {{n}}', { n: i + 1 })}
                  >
                    <Image source={{ uri: img.image_url }} style={styles.thumbImg} resizeMode="cover" />
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  noImg: { height: 200, alignItems: 'center', justifyContent: 'center' },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  dot: {},
  modalRoot: { flex: 1, backgroundColor: '#000' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  lightboxPage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideNav: { backgroundColor: 'rgba(0,0,0,0.35)' },
  sideNavLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -28,
  },
  sideNavRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -28,
  },
  thumbStrip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbImg: { width: THUMB_SIZE, height: THUMB_SIZE },
});
