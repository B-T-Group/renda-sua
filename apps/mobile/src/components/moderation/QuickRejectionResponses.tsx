import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

const QUICK_RESPONSE_KEYS = [
  'imageMissing',
  'backgroundCluttered',
  'itemOutOfFocus',
  'imageUnclear',
  'uploadMoreImages',
  'imagesDoNotMatch',
  'descriptionMismatch',
  'descriptionIncomplete',
] as const;

interface QuickRejectionResponsesProps {
  value: string;
  onSelect: (response: string) => void;
}

export function QuickRejectionResponses({
  value,
  onSelect,
}: QuickRejectionResponsesProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {t('admin.items.moderation.quickResponses.title')}
      </Text>
      <View style={[styles.chips, { marginTop: spacing.xs }]}>
        {QUICK_RESPONSE_KEYS.map((key) => {
          const response = t(`admin.items.moderation.quickResponses.${key}`);
          return (
            <Chip
              key={key}
              compact
              selected={value.includes(response)}
              onPress={() => onSelect(response)}
            >
              {response}
            </Chip>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
