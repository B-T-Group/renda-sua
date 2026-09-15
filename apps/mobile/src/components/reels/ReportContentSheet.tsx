import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, RadioButton, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useContentReport } from '../../hooks/useContentReport';
import type {
  ContentReportReason,
  ContentReportSubjectType,
} from '../../services/contentReportsApi';

const REASONS: ContentReportReason[] = [
  'spam',
  'misleading',
  'inappropriate',
  'harassment',
  'intellectual_property',
  'off_platform_contact',
  'other',
];

interface Props {
  visible: boolean;
  subjectType: ContentReportSubjectType;
  subjectId: string;
  businessId?: string;
  onDismiss: () => void;
  onSubmitted?: () => void;
}

export function ReportContentSheet({
  visible,
  subjectType,
  subjectId,
  businessId,
  onDismiss,
  onSubmitted,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { report, blockMerchant, submitting, error } = useContentReport();
  const [reason, setReason] = useState<ContentReportReason>('inappropriate');
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (!visible) {
      setReason('inappropriate');
      setDetails('');
    }
  }, [visible]);

  const onSubmit = async () => {
    const ok = await report({
      subjectType,
      subjectId,
      reason,
      details: details.trim() || undefined,
    });
    if (ok) {
      onSubmitted?.();
      onDismiss();
    }
  };

  const onBlock = async () => {
    if (!businessId) return;
    const ok = await blockMerchant(businessId);
    if (ok) {
      onSubmitted?.();
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: colors.overlay }]}
        onPress={onDismiss}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              maxHeight: height * 0.85,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              ...shadows.md,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="titleLarge" style={{ padding: spacing.md }}>
            {t('reels.report.title', 'Report')}
          </Text>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.md }}>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              {t('reels.report.subtitle', 'Why are you reporting this?')}
            </Text>
            {REASONS.map((r) => (
              <RadioButton.Item
                key={r}
                label={t(`reels.report.reasons.${r}`, r)}
                value={r}
                status={reason === r ? 'checked' : 'unchecked'}
                onPress={() => setReason(r)}
              />
            ))}
            <TextInput
              mode="outlined"
              label={t('reels.report.details', 'Additional details (optional)')}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
              style={{ marginTop: spacing.sm }}
            />
            {error ? (
              <Text style={{ color: colors.error.main, marginTop: spacing.sm }}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <Button mode="contained" loading={submitting} onPress={() => void onSubmit()}>
              {t('reels.report.submit', 'Submit report')}
            </Button>
            {businessId ? (
              <Button mode="outlined" loading={submitting} onPress={() => void onBlock()}>
                {t('reels.report.blockMerchant', 'Block this store')}
              </Button>
            ) : null}
            <Button mode="text" onPress={onDismiss}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
});
