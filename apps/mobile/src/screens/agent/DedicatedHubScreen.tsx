import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  FAB,
  SegmentedButtons,
  Switch,
  Text,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { AgentRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import type {
  DedicatedOpportunity,
  MyDedicatedAssignment,
} from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AgentRootStackParamList, 'DedicatedHub'>;

export default function DedicatedHubScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [segment, setSegment] = useState<'opportunities' | 'stores'>(
    route.params?.segment || 'opportunities'
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState<DedicatedOpportunity[]>([]);
  const [assignments, setAssignments] = useState<MyDedicatedAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (segment === 'opportunities') {
        const res = await dedicatedAgentsService.getOpportunities();
        setOpportunities(res.opportunities);
      } else {
        const res = await dedicatedAgentsService.getMyAssignments();
        setAssignments(res.assignments);
      }
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        setError(null);
      } else {
        console.error('Error loading dedicated agents data:', err);
        setError(t('dedicatedAgents.generic', 'Something went wrong'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [segment, t]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleOffToday = async (assignmentId: string, off: boolean) => {
    try {
      await dedicatedAgentsService.updateOffToday(assignmentId, { off });
      await loadData();
    } catch (err: any) {
      console.error('Error toggling off-today:', err);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      <View style={{ padding: spacing.md }}>
        <SegmentedButtons
          value={segment}
          onValueChange={(value) => setSegment(value as 'opportunities' | 'stores')}
          buttons={[
            {
              value: 'opportunities',
              label: t('dedicatedAgents.agent.opportunities', 'Opportunities'),
            },
            {
              value: 'stores',
              label: t('dedicatedAgents.agent.myStores', 'My stores'),
            },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {error && (
          <Card style={{ marginBottom: spacing.md }}>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: colors.error }}>
                {error}
              </Text>
            </Card.Content>
          </Card>
        )}

        {segment === 'opportunities' ? (
          opportunities.length === 0 ? (
            <View style={styles.empty}>
              <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
                {t('dedicatedAgents.agent.opp.empty', 'No openings near you right now')}
              </Text>
            </View>
          ) : (
            opportunities.map((opp) => (
              <Card
                key={opp.id}
                style={{ marginBottom: spacing.md }}
                onPress={() =>
                  navigation.navigate('DedicatedOpportunityDetail', { postingId: opp.id })
                }
              >
                <Card.Content>
                  <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
                    🏪 {opp.storeName}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
                    {opp.address.city}
                    {opp.distanceKm ? ` · ${opp.distanceKm.toFixed(1)} km` : ''}
                  </Text>

                  <View style={styles.chips}>
                    {opp.slots.map((slot) => (
                      <Chip key={slot.slotKey} compact>
                        {t(`dedicatedAgents.slots.${slot.slotKey}`, slot.slotKey)} {slot.pickupTime}
                      </Chip>
                    ))}
                  </View>

                  <View style={[styles.chips, { marginTop: spacing.xs }]}>
                    <Chip compact>
                      {t('dedicatedAgents.agent.spots', '{{accepted}}/{{needed}} spots filled', {
                        accepted: opp.acceptedCount,
                        needed: opp.headcount,
                      })}
                    </Chip>
                    {opp.application && (
                      <Chip compact mode="flat" style={{ backgroundColor: colors.primaryContainer }}>
                        {opp.application.status === 'applied'
                          ? t('dedicatedAgents.agent.applied', 'Applied')
                          : opp.application.status}
                      </Chip>
                    )}
                    {opp.termsUpdatedSinceApplied && (
                      <Chip compact style={{ backgroundColor: colors.tertiaryContainer }}>
                        {t('dedicatedAgents.agent.updatedChip', 'Updated')}
                      </Chip>
                    )}
                  </View>
                </Card.Content>
              </Card>
            ))
          )
        ) : assignments.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
              {t('dedicatedAgents.agent.stores.empty', 'No stores yet')}
            </Text>
            <Button mode="outlined" onPress={() => setSegment('opportunities')}>
              {t('dedicatedAgents.agent.stores.seeOpportunities', 'See opportunities')}
            </Button>
          </View>
        ) : (
          assignments.map((assignment) => (
            <Card key={assignment.assignmentId} style={{ marginBottom: spacing.md }}>
              <Card.Content>
                <View style={styles.storeHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                      🏪 {assignment.storeName}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
                      {t(`dedicatedAgents.slots.${assignment.slotKey}`, assignment.slotKey)}{' '}
                      {assignment.startTime}–{assignment.endTime}
                    </Text>
                  </View>

                  <View style={styles.offTodaySwitch}>
                    <Text variant="labelSmall">
                      {t('dedicatedAgents.agent.offToday', 'Off today')}
                    </Text>
                    <Switch
                      value={assignment.offToday}
                      onValueChange={(value) =>
                        handleToggleOffToday(assignment.assignmentId, value)
                      }
                    />
                  </View>
                </View>

                <View style={[styles.chips, { marginTop: spacing.sm }]}>
                  {assignment.status === 'paused' && (
                    <Chip compact>
                      {t('dedicatedAgents.agent.pausedByStore', 'Paused by the store')}
                    </Chip>
                  )}
                  {assignment.source === 'superuser_assign' && (
                    <Chip compact mode="outlined">
                      {t('dedicatedAgents.assignedChip', 'Assigned by RendaSua')}
                    </Chip>
                  )}
                </View>

                <Text variant="bodyMedium" style={{ marginTop: spacing.sm }}>
                  📦{' '}
                  {t('dedicatedAgents.load', '{{active}}/{{max}} orders', {
                    active: assignment.activeOrders,
                    max: assignment.maxActiveOrders,
                  })}
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  offTodaySwitch: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
