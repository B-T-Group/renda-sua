import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Chip, IconButton, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useMainTabContentBottomPadding } from '../../hooks/useMainTabContentBottomPadding';
import type { FeedReel } from '../../services/reelsApi';
import { usePageShare } from '../../hooks/usePageShare';
import { ReportContentSheet } from './ReportContentSheet';
import { ReelCommentsSheet } from './ReelCommentsSheet';
import { setReelLike } from '../../services/reelsApi';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { resolveReelPresetLabel } from '../../utils/reelPresetLabel';

interface Props {
  reel: FeedReel;
  onBuy?: () => void;
  onAddToCart?: () => void;
  inCart?: boolean;
}

export function ReelOverlay({ reel, onBuy, onAddToCart, inCart = false }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bottomClearance = useMainTabContentBottomPadding(12);
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

  const onOpenStore = useCallback(() => {
    const nav = navigation as { navigate: (name: string, params: object) => void };
    nav.navigate('StoreDetail', { businessId: reel.business_id });
  }, [navigation, reel.business_id]);

  const buyDisabled =
    reel.purchasable === false ||
    (reel.subject_type === 'item' && !reel.inventoryItemId);
  const presetLabel = resolveReelPresetLabel(reel.prompt_preset);

  return (
    <>
      <View
        style={[styles.overlay, { paddingBottom: bottomClearance }]}
        pointerEvents="box-none"
      >
        {presetLabel ? (
          <View
            style={[styles.presetChipWrap, { top: insets.top + 12 }]}
            pointerEvents="none"
          >
            <Chip
              compact
              style={styles.presetChip}
              textStyle={styles.presetChipText}
            >
              {t(presetLabel.key, presetLabel.defaultLabel)}
            </Chip>
          </View>
        ) : null}
        <View style={[styles.rail, { bottom: bottomClearance + 72 }]}>
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
        <View style={styles.bottom} pointerEvents="box-none">
          {onBuy ? (
            <View style={styles.ctaRow}>
              <IconButton
                icon="storefront-outline"
                iconColor="#fff"
                containerColor="rgba(0,0,0,0.45)"
                size={24}
                onPress={onOpenStore}
                accessibilityLabel={t('stores.openStoreA11y', 'Open store {{name}}', {
                  name: reel.business.name,
                })}
                style={styles.sideBtn}
              />
              <Button
                mode="contained"
                onPress={onBuy}
                disabled={buyDisabled}
                style={styles.buyBtn}
                contentStyle={{ paddingHorizontal: 24 }}
              >
                {reel.purchasable === false
                  ? t('reels.notAvailableInMarket', 'Not available in your area')
                  : t('reels.buy', 'Buy')}
              </Button>
              {onAddToCart ? (
                <IconButton
                  icon={inCart ? 'cart-check' : 'cart-plus'}
                  iconColor="#fff"
                  containerColor={inCart ? colors.primary.main : 'rgba(0,0,0,0.45)'}
                  size={24}
                  onPress={onAddToCart}
                  disabled={buyDisabled}
                  accessibilityLabel={t('cart.addToCart', 'Add to cart')}
                  style={styles.sideBtn}
                />
              ) : null}
            </View>
          ) : null}
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
  presetChipWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  presetChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  presetChipText: {
    color: '#fff',
    fontSize: 12,
  },
  rail: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 20,
  },
  railBtn: { alignItems: 'center' },
  railLabel: { color: '#fff', fontSize: 12, marginTop: 4 },
  bottom: { width: '100%' },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  sideBtn: { margin: 0 },
  buyBtn: { minWidth: 160 },
});
