import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { formatAdminDateTime } from '../../utils/formatAdminDateTime';
import type { AdminReferredBy } from '../../types/adminUsers';

export interface AdminReferralMetaProps {
  referralCode?: string;
  referredBy?: AdminReferredBy | null;
  createdAt?: string;
  onApply?: () => void;
  showReferral?: boolean;
}

export function AdminReferralMeta({
  referralCode,
  referredBy,
  createdAt,
  onApply,
  showReferral = true,
}: AdminReferralMetaProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();
  const [copied, setCopied] = useState(false);
  const createdLabel = formatAdminDateTime(createdAt);

  const handleCopy = useCallback(async () => {
    if (!referralCode) return;
    try {
      await Clipboard.setStringAsync(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [referralCode]);

  return (
    <View style={[styles.wrap, { marginTop: spacing.sm }]}>
      {createdLabel ? (
        <Text
          style={[typography.caption, { color: colors.text.secondary }]}
          numberOfLines={1}
        >
          {t('admin.users.createdAt', 'Created {{date}}', { date: createdLabel })}
        </Text>
      ) : null}
      {showReferral ? (
        <View style={styles.row}>
          <View style={[styles.codeBlock, { minWidth: 0, flex: 1 }]}>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('admin.referrals.code', 'Referral code')}
            </Text>
            <View style={styles.codeRow}>
              <Text
                style={[typography.subtitle2, { color: colors.text.primary, letterSpacing: 1.2 }]}
                numberOfLines={1}
              >
                {referralCode || t('admin.referrals.noCode', 'No referral code')}
              </Text>
              {referralCode ? (
                <IconButton
                  icon={copied ? 'check' : 'content-copy'}
                  size={18}
                  onPress={handleCopy}
                  accessibilityLabel={t('admin.referrals.copyCode', 'Copy code')}
                  style={styles.copyBtn}
                />
              ) : null}
            </View>
          </View>
          {referredBy ? (
            <Text
              style={[typography.caption, { color: colors.text.secondary, flex: 1, minWidth: 0 }]}
              numberOfLines={2}
            >
              {t('admin.referrals.referredBy', 'Referred by {{name}}', {
                name: referredBy.name,
              })}
            </Text>
          ) : onApply ? (
            <Button
              mode="outlined"
              compact
              onPress={onApply}
              style={styles.applyBtn}
              contentStyle={styles.applyContent}
            >
              {t('admin.referrals.apply', 'Apply referral')}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  codeBlock: { gap: 2 },
  codeRow: { flexDirection: 'row', alignItems: 'center' },
  copyBtn: { margin: 0 },
  applyBtn: { minHeight: 44, justifyContent: 'center' },
  applyContent: { minHeight: 44 },
});
