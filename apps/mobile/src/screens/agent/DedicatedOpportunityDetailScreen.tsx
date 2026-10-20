import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert, Modal, Pressable, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text, Snackbar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { AgentRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import type { DedicatedOpportunity } from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';
import { useProfilePhotoUpload } from '../../hooks/useProfilePhotoUpload';

type Props = NativeStackScreenProps<AgentRootStackParamList, 'DedicatedOpportunityDetail'>;

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

export default function DedicatedOpportunityDetailScreen({ route, navigation }: Props) {
  const { postingId } = route.params;
  const { t, i18n } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { pickAndUploadPhoto, uploading: uploadingPhoto } = useProfilePhotoUpload();

  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState<DedicatedOpportunity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoGateVisible, setPhotoGateVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);

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
      setSnackMessage(t('dedicatedAgents.agent.applied', 'Applied'));
      await loadData();
    } catch (err: any) {
      const errorCode = err.response?.data?.code;
      
      if (err.response?.status === 422 && errorCode === 'PROFILE_PHOTO_REQUIRED') {
        setPhotoGateVisible(true);
      } else if (errorCode === 'posting_not_open' || errorCode === 'application_closed') {
        const msg = mapDedicatedError(errorCode, t);
        setSnackMessage(msg);
        await loadData();
      } else if (errorCode === 'holds_slot' || errorCode === 'max_assignments') {
        const msg = mapDedicatedError(errorCode, t);
        setSnackMessage(msg);
        await loadData();
      } else {
        const msg = errorCode ? mapDedicatedError(errorCode, t) : t('dedicatedAgents.generic', 'Something went wrong');
        setSnackMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoSource = async (source: 'camera' | 'gallery') => {
    const success = await pickAndUploadPhoto(source);
    if (success) {
      await handleApply();
      setPhotoGateVisible(false);
    }
  };

  const handleWithdraw = () => {
    Alert.alert(
      t('common.confirm', 'Confirm'),
      t('dedicatedAgents.agent.withdrawConfirm', 'Withdraw your application?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('dedicatedAgents.agent.withdraw', 'Withdraw'),
          onPress: async () => {
            try {
              setSubmitting(true);
              await dedicatedAgentsService.withdrawApplication(postingId);
              setSnackMessage(t('dedicatedAgents.agent.withdraw', 'Withdrawn'));
              await loadData();
            } catch (err: any) {
              const errorCode = err.response?.data?.code;
              if (errorCode === 'application_not_pending') {
                const msg = mapDedicatedError(errorCode, t);
                setSnackMessage(msg);
                await loadData();
              } else {
                const msg = errorCode ? mapDedicatedError(errorCode, t) : t('dedicatedAgents.generic', 'Something went wrong');
                setSnackMessage(msg);
              }
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
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
  const dayLetters = i18n.language === 'fr' ? DAY_LETTERS_FR : DAY_LETTERS_EN;

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

            {opportunity.slots.map((slot) => {
              const iconName = SLOT_ICONS[slot.slotKey] || 'circle';
              return (
                <View key={slot.slotKey} style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name={iconName as any} size={20} color={colors.text.primary} />
                  <Text variant="titleMedium" style={{ marginLeft: spacing.xs }}>
                    {t(`dedicatedAgents.slots.${slot.slotKey}`, slot.slotKey)}{' '}
                    {slot.startTime}–{slot.endTime} · {t('dedicatedAgents.slots.pickup', 'Pickup')} {slot.pickupTime}
                  </Text>
                </View>
              );
            })}

            <View style={[styles.chips, { marginTop: spacing.md }]}>
              <Text variant="bodyMedium">{t('dedicatedAgents.agent.daysLabel', 'Days')}:</Text>
              {opportunity.daysOfWeek.map((day, idx) => (
                <Chip key={`${day}-${idx}`} compact mode="outlined" style={{ minWidth: 32 }}>
                  {dayLetters[day - 1]}
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
                💶 {t('dedicatedAgents.agent.payChip', 'Standard pay')}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {opportunity.terms ? (
          <Card>
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
                {t('dedicatedAgents.form.termsField', 'Terms / notes')}
              </Text>
              <Text variant="bodyMedium">{opportunity.terms}</Text>
            </Card.Content>
          </Card>
        ) : (
          <Card>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                {t('dedicatedAgents.agent.noTerms', 'No extra terms')}
              </Text>
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
            style={{ marginHorizontal: spacing.md }}
          >
            {t('dedicatedAgents.agent.withdraw', 'Withdraw')}
          </Button>
        )}

        {opportunity.application?.status === 'accepted' && (
          <Card style={{ margin: spacing.md }}>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: colors.primary.main, fontWeight: '600' }}>
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

      <Modal
        visible={photoGateVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoGateVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => setPhotoGateVisible(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background.paper,
                borderRadius: borderRadius.xl,
                maxHeight: screenHeight * 0.85,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="titleLarge" style={{ marginBottom: spacing.md }}>
              {t('dedicatedAgents.agent.photoGate', 'Add a profile photo to apply')}
            </Text>

            <View style={[styles.photoButtonRow, { marginBottom: spacing.lg }]}>
              <Pressable
                style={[styles.photoButton, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.card }]}
                onPress={() => handlePhotoSource('camera')}
                disabled={uploadingPhoto}
              >
                <MaterialCommunityIcons name="camera" size={32} color={colors.primary.main} />
                <Text variant="labelLarge" style={{ marginTop: spacing.xs }}>
                  {t('common.camera', 'Camera')}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.photoButton, { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.card }]}
                onPress={() => handlePhotoSource('gallery')}
                disabled={uploadingPhoto}
              >
                <MaterialCommunityIcons name="image" size={32} color={colors.primary.main} />
                <Text variant="labelLarge" style={{ marginTop: spacing.xs }}>
                  {t('common.gallery', 'Gallery')}
                </Text>
              </Pressable>
            </View>

            {uploadingPhoto && (
              <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                <ActivityIndicator size="small" />
                <Text variant="bodySmall" style={{ marginTop: spacing.xs, color: colors.text.secondary }}>
                  {t('actionLoading.upload', 'Uploading...')}
                </Text>
              </View>
            )}

            <Button mode="text" onPress={() => setPhotoGateVisible(false)} disabled={uploadingPhoto}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </Pressable>
        </Pressable>
      </Modal>

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
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: spacing.lg,
    padding: spacing.lg,
  },
  photoButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.md,
  },
  photoButton: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
  },
});
