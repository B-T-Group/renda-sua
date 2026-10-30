/**
 * Helper telling agents they can pick / change their preferred working slots,
 * with a link to Settings → Availability.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme/spacing';

interface Props {
  onPress: () => void;
  testID?: string;
}

export default function PreferredSlotsHint({ onPress, testID = 'preferred-slots-hint' }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.row} testID={testID}>
      <MaterialCommunityIcons name="clock-outline" size={18} color={colors.text.secondary} />
      <Text variant="bodySmall" style={[styles.text, { color: colors.text.secondary }]}>
        {t('dedicatedAgents.agent.explain.slotsHint')}
      </Text>
      <Button compact mode="text" onPress={onPress} testID={`${testID}-cta`}>
        {t('dedicatedAgents.agent.explain.slotsHintCta')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  text: { flex: 1, minWidth: 180 },
});
