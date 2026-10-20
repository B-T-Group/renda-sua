import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, Alert, Pressable } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  SegmentedButtons,
  Switch,
  Text,
  Snackbar,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import type { AgentRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import type {
  DedicatedOpportunity,
  MyDedicatedAssignment,
  OpportunityIneligibleReason,
} from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';
import * as dedicatedAnalytics from '../../utils/dedicatedAgentsAnalytics';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

type Props = NativeStackScreenProps<AgentRootStackParamList, 'DedicatedHub'>;

const DAY_LETTERS_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_LETTERS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const SLOT_ICONS: Record<string, string> = {
  morning: 'weather-sunset-up',
  afternoon: 'white-balance-sunny',
  evening: 'weather-night',
};

function mapDedicatedError(code: string, t: any): string {
  const errorKey = `dedicatedAgents.errors.${code}`;
  return t(errorKey, t('dedicatedAgents.generic', 'Something went wrong'));
}

export default function DedicatedHubScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { auth } = useStore();
  const insets = useSafeAreaInsets();
  const me = auth.user;

  const isInternal = false; // Hide internal-only segment for now

  const [segment, setSegment] = useState<'opportunities' | 'stores'>(
    isInternal ? 'stores' : (route.params?.segment || 'opportunities')
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opportunities, setOpportunities] = useState<DedicatedOpportunity[]>([]);
  const [assignments, setAssignments] = useState<MyDedicatedAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gateReason, setGateReason] = useState<OpportunityIneligibleReason | null>(null);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);
  const [offTodayOptimistic, setOffTodayOptimistic] = useState<Record<string, boolean>>({});
  const [showNoAddressPrompt, setShowNoAddressPrompt] = useState(false);
  const { isOffline } = useNetworkStatus();

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (segment === 'opportunities') {
        const res = await dedicatedAgentsService.getOpportunities();
        setOpportunities(res.opportunities);
        setGateReason(null);
        setShowNoAddressPrompt(false);
        dedicatedAnalytics.trackDedicatedOpportunitiesViewed(res.opportunities.length);
      } else {
        const res = await dedicatedAgentsService.getMyAssignments();
        setAssignments(res.assignments);
        const initialOffToday: Record<string, boolean> = {};
        res.assignments.forEach(a => {
          initialOffToday[a.assignmentId] = a.offToday;
        });
        setOffTodayOptimistic(initialOffToday);
        dedicatedAnalytics.trackDedicatedMyStoresViewed(res.assignments.length);
      }
      setError(null);
    } catch (err: any) {
      const status = err.response?.status;
      const errorCode = err.response?.data?.code;
      const reason = err.response?.data?.reason;

      const { shouldShowGate, shouldHideOnError } = await import('../../utils/dedicatedAgentsErrors');
      
      // Handle 403 no_address as address prompt state, not an error
      if (status === 403 && reason === 'no_address') {
        setOpportunities([]);
        setShowNoAddressPrompt(true);
        setGateReason(null);
        setError(null);
      } else if (shouldShowGate(status, errorCode, reason)) {
        setGateReason(reason);
        setError(null);
      } else if (shouldHideOnError(status, errorCode, reason)) {
        setError(null);
      } else {
        console.error('Error loading dedicated agents data:', err);
        const msg = errorCode ? mapDedicatedError(errorCode, t) : t('dedicatedAgents.generic', 'Something went wrong');
        setError(msg);
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

  useFocusEffect(
    useCallback(() => {
      if (gateReason) {
        dedicatedAnalytics.trackDedicatedAgentGateShown(gateReason);
        loadData();
      }
    }, [gateReason, loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleOffToday = async (assignmentId: string, newValue: boolean) => {
    if (isOffline) {
      setSnackMessage(t('dedicatedAgents.offline', 'Offline · showing last update'));
      return;
    }

    const originalValue = assignments.find(a => a.assignmentId === assignmentId)?.offToday ?? false;
    
    setOffTodayOptimistic(prev => ({ ...prev, [assignmentId]: newValue }));
    dedicatedAnalytics.trackDedicatedOffTodayToggled(assignmentId, newValue);

    try {
      await dedicatedAgentsService.updateOffToday(assignmentId, { off: newValue });
    } catch (err: any) {
      setOffTodayOptimistic(prev => ({ ...prev, [assignmentId]: originalValue }));

      const errorCode = err.response?.data?.code;
      if (errorCode === 'assignment_removed') {
        dedicatedAnalytics.trackDedicatedActionConflict('toggle_off_today', 'assignment_removed');
        setSnackMessage(t('dedicatedAgents.agent.removedByStore', 'This store removed you'));
        await loadData(true);
      } else if (errorCode === 'assignment_changed') {
        dedicatedAnalytics.trackDedicatedActionConflict('toggle_off_today', 'assignment_changed');
        const msg = mapDedicatedError(errorCode, t);
        setSnackMessage(msg);
        await loadData(true);
      } else {
        const msg = errorCode ? mapDedicatedError(errorCode, t) : t('dedicatedAgents.generic', 'Something went wrong');
        setSnackMessage(msg);
      }
    }
  };

  const handleGateCTA = useCallback(() => {
    if (!gateReason) return;

    if (gateReason === 'not_verified') {
      navigation.navigate('Documents');
    } else if (gateReason === 'contract_unsigned') {
      navigation.navigate('AgentAgreement');
    } else if (gateReason === 'suspended') {
      navigation.navigate('SupportTickets');
    }
  }, [gateReason, navigation]);

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (gateReason) {
    let titleKey = '';
    let ctaKey = '';
    
    if (gateReason === 'not_verified') {
      titleKey = 'dedicatedAgents.agent.gate.not_verified';
      ctaKey = 'dedicatedAgents.agent.gate.verifyAccount';
    } else if (gateReason === 'contract_unsigned') {
      titleKey = 'dedicatedAgents.agent.gate.contract_unsigned';
      ctaKey = 'dedicatedAgents.agent.gate.sign';
    } else if (gateReason === 'suspended') {
      titleKey = 'dedicatedAgents.agent.gate.suspended';
      ctaKey = 'dedicatedAgents.agent.gate.contactSupport';
    }

    return (
      <View style={[styles.center, { backgroundColor: colors.background.default, padding: spacing.lg }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color={colors.text.secondary} />
        <Text variant="titleLarge" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
          {t(titleKey, 'Get verified to see opportunities')}
        </Text>
        <Button mode="contained" onPress={handleGateCTA} style={{ marginTop: spacing.lg }}>
          {t(ctaKey, 'Verify my account')}
        </Button>
      </View>
    );
  }

  const dayLetters = i18n.language === 'fr' ? DAY_LETTERS_FR : DAY_LETTERS_EN;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      {isOffline && (
        <View style={{ backgroundColor: colors.warning.main, padding: spacing.sm }}>
          <Text variant="bodyMedium" style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
            {t('dedicatedAgents.offline', 'Offline · showing last update')}
          </Text>
        </View>
      )}
      {!isInternal && (
        <View style={{ padding: spacing.md }}>
          <SegmentedButtons
            value={segment}
            onValueChange={(value) => setSegment(value as 'opportunities' | 'stores')}
            buttons={[
              {
                value: 'opportunities',
                label: t('dedicatedAgents.agent.opportunities', 'Dedicated opportunities'),
              },
              {
                value: 'stores',
                label: t('dedicatedAgents.agent.myStores', 'My stores'),
              },
            ]}
          />
        </View>
      )}

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
              <View style={styles.errorRow}>
                <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error.main} />
                <Text variant="bodyMedium" style={{ color: colors.error.main, flex: 1, marginLeft: spacing.sm }}>
                  {error}
                </Text>
                <Pressable onPress={() => { setError(null); loadData(); }}>
                  <Text variant="labelMedium" style={{ color: colors.primary.main }}>
                    {t('dedicatedAgents.retry', 'Retry')}
                  </Text>
                </Pressable>
              </View>
            </Card.Content>
          </Card>
        )}

        {segment === 'opportunities' ? (
          opportunities.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="storefront-outline" size={48} color={colors.text.disabled} />
              <Text variant="titleMedium" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                {t('dedicatedAgents.agent.opp.empty', 'No openings near you right now')}
              </Text>
              {showNoAddressPrompt && (
                <>
                  <Text variant="bodyMedium" style={{ marginTop: spacing.sm, textAlign: 'center', color: colors.text.secondary }}>
                    {t('dedicatedAgents.agent.opp.noAddress', 'Add your address to see stores near you')}
                  </Text>
                  <Button
                    mode="contained"
                    onPress={() => navigation.navigate('Profile')}
                    style={{ marginTop: spacing.md }}
                  >
                    {t('dedicatedAgents.agent.opp.addAddress', 'Add address')}
                  </Button>
                </>
              )}
            </View>
          ) : (
            opportunities.map((opp) => {
              const isDisabled = Boolean(opp.disabledReason);
              return (
                <Card
                  key={opp.id}
                  style={[
                    { marginBottom: spacing.md },
                    isDisabled && { opacity: 0.6, backgroundColor: colors.surfaceInput }
                  ]}
                  onPress={isDisabled ? undefined : () =>
                    navigation.navigate('DedicatedOpportunityDetail', { postingId: opp.id })
                  }
                >
                  <Card.Content>
                    <View style={styles.cardRow}>
                      <Text variant="titleMedium" style={{ fontWeight: '600', flex: 1 }}>
                        🏪 {opp.storeName}
                      </Text>
                      {isDisabled && <MaterialCommunityIcons name="lock" size={20} color={colors.text.disabled} />}
                    </View>
                    <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
                      {opp.address.city}
                      {opp.distanceKm ? ` · 📍 ${opp.distanceKm.toFixed(1)} km` : ''}
                    </Text>

                    <View style={[styles.chips, { marginTop: spacing.sm }]}>
                      {opp.slots.map((slot) => {
                        const iconName = SLOT_ICONS[slot.slotKey] || 'circle';
                        return (
                          <View key={slot.slotKey} style={styles.slotChip}>
                            <MaterialCommunityIcons name={iconName as any} size={16} color={colors.text.primary} />
                            <Text variant="labelSmall" style={{ marginLeft: 4 }}>
                              {slot.pickupTime}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <View style={[styles.chips, { marginTop: spacing.xs }]}>
                      {opp.daysOfWeek.map((day, idx) => (
                        <Chip key={`${day}-${idx}`} compact mode="outlined" style={{ minWidth: 32 }}>
                          {dayLetters[day - 1]}
                        </Chip>
                      ))}
                    </View>

                    <View style={[styles.chips, { marginTop: spacing.sm }]}>
                      <Chip compact icon={() => <MaterialCommunityIcons name="account-group" size={16} />}>
                        {t('dedicatedAgents.agent.spots', '{{accepted}}/{{needed}} spots filled', {
                          accepted: opp.acceptedCount,
                          needed: opp.headcount,
                        })}
                      </Chip>
                      <Chip compact icon={() => <MaterialCommunityIcons name="cash" size={16} />}>
                        {t('dedicatedAgents.agent.payChip', 'Standard pay')}
                      </Chip>
                    </View>

                    <View style={[styles.chips, { marginTop: spacing.xs }]}>
                      {opp.application && (
                        <Chip compact style={{ backgroundColor: colors.primarySubtle }}>
                          {t('dedicatedAgents.agent.applied', 'Applied')}
                        </Chip>
                      )}
                      {opp.termsUpdatedSinceApplied && (
                        <Chip compact style={{ backgroundColor: colors.surfaceSelected }}>
                          {t('dedicatedAgents.agent.updatedChip', 'Updated')}
                        </Chip>
                      )}
                    </View>

                    {opp.disabledReason && (
                      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.sm }}>
                        {t(`dedicatedAgents.agent.disabled.${opp.disabledReason}`, opp.disabledReason)}
                      </Text>
                    )}
                  </Card.Content>
                </Card>
              );
            })
          )
        ) : assignments.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="storefront" size={48} color={colors.text.disabled} />
            <Text variant="titleMedium" style={{ marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' }}>
              {isInternal
                ? t('dedicatedAgents.agent.stores.emptyInternal', 'RendaSua will assign you to stores')
                : t('dedicatedAgents.agent.stores.empty', 'No stores yet')}
            </Text>
            {!isInternal && (
              <Button mode="contained" onPress={() => setSegment('opportunities')}>
                {t('dedicatedAgents.agent.stores.seeOpportunities', 'See opportunities')}
              </Button>
            )}
          </View>
        ) : (
          assignments.map((assignment) => {
            const currentOffToday = offTodayOptimistic[assignment.assignmentId] ?? assignment.offToday;
            return (
              <Card key={assignment.assignmentId} style={{ marginBottom: spacing.md }}>
                <Card.Content>
                  <View style={styles.storeHeader}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                        🏪 {assignment.storeName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
                        <MaterialCommunityIcons 
                          name={SLOT_ICONS[assignment.slotKey] as any} 
                          size={16} 
                          color={colors.text.secondary} 
                        />
                        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginLeft: 4 }}>
                          {t(`dedicatedAgents.slots.${assignment.slotKey}`, assignment.slotKey)}{' '}
                          {assignment.startTime}–{assignment.endTime}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.offTodaySwitch}>
                      <Text variant="labelSmall">
                        {t('dedicatedAgents.agent.offToday', 'Off today')}
                      </Text>
                      <Switch
                        value={currentOffToday}
                        onValueChange={(value) =>
                          handleToggleOffToday(assignment.assignmentId, value)
                        }
                      />
                    </View>
                  </View>

                  <View style={[styles.chips, { marginTop: spacing.sm }]}>
                    {assignment.status === 'active' && !currentOffToday && (
                      <Chip compact style={{ backgroundColor: colors.successTint }}>
                        {t('dedicatedAgents.chips.status.active', 'Active')}
                      </Chip>
                    )}
                    {assignment.status === 'paused' && (
                      <Chip compact>
                        {t('dedicatedAgents.agent.pausedByStore', 'Paused by the store')}
                      </Chip>
                    )}
                    {currentOffToday && (
                      <Chip compact style={{ backgroundColor: colors.surfaceSelected }}>
                        {t('dedicatedAgents.agent.offToday', 'Off today')}
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
            );
          })
        )}
      </ScrollView>

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage(null)}
        duration={3000}
      >
        {snackMessage}
      </Snackbar>
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
