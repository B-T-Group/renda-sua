import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Chip,
  Switch,
  Text,
} from 'react-native-paper';
import { ConfirmActionDialog } from '@/components/dialogs/ConfirmActionDialog';
import { useTheme } from '@/contexts/ThemeContext';
import { useMerchantReels } from '@/hooks/business/useMerchantReels';
import type { BusinessRootStackParamList } from '@/navigation/types';
import type { MerchantReel } from '@/services/merchantReelsApi';

type Props = {
  itemId: string;
  onMessage?: (message: string) => void;
};

export function ItemDetailReelsSection({ itemId, onMessage }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, typography, borderRadius } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const { reels, loading, mutatingId, load, setActive } = useMerchantReels({
    subjectType: 'item',
    subjectId: itemId,
  });
  const [hideTarget, setHideTarget] = useState<MerchantReel | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load])
  );

  const onToggle = useCallback(
    async (reel: MerchantReel, next: boolean) => {
      if (!next) {
        setHideTarget(reel);
        return;
      }
      try {
        await setActive(reel.id, true);
        onMessage?.(
          t('business.reels.mine.shown', 'Reel is visible in Reels again')
        );
      } catch (err: unknown) {
        onMessage?.(
          err instanceof Error
            ? err.message
            : t('business.reels.mine.activeError', 'Could not update reel visibility')
        );
      }
    },
    [onMessage, setActive, t]
  );

  const confirmHide = useCallback(async () => {
    if (!hideTarget) return;
    const id = hideTarget.id;
    setHideTarget(null);
    try {
      await setActive(id, false);
      onMessage?.(t('business.reels.mine.hidden', 'Reel hidden from Reels'));
    } catch (err: unknown) {
      onMessage?.(
        err instanceof Error
          ? err.message
          : t('business.reels.mine.activeError', 'Could not update reel visibility')
      );
    }
  }, [hideTarget, onMessage, setActive, t]);

  return (
    <View style={[styles.section, { marginTop: spacing.lg }]}>
      <View style={styles.header}>
        <Text
          style={[typography.subtitle1, { color: colors.text.primary, flex: 1 }]}
        >
          {t('business.reels.itemDetail.title', 'Product reels')}
        </Text>
        <Button
          mode="outlined"
          compact
          icon="plus"
          onPress={() =>
            navigation.navigate('BusinessAddReel', {
              subjectType: 'item',
              subjectId: itemId,
            })
          }
        >
          {t('business.reels.itemDetail.create', 'Create')}
        </Button>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.md }} />
      ) : reels.length === 0 ? (
        <View
          style={[
            styles.empty,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <Text style={[typography.body2, { color: colors.text.secondary }]}>
            {t(
              'business.reels.itemDetail.empty',
              'No reels for this product yet. Create one to appear in the Reels feed.'
            )}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
        >
          {reels.map((reel) => (
            <ReelMiniCard
              key={reel.id}
              reel={reel}
              mutating={mutatingId === reel.id}
              onToggle={(next) => void onToggle(reel, next)}
              colors={colors}
              spacing={spacing}
              typography={typography}
              borderRadius={borderRadius}
              t={t}
            />
          ))}
        </ScrollView>
      )}

      <ConfirmActionDialog
        visible={!!hideTarget}
        title={t('business.reels.mine.hideTitle', 'Hide from Reels?')}
        message={t(
          'business.reels.mine.hideBody',
          'Shoppers will no longer see this reel in the feed. You can show it again anytime.'
        )}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={t('business.reels.mine.hideConfirm', 'Hide')}
        destructive
        loading={mutatingId === hideTarget?.id}
        onDismiss={() => setHideTarget(null)}
        onConfirm={() => void confirmHide()}
      />
    </View>
  );
}

function ReelMiniCard(props: {
  reel: MerchantReel;
  mutating: boolean;
  onToggle: (next: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
  typography: ReturnType<typeof useTheme>['typography'];
  borderRadius: ReturnType<typeof useTheme>['borderRadius'];
  t: (key: string, fallback: string) => string;
}) {
  const { reel, mutating, onToggle, colors, spacing, typography, borderRadius, t } =
    props;
  const live =
    reel.processing_status === 'ready' && reel.moderation_status === 'approved';
  const active = reel.is_active !== false;
  const label = live
    ? active
      ? t('business.reels.mine.statusLive', 'Live')
      : t('business.reels.mine.statusHidden', 'Hidden')
    : reel.processing_status === 'failed'
      ? t('business.reels.mine.statusFailed', 'Failed')
      : t('business.reels.mine.statusProcessing', 'Processing');

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.sm,
        },
      ]}
    >
      {reel.thumbnail_url ? (
        <Image source={{ uri: reel.thumbnail_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.divider }]} />
      )}
      <Chip compact style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}>
        {label}
      </Chip>
      {live ? (
        <View style={[styles.toggle, { marginTop: spacing.xs }]}>
          <Text style={[typography.caption, { color: colors.text.secondary, flex: 1 }]}>
            {active
              ? t('business.reels.mine.showOnFeed', 'Visible in Reels')
              : t('business.reels.mine.hiddenFromFeed', 'Hidden from Reels')}
          </Text>
          <Switch value={active} disabled={mutating} onValueChange={onToggle} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {},
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { borderWidth: 1, marginTop: 8 },
  card: { width: 148, borderWidth: 1 },
  thumb: { width: '100%', height: 180, borderRadius: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
