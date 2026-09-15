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
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';

export default function ReelsFeedScreen() {
  const { height } = useWindowDimensions();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const bottomPad = useMainTabContentBottomPadding(8);
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
      <View style={[styles.center, { backgroundColor: colors.pageBackground, paddingBottom: bottomPad }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  if (error && !items.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, paddingBottom: bottomPad }]}>
        <Text variant="titleMedium">{t('reels.errorTitle', 'Couldn’t load reels')}</Text>
        <Text style={[styles.muted, { color: colors.text.secondary }]}>{error}</Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, paddingBottom: bottomPad }]}>
        <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: 8, textAlign: 'center' }}>
          {t('reels.emptyTitle', 'No reels yet')}
        </Text>
        <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {t('reels.empty', 'Check back soon — merchants will post short videos here.')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.black}
      contentContainerStyle={items.length ? undefined : { flexGrow: 1 }}
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
      windowSize={3}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  muted: { marginTop: 8, textAlign: 'center' },
});
