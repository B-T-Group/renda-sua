import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Switch,
  Text,
  Banner,
  Portal,
  Dialog,
  Menu,
  Divider,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import {
  extractDedicatedAgentsError,
  mapDedicatedAgentsErrorCode,
  isDedicatedAgentsFeatureHidden,
} from '../../utils/dedicatedAgentsErrors';
import type {
  DedicatedAgentCard,
  DedicatedPostingView,
  PickupSlot,
  SlotKey,
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
  const [hidden, setHidden] = useState(false);

  const [mutating, setMutating] = useState<string | null>(null);
  const [confirmPause, setConfirmPause] = useState<{
    slotKey: SlotKey;
    agentsToPause: number;
  } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{
    assignmentId: string;
    name: string;
  } | null>(null);
  const [pickupMenuSlot, setPickupMenuSlot] = useState<SlotKey | null>(null);
  const [actionsMenuAgent, setActionsMenuAgent] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [slotsRes, agentsRes, postingsRes] = await Promise.all([
        dedicatedAgentsService.getPickupSlots(locationId).catch((e) => {
          if (isDedicatedAgentsFeatureHidden(e)) {
            setHidden(true);
          }
          return null;
        }),
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

  const handleToggleSlot = async (slotKey: SlotKey, enabled: boolean) => {
    if (!enabled) {
      const slotAgents = agents.filter((a) => a.slotKey === slotKey && a.status !== 'off_today');
      if (slotAgents.length > 0) {
        setConfirmPause({ slotKey, agentsToPause: slotAgents.length });
        return;
      }
    }

    try {
      setMutating(`slot-${slotKey}`);
      await dedicatedAgentsService.updatePickupSlot(locationId, slotKey, {
        isEnabled: enabled,
      });
      await loadData();
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      if (code === 'slot_has_dedicated_agents' && err.response?.data?.agentsToPause) {
        setConfirmPause({
          slotKey,
          agentsToPause: err.response.data.agentsToPause,
        });
        await loadData();
        return;
      }
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
    } finally {
      setMutating(null);
    }
  };

  const handleConfirmPause = async () => {
    if (!confirmPause) return;

    try {
      await dedicatedAgentsService.updatePickupSlot(
        locationId,
        confirmPause.slotKey,
        { isEnabled: false },
        true
      );
      setConfirmPause(null);
      await loadData();
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
      setConfirmPause(null);
    }
  };

  const handleUpdatePickupTime = async (slotKey: SlotKey, pickupTime: string) => {
    try {
      setMutating(`slot-${slotKey}`);
      await dedicatedAgentsService.updatePickupSlot(locationId, slotKey, { pickupTime });
      await loadData();
      setPickupMenuSlot(null);
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
    } finally {
      setMutating(null);
    }
  };

  const handlePauseAgent = async (assignmentId: string) => {
    try {
      setMutating(assignmentId);
      await dedicatedAgentsService.pauseAssignment(locationId, assignmentId);
      await loadData();
      setActionsMenuAgent(null);
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
    } finally {
      setMutating(null);
    }
  };

  const handleResumeAgent = async (assignmentId: string) => {
    try {
      setMutating(assignmentId);
      await dedicatedAgentsService.resumeAssignment(locationId, assignmentId);
      await loadData();
      setActionsMenuAgent(null);
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
    } finally {
      setMutating(null);
    }
  };

  const handleRemoveAgent = async (assignmentId: string) => {
    try {
      setMutating(assignmentId);
      await dedicatedAgentsService.removeAssignment(locationId, assignmentId);
      await loadData();
      setConfirmRemove(null);
      setActionsMenuAgent(null);
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
    } finally {
      setMutating(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (hidden || slots.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
          {t('dedicatedAgents.section.title', 'Dedicated agents')}
        </Text>
        <Text variant="bodySmall" style={{ marginTop: spacing.sm, color: colors.text.secondary }}>
          {t('common.notAvailable', 'Not available')}
        </Text>
      </View>
    );
  }

  const enabledSlots = slots.filter((s) => s.isEnabled);
  const atCapacity = agents.length >= 10;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
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

        {atCapacity && (
          <Banner
            visible
            icon="alert-circle"
            style={{ marginBottom: spacing.md, backgroundColor: colors.warningTint }}
          >
            {t(
              'dedicatedAgents.atCapacity',
              'You have 10 dedicated agents. To add more, remove one first.'
            )}
          </Banner>
        )}

        {slots.map((slot) => {
          const slotAgents = agents.filter((a) => a.slotKey === slot.slotKey);
          const openPosting = postings.find(
            (p) => p.status === 'open' && p.slotKeys.includes(slot.slotKey)
          );
          const isMutating = mutating === `slot-${slot.slotKey}`;
          const pickupTimes = generatePickupTimes(slot.startTime, slot.endTime);

          return (
            <Card key={slot.slotKey} style={{ marginBottom: spacing.md }}>
              <Card.Content>
                <View style={styles.slotHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">
                      {t(`dedicatedAgents.slots.${slot.slotKey}`, slot.slotKey)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                      {slot.startTime}–{slot.endTime}
                    </Text>
                  </View>
                  <Switch
                    value={slot.isEnabled}
                    onValueChange={(enabled) => handleToggleSlot(slot.slotKey, enabled)}
                    disabled={isMutating}
                  />
                </View>

                {slot.isEnabled && (
                  <View style={{ marginTop: spacing.md }}>
                    <View style={styles.row}>
                      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                        {t('dedicatedAgents.pickupTime', 'Pickup time')}:
                      </Text>
                      <Menu
                        visible={pickupMenuSlot === slot.slotKey}
                        onDismiss={() => setPickupMenuSlot(null)}
                        anchor={
                          <Button
                            mode="text"
                            compact
                            onPress={() => setPickupMenuSlot(slot.slotKey)}
                            disabled={isMutating}
                          >
                            {slot.pickupTime || slot.startTime}
                          </Button>
                        }
                      >
                        {pickupTimes.map((time) => (
                          <Menu.Item
                            key={time}
                            title={time}
                            onPress={() => handleUpdatePickupTime(slot.slotKey, time)}
                          />
                        ))}
                      </Menu>
                    </View>

                    <Text variant="bodySmall" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
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
                            <View style={styles.row}>
                              <View style={{ flex: 1 }}>
                                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                                  {agent.agent.firstName} {agent.agent.lastName}
                                </Text>
                                <View style={styles.chips}>
                                  <Chip compact>
                                    {agent.agent.isInternal
                                      ? t('dedicatedAgents.chips.type.internal', 'Internal')
                                      : t('dedicatedAgents.chips.type.independent', 'Independent')}
                                  </Chip>
                                  {agent.status === 'off_today' && (
                                    <Chip compact mode="outlined">
                                      {t('dedicatedAgents.chips.offToday', 'Off today')}
                                    </Chip>
                                  )}
                                </View>
                                <Text variant="bodySmall" style={{ marginTop: spacing.xs }}>
                                  📦 {agent.activeOrders}/{agent.maxActiveOrders} · ✓{' '}
                                  {agent.deliveries} · ✕ {agent.missedDeliveries}
                                </Text>
                              </View>
                              <Menu
                                visible={actionsMenuAgent === agent.assignmentId}
                                onDismiss={() => setActionsMenuAgent(null)}
                                anchor={
                                  <Button
                                    mode="text"
                                    compact
                                    onPress={() => setActionsMenuAgent(agent.assignmentId)}
                                    disabled={mutating === agent.assignmentId}
                                  >
                                    ⋮
                                  </Button>
                                }
                              >
                                {agent.status === 'active' && (
                                  <Menu.Item
                                    title={t('dedicatedAgents.pause', 'Pause')}
                                    onPress={() => handlePauseAgent(agent.assignmentId)}
                                  />
                                )}
                                {agent.status === 'paused' && (
                                  <Menu.Item
                                    title={t('dedicatedAgents.resume', 'Resume')}
                                    onPress={() => handleResumeAgent(agent.assignmentId)}
                                  />
                                )}
                                <Divider />
                                <Menu.Item
                                  title={t('dedicatedAgents.remove', 'Remove')}
                                  onPress={() =>
                                    setConfirmRemove({
                                      assignmentId: agent.assignmentId,
                                      name: agent.agent.firstName,
                                    })
                                  }
                                />
                              </Menu>
                            </View>
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

        {enabledSlots.length > 0 && (
          <Button
            mode="contained"
            onPress={() => navigation.navigate('DedicatedPostingForm', { locationId })}
            icon="plus"
            style={{ marginTop: spacing.md }}
          >
            {t('dedicatedAgents.post', 'Post a request')}
          </Button>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={!!confirmPause} onDismiss={() => setConfirmPause(null)}>
          <Dialog.Title>
            {confirmPause &&
              t('dedicatedAgents.slots.offConfirm', 'Turn off {{slot}}? {{n}} dedicated agents will be paused.', {
                slot: t(`dedicatedAgents.slots.${confirmPause.slotKey}`, confirmPause.slotKey),
                n: confirmPause.agentsToPause,
              })}
          </Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setConfirmPause(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onPress={handleConfirmPause}>
              {t('common.confirm', 'Confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={!!confirmRemove} onDismiss={() => setConfirmRemove(null)}>
          <Dialog.Title>
            {confirmRemove &&
              t('dedicatedAgents.removeConfirm', 'Remove {{name}}?', {
                name: confirmRemove.name,
              })}
          </Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setConfirmRemove(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onPress={() => confirmRemove && handleRemoveAgent(confirmRemove.assignmentId)}>
              {t('common.confirm', 'Confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

function generatePickupTimes(start: string, end: string): string[] {
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);

  const times: string[] = [];
  let h = startH;
  let m = startM;

  while (h < endH || (h === endH && m <= endM)) {
    times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 30;
    if (m >= 60) {
      h += 1;
      m = 0;
    }
  }

  return times;
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
  row: {
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
});
