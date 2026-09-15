import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useReelsFeed } from '../../hooks/useReelsFeed';
import { ReelPlayer } from '../../components/reels/ReelPlayer';
import { ReelOverlay } from '../../components/reels/ReelOverlay';
import { recordReelView, type FeedReel } from '../../services/reelsApi';
import { useTheme } from '../../contexts/ThemeContext';

export default function ReelsFeedScreen() {
  const { height } = useWindowDimensions();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { items, loading, error, loadMore, refresh, sessionId } = useReelsFeed();
  const [activeIndex, setActiveIndex] = useState(0);
  const viewStartRef = useRef<number>(Date.now());

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const top = viewableItems.find((v) => v.isViewable);
      if (top?.index != null) {
        const prev = activeIndex;
        if (prev !== top.index && items[prev]) {
          const elapsed = Date.now() - viewStartRef.current;
          void recordReelView(items[prev].id, elapsed, sessionId);
        }
        setActiveIndex(top.index);
        viewStartRef.current = Date.now();
      }
    },
    [activeIndex, items, sessionId]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FeedReel; index: number }) => (
      <View style={{ height, backgroundColor: '#000' }}>
        {item.video_url ? (
          <ReelPlayer uri={item.video_url} active={index === activeIndex} posterUri={item.thumbnail_url} />
        ) : null}
        <ReelOverlay
          reel={item}
          onBuy={() => {
            if (item.subject_type === 'item') {
              (navigation as { navigate: (n: string, p: object) => void }).navigate(
                'InventoryItemDetail',
                { inventoryItemId: item.subject_id }
              );
            }
          }}
        />
      </View>
    ),
    [activeIndex, height, navigation]
  );

  if (loading && !items.length) {
    return (
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (error && !items.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      pagingEnabled
      snapToInterval={height}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      refreshing={loading}
      onRefresh={refresh}
      ListEmptyComponent={
        <View style={[styles.center, { height }]}>
          <Text style={{ color: '#fff' }}>
            {t('reels.empty', 'No reels yet. Check back soon!')}
          </Text>
        </View>
      }
      windowSize={3}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
