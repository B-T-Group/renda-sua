import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { HERO_AUTO_ADVANCE_MS } from '../../constants/onboarding';

export type PagedCarouselProps<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (info: { item: T; index: number; width: number }) => React.ReactElement;
  /** Page width; defaults to window width. */
  pageWidth?: number;
  autoAdvanceMs?: number | null;
  /** Stop auto-advance permanently after the first manual swipe. */
  stopAutoAdvanceOnManualScroll?: boolean;
  onIndexChange?: (index: number) => void;
  style?: StyleProp<ViewStyle>;
  showDots?: boolean;
  accessibilityLabelForIndex?: (index: number, total: number) => string;
};

export function PagedCarousel<T>({
  data,
  keyExtractor,
  renderItem,
  pageWidth,
  autoAdvanceMs = HERO_AUTO_ADVANCE_MS,
  stopAutoAdvanceOnManualScroll = true,
  onIndexChange,
  style,
  showDots = true,
  accessibilityLabelForIndex,
}: PagedCarouselProps<T>) {
  const { width: windowWidth } = useWindowDimensions();
  const width = pageWidth ?? windowWidth;
  const { colors, spacing } = useTheme();
  const listRef = useRef<FlatList<T>>(null);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);
  const draggingRef = useRef(false);
  const indexRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(!!v);
    });
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (v: boolean) => setReduceMotion(!!v)
    );
    return () => {
      mounted = false;
      if (sub && typeof (sub as { remove?: () => void }).remove === 'function') {
        (sub as { remove: () => void }).remove();
      }
    };
  }, []);

  useEffect(() => {
    if (data.length === 0) return;
    if (indexRef.current < data.length) return;
    const clamped = data.length - 1;
    indexRef.current = clamped;
    setIndex(clamped);
    onIndexChange?.(clamped);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: clamped, animated: false });
    });
  }, [data.length, onIndexChange]);

  const updateIndex = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), Math.max(0, data.length - 1));
      if (clamped === indexRef.current) return;
      indexRef.current = clamped;
      setIndex(clamped);
      onIndexChange?.(clamped);
      const label = accessibilityLabelForIndex?.(clamped, data.length);
      if (label) {
        AccessibilityInfo.announceForAccessibility?.(label);
      }
    },
    [accessibilityLabelForIndex, data.length, onIndexChange]
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const w = e.nativeEvent.layoutMeasurement.width || width;
      updateIndex(Math.round(x / w));
    },
    [updateIndex, width]
  );

  useEffect(() => {
    if (
      !autoAdvanceMs ||
      reduceMotion ||
      autoStopped ||
      data.length <= 1 ||
      draggingRef.current
    ) {
      return undefined;
    }
    const id = setInterval(() => {
      const next = (indexRef.current + 1) % data.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      updateIndex(next);
    }, autoAdvanceMs);
    return () => clearInterval(id);
  }, [autoAdvanceMs, autoStopped, data.length, reduceMotion, updateIndex]);

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width]
  );

  return (
    <View style={style}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        getItemLayout={getItemLayout}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
          if (stopAutoAdvanceOnManualScroll) setAutoStopped(true);
        }}
        onScrollEndDrag={() => {
          draggingRef.current = false;
        }}
        renderItem={({ item, index: i }) => (
          <View style={{ width }}>{renderItem({ item, index: i, width })}</View>
        )}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 50);
        }}
      />
      {showDots && data.length > 1 ? (
        <View
          style={[styles.dots, { gap: spacing.xs, marginTop: spacing.md }]}
          accessibilityRole="adjustable"
        >
          {data.map((item, i) => (
            <Pressable
              key={keyExtractor(item, i)}
              onPress={() => {
                if (stopAutoAdvanceOnManualScroll) setAutoStopped(true);
                listRef.current?.scrollToIndex({ index: i, animated: true });
                updateIndex(i);
              }}
              hitSlop={8}
              accessibilityLabel={
                accessibilityLabelForIndex?.(i, data.length) ??
                `Page ${i + 1} of ${data.length}`
              }
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === index ? colors.primary.main : colors.divider,
                  },
                ]}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
