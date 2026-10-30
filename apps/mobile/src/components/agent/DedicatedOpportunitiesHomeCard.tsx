/**
 * Agent Home: "X delivery opportunities near you" → Dedicated hub
 * (opportunities segment). Uses the existing opportunities endpoint; hidden
 * when there are none or the agent isn't eligible / the call fails.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme/spacing';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';

interface Props {
  onPress: () => void;
}

export default function DedicatedOpportunitiesHomeCard({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [count, setCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      dedicatedAgentsService
        .getOpportunities()
        .then((res) => {
          if (!active) return;
          const open = (res?.opportunities ?? []).filter((o) => !o.disabledReason && !o.application);
          setCount(open.length);
        })
        .catch(() => active && setCount(null));
      return () => {
        active = false;
      };
    }, [])
  );

  if (!count) return null;

  return (
    <Pressable
      testID="home-dedicated-opportunities-card"
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: colors.primarySubtle ?? colors.background.paper, borderRadius: borderRadius.card },
      ]}
    >
      <MaterialCommunityIcons name="briefcase-search-outline" size={28} color={colors.primary.main} />
      <View style={styles.body}>
        <Text variant="titleSmall" style={{ fontWeight: '600', color: colors.text.primary }}>
          {t('dedicatedAgents.agent.homeCard.title', { count })}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('dedicatedAgents.agent.homeCard.subtitle')}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  body: { flex: 1 },
});
