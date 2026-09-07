import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, TextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import { useTheme } from '../../../contexts/ThemeContext';
import type { UseAddItemFormResult } from '../../../hooks/business/useAddItemForm';

export interface AddItemNameStepProps {
  form: UseAddItemFormResult;
  busy: boolean;
  onContinue: () => void;
}

export function AddItemNameStep({ form, busy, onContinue }: AddItemNameStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={styles.content}
      wrapAvoidingView={false}
    >
      <Text variant="bodyMedium" style={[styles.hint, { color: colors.text.secondary }]}>
        {t(
          'business.onboarding.firstSale.create.hint',
          'We fill details from your photos automatically. Edit anything before continuing.'
        )}
      </Text>

      {form.sugLoading ? (
        <View style={[styles.analyzingRow, { backgroundColor: colors.primaryTint }]}>
          <ActivityIndicator size="small" color={colors.primary.main} style={styles.analyzingSpinner} />
          <Text variant="labelMedium" style={{ color: colors.primary.main }}>
            {t('business.onboarding.firstSale.create.aiWorking', 'Analyzing your image…')}
          </Text>
        </View>
      ) : form.aiFilled ? (
        <Text
          variant="labelMedium"
          style={[styles.aiBanner, { color: colors.primary.main, backgroundColor: colors.primaryTint }]}
        >
          {t(
            'business.onboarding.firstSale.create.aiFilledBanner',
            'Filled from your photos — edit anything'
          )}
        </Text>
      ) : null}

      {form.sugError ? (
        <Text variant="bodySmall" style={[styles.sugError, { color: colors.error.main }]}>
          {form.sugError}
        </Text>
      ) : null}

      <TextInput
        label={`${t('business.onboarding.firstSale.create.name', 'Name')} *`}
        value={form.name}
        onChangeText={form.setName}
        mode="outlined"
        style={styles.field}
        autoFocus={!form.sugLoading}
      />

      <TextInput
        label={t('business.onboarding.firstSale.create.description', 'Description')}
        value={form.description}
        onChangeText={form.setDescription}
        mode="outlined"
        multiline
        numberOfLines={6}
        style={[styles.field, styles.description]}
        contentStyle={styles.descriptionContent}
      />

      <Button
        mode="contained"
        disabled={busy || !form.nameComplete}
        onPress={onContinue}
        style={{ marginTop: spacing.sm }}
      >
        {t('business.onboarding.firstSale.upload.continue', 'Continue')}
      </Button>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  hint: { marginBottom: 12 },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  analyzingSpinner: { marginRight: 8 },
  aiBanner: {
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sugError: { marginBottom: 8 },
  field: { marginBottom: 10 },
  description: { minHeight: 140 },
  descriptionContent: { minHeight: 112, textAlignVertical: 'top' },
});
