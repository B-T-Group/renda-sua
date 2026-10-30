import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Alert, Modal, Pressable, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Portal, Text, Snackbar } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { AgentRootStackParamList } from '../../navigation/AgentRootNavigator';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import type { DedicatedOpportunity } from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';
import { useProfilePhotoUpload } from '../../hooks/useProfilePhotoUpload';
import { mapDedicatedError, dedicatedApiError } from '../../utils/dedicatedAgentsErrors';
import * as dedicatedAnalytics from '../../utils/dedicatedAgentsAnalytics';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useSlotPreferences } from '../../hooks/useSlotPreferences';
import { missingPreferredSlots } from '../../utils/slotPrefs';
import { formatKmSuffix } from '../../utils/formatKm';
import PreferredSlotsHint from '../../components/agent/PreferredSlotsHint';

type Props = NativeStackScreenProps<AgentRootStackParamList, 'DedicatedOpportunityDetail'>;

// Day letters now come from i18n locale keys: common.dayLetters.M, etc.

const SLOT_ICONS: Record<string, string> = {
  morning: 'weather-sunset-up',
  afternoon: 'white-balance-sunny',
  evening: 'weather-night',
};

export default function DedicatedOpportunityDetailScreen({ route, navigation }: Props) {
  const { postingId } = route.params;
  const { t, i18n } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  // No onSuccess: handlePhotoSource re-applies itself (a second apply here
  // used to race it).
  const { pickAndUploadPhoto, uploading: uploadingPhoto } = useProfilePhotoUpload();

  const [loading, setLoading] = useState(true);
  const [opportunity, setOpportunity] = useState<DedicatedOpportunity | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [photoGateVisible, setPhotoGateVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const { isOffline } = useNetworkStatus();
  // #594 addendum AC-P14: Apply needs all of the posting's slots preferred.
  const slotPrefs = useSlotPreferences();
  
  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }
      setError(null);
      const res = await dedicatedAgentsService.getOpportunity(postingId);
      setOpportunity(res.opportunity);
    } catch (err: any) {
      console.error('Error loading opportunity:', err);
      const { status } = dedicatedApiError(err);
      if (status === 404) {
        setError(t('dedicatedAgents.agent.noLongerAvailable', 'This opportunity is no longer available'));
      } else {
        setError(t('dedicatedAgents.generic', 'Something went wrong'));
      }
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  }, [postingId, t]);

  useEffect(() => {
    loadData();
    // Track opportunity opened when component mounts
    if (postingId) {
      dedicatedAnalytics.trackDedicatedOpportunityOpened(postingId, 'hub');
    }
  }, [loadData, postingId]);

  const handleApply = async () => {
    if (isOffline) {
      setSnackMessage(t('dedicatedAgents.offline', 'Offline · showing last update'));
      return;
    }
    try {
      dedicatedAnalytics.trackDedicatedApplyTapped(postingId);
      setSubmitting(true);
      await dedicatedAgentsService.applyToOpportunity(postingId);
      dedicatedAnalytics.trackDedicatedApplySucceeded(postingId, opportunity?.storeName || 'Unknown');
      setSnackMessage(t('dedicatedAgents.agent.appliedSnackbar', 'Application submitted'));
      await loadData(true);
    } catch (err: any) {
      const { status, code: errorCode } = dedicatedApiError(err);

      if (status === 422 && errorCode === 'PROFILE_PHOTO_REQUIRED') {
        dedicatedAnalytics.trackDedicatedPhotoGateShown('profile_photo_required');
        setPhotoGateVisible(true);
      } else if (errorCode === 'posting_not_open' || errorCode === 'application_closed') {
        const msg = mapDedicatedError(errorCode, t);
        setSnackMessage(msg);
        await loadData(true);
      } else if (errorCode === 'holds_slot' || errorCode === 'max_assignments') {
        const msg = mapDedicatedError(errorCode, t);
        setSnackMessage(msg);
        await loadData(true);
      } else if (status === 404) {
        setSnackMessage(t('dedicatedAgents.agent.noLongerAvailable', 'This opportunity is no longer available'));
      } else if (status === 403 && errorCode === 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE') {
        setSnackMessage(err?.message || t('dedicatedAgents.generic', 'Something went wrong'));
      } else {
        const msg = errorCode ? mapDedicatedError(errorCode, t) : t('dedicatedAgents.generic', 'Something went wrong');
        setSnackMessage(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handlePhotoSource = async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
      dedicatedAnalytics.trackDedicatedPhotoGateCameraOpened();
    } else {
      dedicatedAnalytics.trackDedicatedPhotoGateGalleryOpened();
    }
    setUploadError(null);
    const upload = await pickAndUploadPhoto(source);
    if (!upload.success) {
      if (!upload.canceled) {
        setUploadError(upload.error || t('dedicatedAgents.agent.photoError', 'Failed to upload photo'));
      }
      return;
    }

    dedicatedAnalytics.trackDedicatedPhotoGateCompleted();
    
    // Try to apply again after successful upload
    try {
      setSubmitting(true);
      await dedicatedAgentsService.applyToOpportunity(postingId);
      dedicatedAnalytics.trackDedicatedApplySucceeded(postingId, opportunity?.storeName || 'Unknown');
      setSnackMessage(t('dedicatedAgents.agent.appliedSnackbar', 'Application submitted'));
      setPhotoGateVisible(false);
      await loadData(true);
    } catch (err: any) {
      const errorCode = dedicatedApiError(err).code;
      const msg = errorCode ? mapDedicatedError(errorCode, t) : t('dedicatedAgents.generic', 'Something went wrong');
      setUploadError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryPhotoApply = () => {
    setUploadError(null);
    // Let user pick photo again
  };

  const handleWithdraw = () => {
    if (isOffline) {
      setSnackMessage(t('dedicatedAgents.offline', 'Offline · showing last update'));
      return;
    }
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
              dedicatedAnalytics.trackDedicatedApplicationWithdrawn(postingId);
              setSnackMessage(t('dedicatedAgents.agent.withdrawnSnackbar', 'Application withdrawn'));
              await loadData(true);
            } catch (err: any) {
              const errorCode = dedicatedApiError(err).code;
              if (errorCode === 'application_not_pending') {
                const msg = mapDedicatedError(errorCode, t);
                setSnackMessage(msg);
                await loadData(true);
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

  if (notFound) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <MaterialCommunityIcons 
          name="alert-circle" 
          size={48} 
          color={colors.text.disabled} 
        />
        <Text variant="titleMedium" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
          {t('dedicatedAgents.agent.opp.gone', 'This opportunity is no longer available')}
        </Text>
        <Button mode="outlined" onPress={() => navigation.goBack()}>
          {t('common.back', 'Back')}
        </Button>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <MaterialCommunityIcons 
          name="wifi-off" 
          size={48} 
          color={colors.text.disabled} 
        />
        <Text variant="titleMedium" style={{ marginTop: spacing.md, marginBottom: spacing.lg }}>
          {t('dedicatedAgents.agent.noLongerAvailable', 'This opportunity is no longer available')}
        </Text>
        <Text variant="bodyMedium" style={{ marginBottom: spacing.lg, color: colors.text.secondary }}>
          {error}
        </Text>
        <Button mode="outlined" onPress={() => loadData(true)}>
          {t('dedicatedAgents.retry', 'Retry')}
        </Button>
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

  const isPostingOpen = opportunity.status === 'open';
  const isFilled = !isPostingOpen;
  
  const missingSlots = missingPreferredSlots(opportunity.slots, slotPrefs.prefs);
  const canApply =
    !opportunity.application &&
    isPostingOpen &&
    !opportunity.disabledReason;

  const isApplied = opportunity.application?.status === 'applied';
  const dayLetters = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'].map((key) =>
    t(`common.dayLetters.${key}`, key)
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      {isOffline && (
        <View style={{ backgroundColor: colors.warning.main, padding: spacing.sm }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
            {t('dedicatedAgents.offline', 'Offline · showing last update')}
          </Text>
        </View>
      )}
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
            <Text
              variant="bodyMedium"
              style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
              testID="opp-detail-explainer"
            >
              {t('dedicatedAgents.agent.explain.detail')}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
              📍 {opportunity.address.line1 ? `${opportunity.address.line1}, ` : ''}
              {opportunity.address.city}, {opportunity.address.state}
              {formatKmSuffix(opportunity.distanceKm)}
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

        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <PreferredSlotsHint onPress={() => navigation.navigate('AgentAvailability')} />
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
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.surfaceInput }}>
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
        {isFilled && (
          <Card style={{ margin: spacing.md, backgroundColor: colors.background.default }}>
            <Card.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="storefront-check" size={24} color={colors.text.secondary} />
                <Text variant="bodyMedium" style={{ marginLeft: spacing.sm, color: colors.text.secondary }}>
                  {t('dedicatedAgents.agent.filled', 'This spot was filled')}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {!isFilled && canApply && missingSlots.length > 0 && (
          <Card style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm }} testID="posting-not-preferred">
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                {t('slotPrefs.postingGreyed')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                {missingSlots.map((slot) => (
                  <Button
                    key={slot}
                    compact
                    mode="outlined"
                    icon={SLOT_ICONS[slot]}
                    disabled={slotPrefs.savingSlot === slot}
                    onPress={() => {
                      dedicatedAnalytics.trackDedicatedSlotTurnOnCta(opportunity.id, slot);
                      slotPrefs.setSlot(slot, true);
                    }}
                  >
                    {t('slotPrefs.postingCta', { slot: slotPrefs.slotLabel(slot) })}
                  </Button>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}
        <Portal>
          <Snackbar visible={!!slotPrefs.message} onDismiss={slotPrefs.clearMessage} duration={3000}>
            {slotPrefs.message ?? ''}
          </Snackbar>
        </Portal>

        {!isFilled && canApply && slotPrefs.error && !slotPrefs.prefs && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm }}
            testID="detail-prefs-error"
          >
            <Text variant="bodySmall" style={{ flex: 1, color: colors.error.main }}>
              {t('slotPrefs.loadError')}
            </Text>
            <Button compact mode="text" onPress={() => slotPrefs.reload()}>
              {t('dedicatedAgents.retry', 'Retry')}
            </Button>
          </View>
        )}

        {!isFilled && canApply && (
          <Button
            mode="contained"
            testID="apply-button"
            onPress={handleApply}
            // Wait for slot prefs so the greyed-posting gate can't be bypassed.
            disabled={submitting || slotPrefs.loading || !slotPrefs.prefs || missingSlots.length > 0}
            loading={submitting}
            style={{ marginHorizontal: spacing.md }}
          >
            {t('dedicatedAgents.agent.apply', 'Apply')}
          </Button>
        )}

        {!isFilled && isApplied && (
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
                style={[styles.photoButton, { backgroundColor: colors.surfaceInput, borderRadius: borderRadius.card }]}
                onPress={() => handlePhotoSource('camera')}
                disabled={uploadingPhoto}
              >
                <MaterialCommunityIcons name="camera" size={32} color={colors.primary.main} />
                <Text variant="labelLarge" style={{ marginTop: spacing.xs }}>
                  {t('common.camera', 'Camera')}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.photoButton, { backgroundColor: colors.surfaceInput, borderRadius: borderRadius.card }]}
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

            {uploadError && !uploadingPhoto && (
              <View style={{ backgroundColor: colors.error.light, padding: spacing.md, borderRadius: borderRadius.card, marginBottom: spacing.md }}>
                <Text variant="bodyMedium" style={{ color: colors.error.main }}>
                  {uploadError}
                </Text>
                <Button 
                  mode="contained" 
                  onPress={handleRetryPhotoApply}
                  style={{ marginTop: spacing.sm }}
                >
                  {t('dedicatedAgents.retry', 'Retry')}
                </Button>
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
