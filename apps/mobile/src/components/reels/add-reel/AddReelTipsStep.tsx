import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useTheme } from '@/contexts/ThemeContext';
import type { AddReelMode } from './addReelTypes';

type Tip = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
};

type Props = {
  mode: AddReelMode;
  onContinue: () => void;
};

export function AddReelTipsStep({ mode, onContinue }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const tips = mode === 'ai' ? aiTips(t) : uploadTips(t);

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xl,
        gap: spacing.sm,
      }}
    >
      <Text
        variant="titleLarge"
        style={{ color: colors.text.primary, fontWeight: '600', marginBottom: spacing.xs }}
      >
        {mode === 'ai'
          ? t('business.reels.add.aiTipsTitle', 'Tips for a great AI reel')
          : t('business.reels.add.uploadTipsTitle', 'Tips for uploading a reel')}
      </Text>
      <Text style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
        {mode === 'ai'
          ? t(
              'business.reels.add.aiTipsIntro',
              'A few minutes of prep makes a much better 8-second ad.'
            )
          : t(
              'business.reels.add.uploadTipsIntro',
              'Follow these guidelines so your clip clears review and looks great in Reels.'
            )}
      </Text>

      {tips.map((tip) => (
        <View
          key={tip.title}
          style={[
            styles.card,
            shadows.sm,
            {
              borderColor: colors.divider,
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.row}>
            <MaterialCommunityIcons name={tip.icon} size={22} color={colors.primary.main} />
            <Text
              variant="titleSmall"
              style={{
                color: colors.text.primary,
                fontWeight: '700',
                marginLeft: spacing.sm,
                flex: 1,
              }}
            >
              {tip.title}
            </Text>
          </View>
          <Text style={{ color: colors.text.secondary, marginTop: spacing.xs }}>{tip.body}</Text>
        </View>
      ))}

      <Button mode="contained" onPress={onContinue} style={{ marginTop: spacing.sm }}>
        {t('business.reels.add.continue', 'Continue')}
      </Button>
    </KeyboardAwareScrollView>
  );
}

function aiTips(t: (key: string, fallback: string) => string): Tip[] {
  return [
    {
      icon: 'image-multiple-outline',
      title: t('business.reels.add.aiTipPhotosTitle', 'Up to 3 photos from different angles'),
      body: t(
        'business.reels.add.aiTipPhotosBody',
        'Add sharp catalog photos. Up to 3 are sent as AI product references—put your best shot first.'
      ),
    },
    {
      icon: 'text-box-outline',
      title: t('business.reels.add.aiTipCopyTitle', 'Clear name and description'),
      body: t(
        'business.reels.add.aiTipCopyBody',
        'A good product name and description help the AI describe your item accurately.'
      ),
    },
    {
      icon: 'cellphone',
      title: t('business.reels.add.aiTipFormatTitle', 'Vertical 9:16, about 8 seconds'),
      body: t(
        'business.reels.add.aiTipFormatBody',
        'Fill the frame with the real product. Avoid busy promo text on the photo.'
      ),
    },
    {
      icon: 'shield-check-outline',
      title: t('business.reels.add.aiTipFaithfulTitle', 'Keep packaging faithful'),
      body: t(
        'business.reels.add.aiTipFaithfulBody',
        'AI matches your photo—no fake logos, prices, URLs, or phone numbers in the generated ad.'
      ),
    },
    {
      icon: 'lightning-bolt-outline',
      title: t('business.reels.add.aiTipTokensTitle', 'Token costs'),
      body: t(
        'business.reels.add.aiTipTokensBody',
        'Fast uses 2 tokens, Standard 8. Generation runs in the background.'
      ),
    },
  ];
}

function uploadTips(t: (key: string, fallback: string) => string): Tip[] {
  return [
    {
      icon: 'timer-outline',
      title: t('business.reels.add.uploadTipDurationTitle', '15–30 second vertical clip'),
      body: t(
        'business.reels.add.uploadTipDurationBody',
        'Shoot or pick a portrait video that clearly shows the product you select next.'
      ),
    },
    {
      icon: 'white-balance-sunny',
      title: t('business.reels.add.uploadTipQualityTitle', 'Stable lighting and focus'),
      body: t(
        'business.reels.add.uploadTipQualityBody',
        'Keep the product readable. Avoid misleading claims or unrelated footage.'
      ),
    },
    {
      icon: 'shield-account-outline',
      title: t('business.reels.add.uploadTipReviewTitle', 'Reviewed before it goes live'),
      body: t(
        'business.reels.add.uploadTipReviewBody',
        'Uploads go to moderation. You’ll get a notification when it’s approved or if it’s rejected.'
      ),
    },
  ];
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
