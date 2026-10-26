import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { AppButton } from '../common/AppButton';
import { AppTextInput } from '../common/AppTextInput';
import { Badge } from '../common/Badge';
import { NoticeBanner } from '../common/NoticeBanner';
import { SelectionCard } from '../common/SelectionCard';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import { dedicatedAgentsAnalytics, type DedicatedAgentsPlatform } from '../../services/dedicatedAgentsAnalytics';
import {
  ADMIN_SLOT_KEYS,
  agentFullName,
  canAdvanceStep,
  canSubmitAssign,
  filterPickerAgents,
  isAgentBusy,
  isLocationQueryReady,
  isSlotEnabledAtLocation,
  keepOfferedSlots,
  mapAdminAssignError,
  mapAdminSearchError,
  toggleSlot,
  type AdminAssignStep,
} from '../../utils/adminDedicatedAssign';
import type {
  AdminAgentPickerItem,
  AdminLocationSearchItem,
  SlotKey,
} from '../../types/dedicatedAgents';

export interface AdminDedicatedAssignModalProps {
  visible: boolean;
  offline: boolean;
  onDismiss: () => void;
  /** Called after a successful assignment so the list can reload. */
  onAssigned: () => void;
}

const analyticsPlatform: DedicatedAgentsPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

/**
 * 3-step direct assign (store search, slots, agent picker), mirroring the web
 * AdminDedicatedAssignDialog. Assignments go live immediately and notify the
 * store and the agent (backend).
 */
