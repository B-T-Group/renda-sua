import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from '@/components/layout/KeyboardAwareScrollView';
import { useTheme } from '@/contexts/ThemeContext';
import type { ReelAiPreset } from '@/services/merchantReelsApi';
import {
  REEL_AI_VEO_TIERS,
  type ReelAiVeoTier,
} from '@/utils/reelAiTokenCost';

type Props = {
  presets: ReelAiPreset[];
  presetId: string | null;
  prompt: string;
  caption: string;
  tier: ReelAiVeoTier;
  tokenCost: number;
  canAfford: boolean;
  canGenerate: boolean;
  busy: boolean;
  onPresetId: (id: string) => void;
  onPrompt: (value: string) => void;
  onCaption: (value: string) => void;
  onTier: (tier: ReelAiVeoTier) => void;
  onGenerate: () => void;
  onBuyTokens: () => void;
};

export function AddReelAiSettingsStep({
  presets,
  presetId,
  prompt,
  caption,
  tier,
  tokenCost,
  canAfford,
  canGenerate,
  busy,
  onPresetId,
  onPrompt,
  onCaption,
  onTier,
  onGenerate,
  onBuyTokens,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const promptRequired = presetId === 'custom';

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.xl,
        gap: spacing.md,
      }}
    >
      <Text variant="titleLarge" style={{ color: colors.text.primary, fontWeight: '600' }}>
        {t('business.reels.add.settingsTitle', 'Style and model')}
      </Text>
      <Text style={{ color: colors.text.secondary }}>
        {t(
          'business.reels.add.settingsSubtitle',
          'Choose an ad style, optional direction, and model quality—then generate.'
        )}
      </Text>

      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {t('business.reels.add.style', 'Ad style')}
      </Text>
      <View style={styles.chips}>
        {presets.map((preset) => (
          <Chip
            key={preset.id}
            selected={presetId === preset.id}
            onPress={() => onPresetId(preset.id)}
            style={{ marginBottom: 8 }}
          >
            {t(preset.labelKey, preset.defaultLabel)}
          </Chip>
        ))}
      </View>

      <TextInput
        mode="outlined"
        label={
          promptRequired
            ? t('business.reels.add.promptRequired', 'Direction (required)')
            : t('business.reels.add.prompt', 'Optional direction')
        }
        value={prompt}
        onChangeText={onPrompt}
        maxLength={200}
      />
      <TextInput
        mode="outlined"
        label={t('business.reels.add.caption', 'Caption (optional)')}
        value={caption}
        onChangeText={onCaption}
        maxLength={2200}
      />

      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {t('business.reels.add.model', 'Model quality')}
      </Text>
      <View style={styles.chips}>
        {REEL_AI_VEO_TIERS.map((option) => (
          <Chip
            key={option}
            selected={tier === option}
            onPress={() => onTier(option)}
            style={{ marginBottom: 8 }}
          >
            {t(`business.reels.add.tier.${option}`, option)}
          </Chip>
        ))}
      </View>
      <Text style={{ color: colors.text.secondary }}>
        {t('business.reels.add.tokenCost', 'Uses {{count}} tokens', { count: tokenCost })}
      </Text>

      {canAfford ? (
        <Button
          mode="contained"
          loading={busy}
          disabled={busy || !canGenerate}
          onPress={onGenerate}
          icon="auto-fix"
        >
          {t('business.reels.add.generate', 'Generate AI ad (8s)')}
        </Button>
      ) : (
        <Button mode="contained" onPress={onBuyTokens} icon="ticket-confirmation-outline">
          {t('business.reels.add.buyTokens', 'Buy reel tokens')}
        </Button>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
