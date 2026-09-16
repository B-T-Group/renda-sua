import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { ReelComposerIllustration } from '@/components/reels/ReelComposerIllustration';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useTheme } from '@/contexts/ThemeContext';
import type { AddReelMode } from './addReelTypes';

type Props = {
  mode: AddReelMode | null;
  tokenLabel: string;
  onSelectMode: (mode: AddReelMode) => void;
  onBuyTokens: () => void;
  onContinue: () => void;
  showBuyTokens: boolean;
};

export function AddReelModeStep({
  mode,
  tokenLabel,
  onSelectMode,
  onBuyTokens,
  onContinue,
  showBuyTokens,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Animated.View style={[styles.hero, { opacity: fade }]}>
        <ReelComposerIllustration size={96} />
        <Text
          variant="titleLarge"
          style={{ color: colors.text.primary, fontWeight: '600', textAlign: 'center' }}
        >
          {t('business.reels.add.modeTitle', 'How do you want to create this reel?')}
        </Text>
        <Text style={{ color: colors.text.secondary, textAlign: 'center' }}>
          {t(
            'business.reels.add.modeSubtitle',
            'Generate an 8s AI product ad, or upload a 15–30s video from your library.'
          )}
        </Text>
        <Text style={{ color: colors.primary.main, fontWeight: '600' }}>{tokenLabel}</Text>
        {showBuyTokens ? (
          <Button mode="text" compact onPress={onBuyTokens}>
            {t('business.reels.add.buyTokens', 'Buy reel tokens')}
          </Button>
        ) : null}
      </Animated.View>

      <ModeCard
        selected={mode === 'ai'}
        icon="auto-fix"
        title={t('business.reels.add.modeAiTitle', 'AI generated')}
        body={t(
          'business.reels.add.modeAiBody',
          'Create an 8-second vertical ad from a product photo. Uses reel tokens (Fast 2 · Standard 8).'
        )}
        onPress={() => onSelectMode('ai')}
      />
      <ModeCard
        selected={mode === 'upload'}
        icon="video-plus-outline"
        title={t('business.reels.add.modeUploadTitle', 'Upload existing video')}
        body={t(
          'business.reels.add.modeUploadBody',
          'Upload a 15–30s video featuring your product. Free, then reviewed before it appears in Reels.'
        )}
        onPress={() => onSelectMode('upload')}
      />

      <Button mode="contained" disabled={!mode} onPress={onContinue}>
        {t('business.reels.add.continue', 'Continue')}
      </Button>
    </KeyboardAwareScrollView>
  );
}

function ModeCard({
  selected,
  icon,
  title,
  body,
  onPress,
}: {
  selected: boolean;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
  onPress: () => void;
}) {
  const { colors, spacing, borderRadius, shadows } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: selected ? colors.primary.main : colors.divider,
          backgroundColor: selected ? colors.primary.main + '12' : colors.surface,
          borderRadius: borderRadius.lg ?? 16,
          padding: spacing.md,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={selected ? colors.primary.main : colors.text.secondary}
        />
        <Text
          variant="titleMedium"
          style={{
            color: colors.text.primary,
            fontWeight: '700',
            marginLeft: spacing.sm,
            flex: 1,
          }}
        >
          {title}
        </Text>
        {selected ? (
          <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary.main} />
        ) : null}
      </View>
      <Text style={{ color: colors.text.secondary, marginTop: spacing.xs }}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, marginBottom: 4 },
  card: { borderWidth: 1.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
});
