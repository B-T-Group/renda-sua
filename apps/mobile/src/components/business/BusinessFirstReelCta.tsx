import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { PERSONA_ACCENT } from '../../constants/personaTheme';
import { ReelComposerIllustration } from '../reels/ReelComposerIllustration';

interface Props {
  visible: boolean;
  onPress: () => void;
  onDismiss?: () => void;
}

export function BusinessFirstReelCta({ visible, onPress, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const accent = PERSONA_ACCENT.business;

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: borderRadius.lg,
          borderColor: accent + '40',
          backgroundColor: accent + '12',
        },
      ]}
      accessibilityRole="summary"
    >
      <View style={styles.row}>
        <ReelComposerIllustration size={72} />
        <View style={styles.copy}>
          <Text
            variant="titleMedium"
            style={[styles.title, { color: colors.text.primary }]}
          >
            {t(
              'business.dashboard.firstReel.title',
              'Become a content creator for your products'
            )}
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.body, { color: colors.text.secondary }]}
          >
            {t(
              'business.dashboard.firstReel.body',
              'Post your first reel — generate an 8s AI product ad, or upload a video from your library.'
            )}
          </Text>
        </View>
      </View>
      <Button
        mode="contained"
        icon="movie-open-outline"
        contentStyle={styles.ctaContent}
        buttonColor={accent}
        textColor={colors.onDark}
        style={styles.cta}
        onPress={onPress}
      >
        {t('business.dashboard.firstReel.cta', 'Create your first reel')}
      </Button>
      {onDismiss ? (
        <Button mode="text" onPress={onDismiss} textColor={colors.text.secondary}>
          {t('common.dismiss', 'Dismiss')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  copy: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '600',
  },
  body: {
    marginTop: 6,
  },
  cta: {
    alignSelf: 'stretch',
  },
  ctaContent: {
    flexDirection: 'row-reverse',
  },
});
