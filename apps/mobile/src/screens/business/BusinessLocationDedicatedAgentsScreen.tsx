import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, Alert } from 'react-native';
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
  IconButton,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import {
  extractDedicatedAgentsError,
  mapDedicatedAgentsErrorCode,
  isDedicatedAgentsFeatureHidden,
} from '../../utils/dedicatedAgentsErrors';
import { dedicatedAgentsAnalytics } from '../../services/dedicatedAgentsAnalytics';
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
  const { isOffline } = useNetworkStatus();

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [agents, setAgents] = useState<DedicatedAgentCard[]>([]);
  const [maxActiveOrders, setMaxActiveOrders] = useState(10);
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
    slotKey: SlotKey;
  } | null>(null);
  const [pickupMenuSlot, setPickupMenuSlot] = useState<SlotKey | null>(null);
  const [pickupTimeError, setPickupTimeError] = useState<{ slotKey: SlotKey; message: string } | null>(null);
  const [actionsMenuAgent, setActionsMenuAgent] = useState<string | null>(null);
  const [retryError, setRetryError] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setRetryError(false);
      const [slotsRes, agentsRes, postingsRes] = await Promise.all([
        dedicatedAgentsService.getPickupSlots(locationId).catch((e) => {
          if (isDedicatedAgentsFeatureHidden(e)) {
            setHidden(true);
          }
          return null;
        }),
        dedicatedAgentsService.getDedicatedAgents(locationId).catch((err: any) => {
          if (err?.response?.status >= 500) {
            setRetryError(true);
          }
          return null;
        }),
        dedicatedAgentsService.getPostings(locationId).catch(() => null),
      ]);

      if (!slotsRes) return;

      setSlots(slotsRes.slots);
      if (agentsRes) {
        setAgents(agentsRes.assignments);
        setMaxActiveOrders(agentsRes.maxActiveOrders);
      }
      if (postingsRes) setPostings(postingsRes.postings);

      if (!loading) {
        dedicatedAgentsAnalytics.sectionViewed({
          platform: Platform.OS as 'ios' | 'android',
          role: 'business',
          locationId,
          slotsEnabled: slotsRes.slots.filter((s) => s.isEnabled).length,
          agents: agentsRes?.assignments.length || 0,
          openPostings: postingsRes?.postings.filter((p) => p.status === 'open').length || 0,
        });
      }
    } catch (err: any) {
      console.error('Error loading dedicated agents:', err);
      if (err?.response?.status >= 500) {
        setRetryError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [locationId, loading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateSlotCapacity = (slotKey: SlotKey): number => {
    const slotAgents = agents.filter((a) => a.slotKey === slotKey && a.status === 'active' && !a.offToday);
    const capacity = slotAgents.reduce((sum, agent) => {
      const available = Math.max(
        0,
        agent.maxActiveOrders - agent.activeOrders - agent.outstandingDedicatedOffers
      );
      const capped =
        agent.balanceCoversOrders !== null ? Math.min(available, agent.balanceCoversOrders) : available;
      return sum + capped;
    }, 0);
    return capacity;
  };

  const handleToggleSlot = async (slotKey: SlotKey, enabled: boolean) => {
    if (!enabled) {
      const slotAgents = agents.filter((a) => a.slotKey === slotKey && a.status === 'active' && !a.offToday);
      if (slotAgents.length > 0) {
        setConfirmPause({ slotKey, agentsToPause: slotAgents.length });
        return;
      }
    }

    try {
      setMutating(`slot-${slotKey}`);
      await dedicatedAgentsService.updatePickupSlots(locationId, {
        slots: [{ slotKey, isEnabled: enabled }],
      });
      await loadData();

      dedicatedAgentsAnalytics.slotToggled({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        slotKey,
        enabled,
      });
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
      await dedicatedAgentsService.updatePickupSlots(locationId, {
        slots: [{ slotKey: confirmPause.slotKey, isEnabled: false }],
        confirmPauseAgents: true,
      });
      setConfirmPause(null);
      await loadData();

      dedicatedAgentsAnalytics.slotToggled({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        slotKey: confirmPause.slotKey,
        enabled: false,
        agentsPaused: confirmPause.agentsToPause,
      });
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
      setPickupTimeError(null);
      await dedicatedAgentsService.updatePickupSlots(locationId, {
        slots: [{ slotKey, pickupTime }],
      });
      await loadData();
      setPickupMenuSlot(null);

      dedicatedAgentsAnalytics.pickupTimeChanged({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        slotKey,
        time: pickupTime,
      });
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      if (code === 'pickup_time_outside_slot') {
        const slot = slots.find((s) => s.slotKey === slotKey);
        if (slot) {
          setPickupTimeError({
            slotKey,
            message: t('dedicatedAgents.errors.pickup_time_outside_slot', 'Choose a time between {{start}} and {{end}}', {
              start: slot.startTime,
              end: slot.endTime,
            }),
          });
        }
      } else {
        const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
        Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
      }
    } finally {
      setMutating(null);
    }
  };

  const handlePauseAgent = async (assignmentId: string, slotKey: SlotKey) => {
    try {
      setMutating(assignmentId);
      await dedicatedAgentsService.updateAssignment(locationId, assignmentId, {
        status: 'paused',
      });
      await loadData();
      setActionsMenuAgent(null);

      const agent = agents.find((a) => a.assignmentId === assignmentId);
      dedicatedAgentsAnalytics.agentPaused({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        slotKey,
        source: agent?.source,
        isInternal: agent?.agent.isInternal,
      });
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
    } finally {
      setMutating(null);
    }
  };

  const handleResumeAgent = async (assignmentId: string, slotKey: SlotKey) => {
    try {
      setMutating(assignmentId);
      await dedicatedAgentsService.updateAssignment(locationId, assignmentId, {
        status: 'active',
      });
      await loadData();
      setActionsMenuAgent(null);

      const agent = agents.find((a) => a.assignmentId === assignmentId);
      dedicatedAgentsAnalytics.agentResumed({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        slotKey,
        source: agent?.source,
        isInternal: agent?.agent.isInternal,
      });
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
    } finally {
      setMutating(null);
    }
  };

  const handleRemoveAgent = async (assignmentId: string, slotKey: SlotKey) => {
    try {
      setMutating(assignmentId);
      await dedicatedAgentsService.deleteAssignment(locationId, assignmentId);
      await loadData();
      setConfirmRemove(null);
      setActionsMenuAgent(null);

      const agent = agents.find((a) => a.assignmentId === assignmentId);
      dedicatedAgentsAnalytics.agentRemoved({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        slotKey,
        source: agent?.source,
        isInternal: agent?.agent.isInternal,
      });
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

  if (retryError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
          {t('dedicatedAgents.generic', 'Something went wrong')}
        </Text>
        <Button mode="contained" onPress={loadData}>
          {t('dedicatedAgents.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  const enabledSlots = slots.filter((s) => s.isEnabled);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      {isOffline && (
        <Banner
          visible
          icon="wifi-off"
          style={{ backgroundColor: colors.warningTint }}
        >
          {t('dedicatedAgents.offline', 'Offline · showing last update')}
        </Banner>
      )}
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

        {slots.map((slot) => {
          const slotAgents = agents.filter((a) => a.slotKey === slot.slotKey);
          const openPosting = postings.find(
            (p) => p.status === 'open' && p.slotKeys.includes(slot.slotKey)
          );
          const isMutating = mutating === `slot-${slot.slotKey}`;
          const pickupTimes = generatePickupTimes(slot.startTime, slot.endTime);
          const capacity = calculateSlotCapacity(slot.slotKey);
          const showCapacityWarning = slot.isEnabled && slotAgents.length > 0 && capacity === 0;

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
                    onValueChange={(enabled: any) => void handleToggleSlot(slot.slotKey, enabled)}
                    disabled={isMutating || isOffline}
                    accessibilityLabel={t(
                      slot.isEnabled ? 'dedicatedAgents.slots.turnOff' : 'dedicatedAgents.slots.turnOn',
                      slot.isEnabled ? 'Turn off slot' : 'Turn on slot'
                    )}
                  />
                </View>

                {!slot.isEnabled && slotAgents.length > 0 && (
                  <Text variant="bodySmall" style={{ marginTop: spacing.sm, color: colors.text.secondary }}>
                    {t('dedicatedAgents.slots.pausedGroup', '{{n}} paused agents', { n: slotAgents.length })}
                  </Text>
                )}

                {slot.isEnabled && (
                  <View style={{ marginTop: spacing.md }}>
                    <View style={styles.row}>
                      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                        {t('dedicatedAgents.slots.pickup', 'Pickup time')}:
                      </Text>
                      <Menu
                        visible={pickupMenuSlot === slot.slotKey}
                        onDismiss={() => setPickupMenuSlot(null)}
                        anchor={
                          <Button
                            mode="text"
                            compact
                            onPress={() => setPickupMenuSlot(slot.slotKey)}
                            disabled={isMutating || isOffline}
                            loading={isMutating}
                            accessibilityLabel={t('dedicatedAgents.accessibilityLabels.pickupTime', 'Select pickup time')}
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
                    {pickupTimeError && pickupTimeError.slotKey === slot.slotKey && (
                      <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.xs }}>
                        {pickupTimeError.message}
                      </Text>
                    )}

                    {showCapacityWarning && (
                      <Banner
                        visible
                        icon="alert"
                        style={{ marginTop: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.warningTint }}
                      >
                        {t('dedicatedAgents.fullWarning', 'No dedicated agent can take orders right now. Delivery follows normal rules.')}
                      </Banner>
                    )}

                    <Text variant="bodySmall" style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
                      {t('dedicatedAgents.slotHeader', '{{n}} agents · up to {{max}} orders', {
                        n: slotAgents.length,
                        max: capacity,
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
                                  {agent.status === 'paused' && (
                                    <Chip compact mode="outlined">
                                      {t('dedicatedAgents.chips.status.paused', 'Paused')}
                                    </Chip>
                                  )}
                                  {agent.offToday && (
                                    <Chip compact mode="outlined">
                                      {t('dedicatedAgents.chips.status.offToday', 'Off today')}
                                    </Chip>
                                  )}
                                  {agent.assignedByRendasua && (
                                    <Chip compact mode="outlined">
                                      {t('dedicatedAgents.assignedChip', 'Assigned by RendaSua')}
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
                                  <IconButton
                                    icon="dots-vertical"
                                    onPress={() => setActionsMenuAgent(agent.assignmentId)}
                                    disabled={mutating === agent.assignmentId || isOffline}
                                    accessibilityLabel={t('dedicatedAgents.accessibilityLabels.moreOptions', 'More options')}
                                  />
                                }
                              >
                                {agent.status === 'active' && (
                                  <Menu.Item
                                    title={t('dedicatedAgents.actions.pause', 'Pause')}
                                    onPress={() => handlePauseAgent(agent.assignmentId, slot.slotKey)}
                                  />
                                )}
                                {agent.status === 'paused' && (
                                  <Menu.Item
                                    title={t('dedicatedAgents.actions.resume', 'Resume')}
                                    onPress={() => handleResumeAgent(agent.assignmentId, slot.slotKey)}
                                  />
                                )}
                                <Divider />
                                <Menu.Item
                                  title={t('dedicatedAgents.actions.remove', 'Remove')}
                                  onPress={() =>
                                    setConfirmRemove({
                                      assignmentId: agent.assignmentId,
                                      name: agent.agent.firstName,
                                      slotKey: slot.slotKey,
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
              t('dedicatedAgents.removeConfirm', 'Remove {{name}} from {{slot}}?', {
                name: confirmRemove.name,
                slot: t(`dedicatedAgents.slots.${confirmRemove.slotKey}`, confirmRemove.slotKey),
              })}
          </Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setConfirmRemove(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onPress={() => confirmRemove && handleRemoveAgent(confirmRemove.assignmentId, confirmRemove.slotKey)}>
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

  const endMinutes = endH * 60 + endM;

  while (h * 60 + m < endMinutes) {
    times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 15;
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
