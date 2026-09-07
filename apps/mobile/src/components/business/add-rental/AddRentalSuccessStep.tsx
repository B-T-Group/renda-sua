import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { CreatedRentalItemSummary } from '../../../types/rentals';
import { useTheme } from '../../../contexts/ThemeContext';
import { PERSONA_ACCENT } from '../../../constants/personaTheme';

export interface AddRentalSuccessStepProps {
  item: CreatedRentalItemSummary;
  locationName?: string;
  savedAsDraft?: boolean;
  onBackToStudio: () => void;
  onBackToDashboard?: () => void;
  onViewItem: () => void;
  onAddAnother: () => void;
}

export function AddRentalSuccessStep({
  item,
  locationName,
  savedAsDraft = false,
  onBackToStudio,
  onBackToDashboard,
  onViewItem,
  onAddAnother,
}: AddRentalSuccessStepProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const accent = PERSONA_ACCENT.business;
  const locationSuffix = locationName
    ? t('business.rentals.wizard.success.atLocation', ' at {{location}}', {
        location: locationName,
      })
    : '';

  return (
    <View style={[styles.wrap, { padding: spacing.lg }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: accent + '18', borderRadius: borderRadius.lg },
        ]}
      >
        <MaterialCommunityIcons
          name={savedAsDraft ? 'content-save-outline' : 'clock-outline'}
          size={48}
          color={accent}
        />
      </View>
      <Text variant="headlineSmall" style={{ color: colors.text.primary, textAlign: 'center' }}>
        {savedAsDraft
          ? t('business.rentals.wizard.success.draftTitle', 'Draft saved')
          : t('business.rentals.wizard.success.title', 'Submitted for approval')}
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          color: colors.text.secondary,
          textAlign: 'center',
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        {savedAsDraft
          ? t(
              'business.rentals.wizard.success.draftBody',
              '{{name}} is saved as a draft{{location}}. Publish it when you are ready for review.',
              { name: item.name, location: locationSuffix }
            )
          : t(
              'business.rentals.wizard.success.body',
              '{{name}} is listed{{location}} and awaits review before it appears in the public catalog.',
              { name: item.name, location: locationSuffix }
            )}
      </Text>
      <Button mode="contained" onPress={onBackToDashboard ?? onViewItem} style={styles.btn}>
        {onBackToDashboard
          ? t('business.verification.backToDashboard', 'Back to dashboard')
          : t('business.rentals.wizard.success.viewItem', 'View rental')}
      </Button>
      {onBackToDashboard ? (
        <Button mode="outlined" onPress={onViewItem} style={styles.btn}>
          {t('business.rentals.wizard.success.viewItem', 'View rental')}
        </Button>
      ) : null}
      <Button mode="outlined" onPress={onAddAnother} style={styles.btn}>
        {t('business.rentals.wizard.success.addAnother', 'Add another')}
      </Button>
      <Button mode="text" onPress={onBackToStudio}>
        {t('business.rentals.wizard.success.backToStudio', 'Back to rentals')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  iconWrap: {
    alignSelf: 'center',
    padding: 16,
    marginBottom: 16,
  },
  btn: { marginBottom: 10 },
});
