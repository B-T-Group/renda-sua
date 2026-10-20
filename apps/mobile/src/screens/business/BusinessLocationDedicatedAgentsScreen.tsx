import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, FAB, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import type {
  DedicatedAgentCard,
  DedicatedPostingView,
  PickupSlot,
} from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<
  BusinessRootStackParamList,
  'BusinessLocationDedicatedAgents'
>;

export default function BusinessLocationDedicatedAgentsScreen({ route, navigation }: Props) {
  const { locationId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [agents, setAgents] = useState<DedicatedAgentCard[]>([]);
  const [postings, setPostings] = useState<DedicatedPostingView[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [slotsRes, agentsRes, postingsRes] = await Promise.all([
        dedicatedAgentsService.getPickupSlots(locationId).catch(() => null),
        dedicatedAgentsService.getDedicatedAgents(locationId).catch(() => null),
        dedicatedAgentsService.getPostings(locationId).catch(() => null),
      ]);

      if (!slotsRes) return;

      setSlots(slotsRes.slots);
      if (agentsRes) setAgents(agentsRes.assignments);
      if (postingsRes) setPostings(postingsRes.postings);
    } catch (err: any) {
      console.error('Error loading dedicated agents:', err);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (slots.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <Text>{t('dedicatedAgents.section.title', 'Dedicated agents')}</Text>
        <Text variant="bodySmall" style={{ marginTop: spacing.sm }}>
          {t('common.notAvailable', 'Not available')}
        </Text>
      </View>
    );
  }

  const enabledSlots = slots.filter((s) => s.isEnabled);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl + spacing.lg },
        ]}
      >
        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="bodySmall">
              {t(
                'dedicatedAgents.section.explainer',
                'Dedicated agents get orders when no nearby agent takes them.'
              )}
            </Text>
            <Text variant="bodySmall" style={{ marginTop: spacing.xs }}>
              {t('dedicatedAgents.section.scheduledOnly', 'Scheduled orders only.')}
            </Text>
          </Card.Content>
        </Card>

        {slots.map((slot) => {
          const slotAgents = agents.filter((a) => a.slotKey === slot.slotKey);
          const openPosting = postings.find(
            (p) => p.status === 'open' && p.slotKeys.includes(slot.slotKey)
          );

          return (
            <Card key={slot.slotKey} style={{ marginBottom: spacing.md }}>
              <Card.Content>
                <View style={styles.slotHeader}>
                  <Text variant="titleMedium">
                    {t(`dedicatedAgents.slots.${slot.slotKey}`, slot.slotKey)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                    {slot.startTime}–{slot.endTime}
                  </Text>
                </View>

                {slot.isEnabled && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text variant="bodySmall" style={{ marginBottom: spacing.sm }}>
                      {t('dedicatedAgents.slotHeader', '{{n}} agents · up to {{max}} orders', {
                        n: slotAgents.length,
                        max: 10,
                      })}
                    </Text>

                    {slotAgents.length === 0 ? (
                      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                        👤 {t('dedicatedAgents.empty', 'No dedicated agent')}
                      </Text>
                    ) : (
                      slotAgents.map((agent) => (
                        <Card key={agent.assignmentId} mode="outlined" style={{ marginBottom: spacing.sm }}>
                          <Card.Content>
                            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                              {agent.agent.firstName} {agent.agent.lastName}
                            </Text>
                            <View style={styles.chips}>
                              <Chip compact>
                                {agent.agent.isInternal
                                  ? t('dedicatedAgents.chips.type.internal', 'Internal')
                                  : t('dedicatedAgents.chips.type.independent', 'Independent')}
                              </Chip>
                              <Chip compact>
                                {t(`dedicatedAgents.chips.status.${agent.status}`, agent.status)}
                              </Chip>
                            </View>
                            <Text variant="bodySmall" style={{ marginTop: spacing.xs }}>
                              📦 {agent.activeOrders}/{agent.maxActiveOrders} · ✓{' '}
                              {agent.deliveries} · ✕ {agent.missedDeliveries}
                            </Text>
                          </Card.Content>
                        </Card>
                      ))
                    )}

                    {openPosting && (
                      <Button
                        mode="outlined"
                        onPress={() =>
                          navigation.navigate('DedicatedApplicants', {
                            locationId,
                            postingId: openPosting.id,
                          })
                        }
                        style={{ marginTop: spacing.sm }}
                      >
                        📣{' '}
                        {t(
                          'dedicatedAgents.posting.row',
                          'Posting open · {{accepted}}/{{needed}} accepted · {{n}} new',
                          {
                            accepted: openPosting.acceptedCount,
                            needed: openPosting.headcount,
                            n: openPosting.pendingApplications,
                          }
                        )}
                      </Button>
                    )}
                  </View>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>

      {enabledSlots.length > 0 && (
        <FAB
          icon="plus"
          label={t('dedicatedAgents.post', 'Post a request')}
          style={[
            styles.fab,
            {
              bottom: insets.bottom + spacing.md,
              backgroundColor: colors.primary,
            },
          ]}
          onPress={() => navigation.navigate('DedicatedPostingForm', { locationId })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  content: {
    padding: spacing.md,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
  },
});
