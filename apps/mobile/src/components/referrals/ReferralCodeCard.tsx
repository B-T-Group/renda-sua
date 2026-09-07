import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

export interface ReferralCodeCardProps {
  code: string;
  title?: string;
  helpText?: string;
  amountHint?: string;
  showShare?: boolean;
  followUpLabel?: string;
  onFollowUpPress?: () => void;
}

export function ReferralCodeCard({
  code,
  title,
  helpText,
  amountHint,
  showShare = true,
  followUpLabel,
  onFollowUpPress,
}: ReferralCodeCardProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, shadows } = useTheme();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [code]);

  const handleShare = useCallback(async () => {
    if (!code) return;
    const message = t('referrals.shareText', {
      defaultValue: 'Join Rendasua with my referral code {{code}}!',
      code,
    });
    try {
      await Share.share({ message });
    } catch {
      await handleCopy();
    }
  }, [code, handleCopy, t]);

  if (!code) return null;

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      {title ? (
        <Text
          variant="titleSmall"
          style={{ color: colors.text.primary, fontWeight: '700' }}
        >
          {title}
        </Text>
      ) : null}
      {amountHint ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: title ? 6 : 0 }}
        >
          {amountHint}
        </Text>
      ) : null}
      <Text
        variant="labelSmall"
        style={{
          color: colors.text.secondary,
          marginTop: title || amountHint ? 12 : 0,
          marginBottom: 8,
        }}
      >
        {t('referrals.yourCode', 'Your referral code')}
      </Text>
      <View
        style={[
          styles.codeRow,
          {
            borderColor: colors.divider,
            backgroundColor: colors.pageBackground,
            borderRadius: borderRadius.sm,
          },
        ]}
      >
        <Text
          variant="titleLarge"
          style={[styles.codeText, { color: colors.text.primary }]}
          selectable
        >
          {code}
        </Text>
        <IconButton
          icon={copied ? 'check' : 'content-copy'}
          size={20}
          onPress={() => void handleCopy()}
          accessibilityLabel={
            copied
              ? t('referrals.copied', 'Copied!')
              : t('referrals.copyCode', 'Copy code')
          }
        />
        {showShare ? (
          <IconButton
            icon="share-variant"
            size={20}
            onPress={() => void handleShare()}
            accessibilityLabel={t('referrals.share', 'Share')}
          />
        ) : null}
      </View>
      {helpText ? (
        <Text
          variant="bodySmall"
          style={{ color: colors.text.secondary, marginTop: 8 }}
        >
          {helpText}
        </Text>
      ) : null}
      {followUpLabel && onFollowUpPress ? (
        <Button
          mode="text"
          onPress={onFollowUpPress}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}
        >
          {followUpLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingLeft: 12,
    paddingVertical: 4,
    minHeight: 48,
  },
  codeText: {
    letterSpacing: 4,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
});