export function AdminDedicatedAssignModal({
  visible,
  offline,
  onDismiss,
  onAssigned,
}: AdminDedicatedAssignModalProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<AdminAssignStep>(0);
  const [query, setQuery] = useState('');
  const [locations, setLocations] = useState<AdminLocationSearchItem[]>([]);
  const [locationsTruncated, setLocationsTruncated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [location, setLocation] = useState<AdminLocationSearchItem | null>(null);
  const [slots, setSlots] = useState<SlotKey[]>([]);
  const [agents, setAgents] = useState<AdminAgentPickerItem[]>([]);
  const [agentsTruncated, setAgentsTruncated] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentFilter, setAgentFilter] = useState('');
  const [agent, setAgent] = useState<AdminAgentPickerItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);
  const pickerSeq = useRef(0);

  const slotLabel = useCallback(
    (s: SlotKey) => t(`dedicatedAgents.slots.${s}`, s),
    [t]
  );

  const reset = useCallback(() => {
    searchSeq.current += 1;
    pickerSeq.current += 1;
    setStep(0);
    setQuery('');
    setLocations([]);
    setLocationsTruncated(false);
    setSearching(false);
    setLocation(null);
    setSlots([]);
    setAgents([]);
    setAgentsTruncated(false);
    setAgentFilter('');
    setAgent(null);
    setSubmitting(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (visible) {
      dedicatedAgentsAnalytics.adminAssignStarted({ platform: analyticsPlatform, role: 'admin' });
    } else {
      reset();
    }
  }, [visible, reset]);

  // Debounced store search; stale responses are dropped via the sequence counter.
  useEffect(() => {
    if (!visible || step !== 0) return;
    if (!isLocationQueryReady(query)) {
      searchSeq.current += 1;
      setLocations([]);
      setLocationsTruncated(false);
      setSearching(false);
      return;
    }
    const timer = setTimeout(() => {
      const seq = ++searchSeq.current;
      setSearching(true);
      setError(null);
      dedicatedAgentsService
        .searchAdminLocations(query.trim())
        .then((res) => {
          if (seq !== searchSeq.current) return;
          setLocations(res.locations);
          setLocationsTruncated(res.truncated);
        })
        .catch((err: unknown) => {
          if (seq !== searchSeq.current) return;
          const mapped = mapAdminSearchError(err);
          setLocations([]);
          setError(t(mapped.key, mapped.defaultMessage));
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, step, visible, t]);

  const loadAgents = useCallback(
    async (locationId: string) => {
      const seq = ++pickerSeq.current;
      setAgentsLoading(true);
      setError(null);
      try {
        const res = await dedicatedAgentsService.getAdminAgentPicker(locationId);
        if (seq !== pickerSeq.current) return;
        setAgents(res.agents);
        setAgentsTruncated(res.truncated);
      } catch (err: unknown) {
        if (seq !== pickerSeq.current) return;
        const mapped = mapAdminSearchError(err);
        setAgents([]);
        setError(t(mapped.key, mapped.defaultMessage));
      } finally {
        if (seq === pickerSeq.current) setAgentsLoading(false);
      }
    },
    [t]
  );

  const chooseLocation = (loc: AdminLocationSearchItem) => {
    // A different store invalidates the slot choice and the agent list.
    if (loc.id !== location?.id) {
      setSlots((prev) => keepOfferedSlots(prev, loc));
      setAgent(null);
      setAgents([]);
    }
    setLocation(loc);
    setError(null);
  };

  const goNext = () => {
    if (!canAdvanceStep(step, { location, slots })) {
      setError(t('common.required', 'Required'));
      return;
    }
    const next = (step + 1) as AdminAssignStep;
    setError(null);
    setStep(next);
    dedicatedAgentsAnalytics.adminAssignStep({ platform: analyticsPlatform, role: 'admin', step: next });
    if (next === 2 && location) void loadAgents(location.id);
  };

  const goBack = () => {
    if (step === 0) return;
    setError(null);
    setStep((step - 1) as AdminAssignStep);
  };

  const submit = async () => {
    if (!location || !agent || slots.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await dedicatedAgentsService.createAdminAssignment({
        locationId: location.id,
        agentId: agent.id,
        slotKeys: slots,
      });
      dedicatedAgentsAnalytics.adminAssignSucceeded({
        platform: analyticsPlatform,
        role: 'admin',
        slots: slots.length,
        isInternal: agent.isInternal,
      });
      onAssigned();
      onDismiss();
    } catch (err: unknown) {
      const mapped = mapAdminAssignError(err, { slots, location, slotLabel });
      setError(t(mapped.key, { defaultValue: mapped.defaultMessage, ...(mapped.params ?? {}) }));
      if (mapped.disabledSlots?.length) {
        // The store turned slots off after the search: stop offering them.
        const off = mapped.disabledSlots;
        setLocation((prev) =>
          prev ? { ...prev, enabledSlotKeys: prev.enabledSlotKeys.filter((s) => !off.includes(s)) } : prev
        );
        setSlots((prev) => prev.filter((s) => !off.includes(s)));
      }
      if (mapped.step !== null) {
        setStep(mapped.step);
        // Cap/duplicate counts changed under us: refresh the picker.
        if (mapped.step === 2) void loadAgents(location.id);
      }
      dedicatedAgentsAnalytics.adminAssignFailed({
        platform: analyticsPlatform,
        role: 'admin',
        step,
        code: (err as { code?: string })?.code,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAgents = useMemo(() => filterPickerAgents(agents, agentFilter), [agents, agentFilter]);
  const stepTitles = [
    t('dedicatedAgents.admin.steps.store', 'Store'),
    t('dedicatedAgents.admin.steps.slots', 'Slots'),
    t('dedicatedAgents.admin.steps.agent', 'Agent'),
  ];

  const renderLocation = ({ item }: { item: AdminLocationSearchItem }) => (
    <SelectionCard
      title={`${item.businessName} · ${item.name}`}
      subtitle={[item.address.city, item.address.state].filter(Boolean).join(', ')}
      isSelected={location?.id === item.id}
      radioMode
      onPress={() => chooseLocation(item)}
      style={{ marginBottom: spacing.xs }}
    />
  );

  const renderAgent = ({ item }: { item: AdminAgentPickerItem }) => {
    const busy = isAgentBusy(item);
    return (
      <SelectionCard
        title={agentFullName(item) || t('dedicatedAgents.admin.unnamedAgent', 'Agent')}
        subtitle={[
          item.isInternal
            ? t('dedicatedAgents.chips.type.internal', 'Internal')
            : t('dedicatedAgents.chips.type.independent', 'Independent'),
          t('dedicatedAgents.admin.agentLoad', {
            defaultValue: '{{orders}} active orders · {{stores}} stores',
            orders: item.activeOrders,
            stores: item.assignmentCount,
          }),
          !item.isInternal && item.balanceCoversOrders !== null
            ? t('dedicatedAgents.balanceShort', { defaultValue: '~{{n}} more', n: item.balanceCoversOrders })
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        isSelected={agent?.id === item.id}
        radioMode
        onPress={() => setAgent(item)}
        trailingElement={
          busy ? (
            <Badge tone="warning" label={t('dedicatedAgents.admin.busyBadge', 'Many stores')} />
          ) : undefined
        }
        style={{ marginBottom: spacing.xs }}
      />
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => {
        if (!submitting) onDismiss();
      }}
    >
      <View
        style={[
          styles.root,
          { backgroundColor: colors.pageBackground, paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={[styles.header, { padding: spacing.md, borderBottomColor: colors.divider }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.h3, { color: colors.text.primary }]} accessibilityRole="header">
              {t('dedicatedAgents.admin.assignTitle', 'Assign a dedicated agent')}
            </Text>
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('dedicatedAgents.admin.stepOf', {
                defaultValue: 'Step {{n}} of 3 · {{name}}',
                n: step + 1,
                name: stepTitles[step],
              })}
            </Text>
          </View>
          <Pressable
            onPress={onDismiss}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
            hitSlop={12}
          >
            <MaterialCommunityIcons name="close" size={24} color={colors.text.primary} />
          </Pressable>
        </View>

        <View style={[styles.body, { padding: spacing.md, gap: spacing.sm }]}>
          {offline ? (
            <NoticeBanner
              tone="warning"
              message={t('dedicatedAgents.offline', 'Offline · showing last update')}
            />
          ) : null}

          {step === 0 ? (
            <>
              <AppTextInput
                label={t('dedicatedAgents.admin.searchStore', 'Search store, business or city')}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                leadingIcon="magnify"
              />
              {!isLocationQueryReady(query) ? (
                <Text style={[typography.caption, { color: colors.text.secondary }]}>
                  {t('dedicatedAgents.admin.searchHint', 'Type at least 2 characters to search')}
                </Text>
              ) : null}
              {searching ? <ActivityIndicator style={{ marginVertical: spacing.sm }} /> : null}
              {locationsTruncated ? (
                <NoticeBanner
                  tone="info"
                  message={t('dedicatedAgents.admin.truncated', 'Showing the first results; refine the search')}
                />
              ) : null}
              {!searching && isLocationQueryReady(query) && locations.length === 0 && !error ? (
                <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
                  {t('dedicatedAgents.admin.noStoresFound', 'No stores found')}
                </Text>
              ) : null}
              <FlatList
                data={locations}
                keyExtractor={(l) => l.id}
                renderItem={renderLocation}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
              />
            </>
          ) : null}

          {step === 1 && location ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
              <Text style={[typography.subheading, { color: colors.text.primary }]}>
                {location.businessName} · {location.name}
              </Text>
              <Text style={[typography.body2, { color: colors.text.secondary }]}>
                {t('dedicatedAgents.admin.selectSlots', 'Select one or more slots')}
              </Text>
              {ADMIN_SLOT_KEYS.map((slot) => {
                const enabled = isSlotEnabledAtLocation(location, slot);
                return (
                  <SelectionCard
                    key={slot}
                    title={slotLabel(slot)}
                    subtitle={
                      enabled
                        ? undefined
                        : t('dedicatedAgents.admin.slotOff', 'The store has turned this slot off')
                    }
                    isSelected={slots.includes(slot)}
                    isDisabled={!enabled}
                    onPress={() => setSlots((prev) => toggleSlot(prev, slot, location))}
                  />
                );
              })}
            </ScrollView>
          ) : null}

          {step === 2 ? (
            <>
              <AppTextInput
                label={t('dedicatedAgents.admin.filterAgents', 'Filter agents')}
                value={agentFilter}
                onChangeText={setAgentFilter}
                autoCapitalize="none"
                autoCorrect={false}
                leadingIcon="magnify"
              />
              {agentsTruncated ? (
                <NoticeBanner
                  tone="info"
                  message={t('dedicatedAgents.admin.truncated', 'Showing the first results; refine the search')}
                />
              ) : null}
              {agentsLoading ? <ActivityIndicator style={{ marginVertical: spacing.sm }} /> : null}
              {!agentsLoading && filteredAgents.length === 0 && !error ? (
                <Text style={[typography.body2, { color: colors.text.secondary, textAlign: 'center' }]}>
                  {t('dedicatedAgents.admin.noAgentsFound', 'No agents found')}
                </Text>
              ) : null}
              <FlatList
                data={filteredAgents}
                keyExtractor={(a) => a.id}
                renderItem={renderAgent}
                keyboardShouldPersistTaps="handled"
                style={styles.list}
              />
            </>
          ) : null}

          {error ? <NoticeBanner tone="error" message={error} /> : null}
        </View>

        <View
          style={[
            styles.footer,
            { padding: spacing.md, gap: spacing.sm, borderTopColor: colors.divider },
          ]}
        >
          {step > 0 ? (
            <AppButton
              label={t('common.back', 'Back')}
              variant="outline"
              onPress={goBack}
              disabled={submitting}
              style={styles.footerBtn}
            />
          ) : null}
          {step < 2 ? (
            <AppButton
              label={t('common.next', 'Next')}
              onPress={goNext}
              disabled={!canAdvanceStep(step, { location, slots })}
              style={styles.footerBtn}
            />
          ) : (
            <AppButton
              label={t('dedicatedAgents.admin.assign', 'Assign')}
              onPress={submit}
              loading={submitting}
              disabled={!canSubmitAssign({ location, slots, agent, submitting, offline })}
              style={styles.footerBtn}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  body: { flex: 1 },
  list: { flex: 1 },
  footer: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  footerBtn: { flex: 1 },
});
