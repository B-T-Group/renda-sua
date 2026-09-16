import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text, Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { FeedReel } from '../../services/reelsApi';
import { BusinessFollowButton } from '../browse/BusinessFollowButton';
import { usePageShare } from '../../hooks/usePageShare';
import { ReportContentSheet } from './ReportContentSheet';
import { ReelCommentsSheet } from './ReelCommentsSheet';
import { setReelLike } from '../../services/reelsApi';
import { useClientFlags } from '../../contexts/ClientFlagsContext';

interface Props {
  reel: FeedReel;
  onBuy?: () => void;
}

export function ReelOverlay({ reel, onBuy }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { shareNative } = usePageShare();
  const [liked, setLiked] = useState(reel.liked ?? false);
  const [likeCount, setLikeCount] = useState(reel.like_count);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const { flags } = useClientFlags();

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      await setReelLike(reel.id, next);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  const onShare = () => {
    void shareNative({
      url: reel.video_url ?? '',
      title: reel.caption ?? reel.business.name,
      text: reel.caption ?? undefined,
    });
  };

  return (
    <>
      <View style={[styles.overlay, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.rail}>
          <Pressable onPress={() => void toggleLike()} style={styles.railBtn}>
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={28}
              color={liked ? colors.error.main : '#fff'}
            />
            <Text style={styles.railLabel}>{likeCount}</Text>
          </Pressable>
          {flags.reels_comments_enabled ? (
            <Pressable onPress={() => setCommentsOpen(true)} style={styles.railBtn}>
              <MaterialCommunityIcons name="comment-outline" size={28} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable onPress={onShare} style={styles.railBtn}>
            <MaterialCommunityIcons name="share-variant" size={28} color="#fff" />
          </Pressable>
          <Pressable onPress={() => setReportOpen(true)} style={styles.railBtn}>
            <MaterialCommunityIcons name="flag-outline" size={28} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.bottom}>
          <View style={styles.merchantRow}>
            <Text style={styles.merchantName}>{reel.business.name}</Text>
            <BusinessFollowButton businessId={reel.business_id} size={20} />
          </View>
          {reel.caption ? (
            <Text style={styles.caption} numberOfLines={2}>{reel.caption}</Text>
          ) : null}
          <Button
            mode="contained"
            onPress={onBuy}
            disabled={reel.purchasable === false}
            style={{ marginTop: spacing.sm }}
          >
            {reel.purchasable === false
              ? t('reels.notAvailableInMarket', 'Not available in your area')
              : t('reels.buy', 'Buy')}
          </Button>
        </View>
      </View>
      <ReportContentSheet
        visible={reportOpen}
        subjectType="reel"
        subjectId={reel.id}
        businessId={reel.business_id}
        onDismiss={() => setReportOpen(false)}
      />
      {flags.reels_comments_enabled ? (
        <ReelCommentsSheet
          visible={commentsOpen}
          reelId={reel.id}
          onDismiss={() => setCommentsOpen(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  rail: {
    position: 'absolute',
    right: 12,
    bottom: 140,
    alignItems: 'center',
    gap: 20,
  },
  railBtn: { alignItems: 'center' },
  railLabel: { color: '#fff', fontSize: 12, marginTop: 4 },
  bottom: { paddingRight: 56 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  merchantName: { color: '#fff', fontWeight: '700', fontSize: 16 },
  caption: { color: '#fff', marginTop: 4 },
});
