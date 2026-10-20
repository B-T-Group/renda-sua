import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { AgentRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import type { DedicatedOpportunity } from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<AgentRootStackParamList, 'DedicatedOpportunityDetail'>;

export default function DedicatedOpportunityDetailScreen({ route, navigation }: Props) {
  const { postingId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState<DedicatedOpportunity | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dedicatedAgentsService.getOpportunity(postingId);
      setOpportunity(res.opportunity);
    } catch (err: any) {
      console.error('Error loading opportunity:', err);
    } finally {
      setLoading(false);
    }
  }, [postingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApply = async () => {
    try {
      setSubmitting(true);
      await dedicatedAgentsService.applyToOpportunity(postingId);
      await loadData();
    } catch (err: any) {
      console.error('Error applying:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    try {
      setSubmitting(true);
      await dedicatedAgentsService.withdrawApplication(postingId);
      await loadData();
    } catch (err: any) {
      console.error('Error withdrawing:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!opportunity) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <Text variant="titleMedium">
          {t('dedicatedAgents.agent.opp.gone', 'This opportunity is no longer available')}
        </Text>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={{ marginTop: spacing.md }}
        >
          {t('common.back', 'Back')}
        </Button>
      </View>
    );
  }

  const canApply =
    !opportunity.application &&
    opportunity.status === 'open' &&
    !opportunity.disabledReason;

  const isApplied = opportunity.application?.status === 'applied';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl + 80 },
        ]}
      >
        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="headlineSmall" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
              {opportunity.storeName}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
              📍 {opportunity.address.line1 ? `${opportunity.address.line1}, ` : ''}
              {opportunity.address.city}, {opportunity.address.state}
              {opportunity.distanceKm ? ` · ${opportunity.distanceKm.toFixed(1)} km` : ''}
            </Text>

            {opportunity.slots.map((slot) => (
              <View key={slot.slotKey} style={{ marginBottom: spacing.sm }}>
                <Text variant="titleMedium">
                  {t(`dedicatedAgents.slots.${slot.slotKey}`, slot.slotKey)}{' '}
                  {slot.startTime}–{slot.endTime}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {t('dedicatedAgents.slots.pickup', 'Pickup time')}: {slot.pickupTime}
                </Text>
              </View>
            ))}

            <View style={[styles.chips, { marginTop: spacing.md }]}>
              <Text variant="bodyMedium">📅 Days:</Text>
              {opportunity.daysOfWeek.map((day) => (
                <Chip key={day} compact>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][day - 1]}
                </Chip>
              ))}
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Text variant="bodyMedium">
                👥{' '}
                {t('dedicatedAgents.agent.spots', '{{accepted}}/{{needed}} spots filled', {
                  accepted: opportunity.acceptedCount,
                  needed: opportunity.headcount,
                })}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: spacing.xs }}>
                💶 {t('dedicatedAgents.form.payLine', 'Standard delivery pay')}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {opportunity.terms && (
          <Card>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
                {t('dedicatedAgents.form.termsField', 'Terms / notes')}
              </Text>
              <Text variant="bodyMedium">{opportunity.terms}</Text>
            </Card.Content>
          </Card>
        )}

        {opportunity.disabledReason && (
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.surfaceVariant }}>
            <Card.Content>
              <Text variant="bodyMedium">
                {t(
                  `dedicatedAgents.agent.disabled.${opportunity.disabledReason}`,
                  opportunity.disabledReason
                )}
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.background.paper,
            borderTopColor: colors.divider,
          },
        ]}
      >
        {canApply && (
          <Button
            mode="contained"
            onPress={handleApply}
            disabled={submitting}
            loading={submitting}
            style={{ marginHorizontal: spacing.md }}
          >
            {t('dedicatedAgents.agent.apply', 'Apply')}
          </Button>
        )}

        {isApplied && (
          <Button
            mode="outlined"
            onPress={handleWithdraw}
            disabled={submitting}
            loading={submitting}
            style={{ marginHorizontal: spacing.md }}
          >
            {t('dedicatedAgents.agent.withdraw', 'Withdraw')}
          </Button>
        )}

        {opportunity.application?.status === 'accepted' && (
          <Card style={{ margin: spacing.md }}>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: colors.primary, fontWeight: '600' }}>
                ✓{' '}
                {t(
                  'dedicatedAgents.agent.accepted',
                  "You're now dedicated to {{store}} ({{slot}})",
                  {
                    store: opportunity.storeName,
                    slot: t(
                      `dedicatedAgents.slots.${opportunity.slots[0]?.slotKey}`,
                      opportunity.slots[0]?.slotKey || ''
                    ),
                  }
                )}
              </Text>
            </Card.Content>
          </Card>
        )}
      </View>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});
