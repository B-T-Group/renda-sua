/**
 * Agent Home: stores the agent is a dedicated agent for → Dedicated hub
 * (stores segment). Hidden when there are none or the call fails.
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
import { groupDedicatedHomeStores, type DedicatedHomeStore } from '../../utils/dedicatedStoresHome';

const MAX_ROWS = 3;

interface Props {
  onPress: () => void;
}

export default function DedicatedStoresHomeCard({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [stores, setStores] = useState<DedicatedHomeStore[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      dedicatedAgentsService
        .getMyAssignments()
        .then((res) => active && setStores(groupDedicatedHomeStores(res?.assignments)))
        .catch(() => active && setStores([]));
      return () => {
        active = false;
      };
    }, [])
  );

  if (stores.length === 0) return null;
  const more = stores.length - MAX_ROWS;

  return (
    <Pressable
      testID="home-dedicated-stores-card"
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.background.paper, borderRadius: borderRadius.card, borderColor: colors.divider }]}
    >
      <View style={styles.header}>
        <MaterialCommunityIcons name="storefront-outline" size={24} color={colors.primary.main} />
        <Text variant="titleSmall" style={{ flex: 1, fontWeight: '600', color: colors.text.primary }}>
          {t('dedicatedAgents.agent.homeStores.title', 'My dedicated stores')}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.secondary} />
      </View>
      {stores.slice(0, MAX_ROWS).map((s) => (
        <View key={s.locationId} style={styles.row}>
          <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1, color: colors.text.primary }}>
            {s.storeName}
          </Text>
          <Text variant="bodySmall" style={{ color: s.paused ? colors.warning?.main ?? colors.text.secondary : colors.text.secondary }}>
            {s.paused
              ? t('dedicatedAgents.agent.homeStores.paused', 'Paused')
              : s.slotKeys.map((k) => t(`dedicatedAgents.slots.${k}`, k)).join(' · ')}
          </Text>
        </View>
      ))}
      {more > 0 ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {t('dedicatedAgents.agent.homeStores.more', '+{{count}} more', { count: more })}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, marginBottom: spacing.md, gap: spacing.xs, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 32 },
});
