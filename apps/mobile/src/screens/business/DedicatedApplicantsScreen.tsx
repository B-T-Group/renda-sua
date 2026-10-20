import React, { useCallback, useEffect, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View, Linking, Alert } from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  IconButton,
  Menu,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import {
  extractDedicatedAgentsError,
  mapDedicatedAgentsErrorCode,
  isDedicatedAgentsFeatureHidden,
} from '../../utils/dedicatedAgentsErrors';
import { dedicatedAgentsAnalytics } from '../../services/dedicatedAgentsAnalytics';
import type {
  ApplicantCard,
  DedicatedPostingView,
} from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'DedicatedApplicants'>;

export default function DedicatedApplicantsScreen({ route, navigation }: Props) {
  const { locationId, postingId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState<DedicatedPostingView | null>(null);
  const [applications, setApplications] = useState<ApplicantCard[]>([]);
  const [editingTerms, setEditingTerms] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [newTerms, setNewTerms] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closingPosting, setClosingPosting] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState<{ id: string; name: string } | null>(null);
  const [acceptingApp, setAcceptingApp] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await dedicatedAgentsService.getApplications(locationId, postingId);
      setPosting(response.posting);
      setApplications(response.applications);
      setNewTerms(response.posting.terms || '');
      setNotFound(false);

      if (!loading && !refreshing) {
        const pending = response.applications.filter((a) => a.status === 'applied');
        const accepted = response.applications.filter((a) => a.status === 'accepted');
        dedicatedAgentsAnalytics.applicantsViewed({
          platform: Platform.OS as 'ios' | 'android',
          role: 'business',
          locationId,
          postingId,
          pending: pending.length,
          accepted: accepted.length,
        });
      }
    } catch (err: any) {
      if (isDedicatedAgentsFeatureHidden(err)) {
        setNotFound(true);
      }
      console.error('Error loading applications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId, postingId, loading, refreshing]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAccept = async (applicationId: string) => {
    try {
      setAcceptingApp(applicationId);
      const response = await dedicatedAgentsService.acceptApplication(locationId, postingId, applicationId);
      
      setApplications(response.applications);
      setPosting(response.posting);
      
      setConfirmAccept(null);

      dedicatedAgentsAnalytics.applicantAccepted({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        postingId,
        applicationId,
        filled: response.posting.status === 'filled',
      });
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);

      const errorCodes = [
        'posting_filled',
        'posting_not_open',
        'posting_expired',
        'application_not_pending',
        'agent_holds_slot',
        'dedicated_agent_assignment_cap_exceeded',
        'slot_disabled',
        'agent_ineligible',
      ];

      if (code && errorCodes.includes(code)) {
        const errorKey = mapDedicatedAgentsErrorCode(code);
        Alert.alert(t('common.error', 'Error'), t(errorKey, 'An error occurred'));
        await loadData();

        dedicatedAgentsAnalytics.actionConflict({
          platform: Platform.OS as 'ios' | 'android',
          role: 'business',
          endpoint: 'accept',
          code: code,
        });
      } else {
        Alert.alert(
          t('common.error', 'Error'),
          t('dedicatedAgents.generic', 'Something went wrong')
        );
      }

      console.error('Error accepting application:', err);
      setConfirmAccept(null);
    } finally {
      setAcceptingApp(null);
    }
  };

  const handleDecline = async (applicationId: string) => {
    try {
      await dedicatedAgentsService.declineApplication(locationId, postingId, applicationId);
      await loadData();

      dedicatedAgentsAnalytics.applicantDeclined({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        postingId,
        applicationId,
      });
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
      console.error('Error declining application:', err);
    }
  };

  const handleUpdateTerms = async () => {
    try {
      setSavingTerms(true);
      await dedicatedAgentsService.updatePosting(locationId, postingId, {
        terms: newTerms.trim() || null,
      });
      await loadData();
      setEditingTerms(false);
      setSnackbarMessage(t('dedicatedAgents.applicant.termsEdited', 'Applicants were notified'));

      dedicatedAgentsAnalytics.postingTermsEdited({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        postingId,
      });
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
      console.error('Error updating terms:', err);
    } finally {
      setSavingTerms(false);
    }
  };

  const handleClose = async () => {
    try {
      setClosingPosting(true);
      const response = await dedicatedAgentsService.closePosting(locationId, postingId);
      setConfirmClose(false);
      navigation.goBack();

      dedicatedAgentsAnalytics.postingClosed({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        postingId,
        autoDeclined: response.autoDeclined,
      });
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      Alert.alert(t('common.error', 'Error'), t(errorKey, 'Something went wrong'));
      console.error('Error closing posting:', err);
      setConfirmClose(false);
    } finally {
      setClosingPosting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!posting || notFound) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <Text variant="titleMedium" style={{ color: colors.text.secondary }}>
          {t('dedicatedAgents.noLongerAvailable', 'This posting is no longer available')}
        </Text>
      </View>
    );
  }

  const pending = applications.filter((a) => a.status === 'applied');
  const accepted = applications.filter((a) => a.status === 'accepted');
  const autoDeclined = applications.filter((a) => a.status === 'auto_declined');
  const isOpen = posting.status === 'open';
  const isLastAccept = isOpen && posting.acceptedCount + 1 === posting.headcount;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <View style={styles.chips}>
                  {posting.slotKeys.map((slotKey) => (
                    <Chip key={slotKey} compact>
                      {t(`dedicatedAgents.slots.${slotKey}`, slotKey)}
                    </Chip>
                  ))}
                </View>
                <Text variant="bodySmall" style={{ marginTop: spacing.xs }}>
                  {posting.status === 'filled' 
                    ? t('dedicatedAgents.posting.status.filled', 'Filled')
                    : t('dedicatedAgents.posting.progress', '{{accepted}}/{{needed}} accepted', {
                        accepted: posting.acceptedCount,
                        needed: posting.headcount,
                      })}
                </Text>
              </View>

              {isOpen && (
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      onPress={() => setMenuVisible(true)}
                      accessibilityLabel={t('dedicatedAgents.accessibilityLabels.moreOptions', 'More options')}
                    />
                  }
                >
                  <Menu.Item
                    leadingIcon="close"
                    onPress={() => {
                      setMenuVisible(false);
                      setConfirmClose(true);
                    }}
                    title={t('common.close', 'Close')}
                  />
                </Menu>
              )}
            </View>

            <View style={{ marginTop: spacing.md }}>
              <View style={styles.termsHeader}>
                <Text variant="titleSmall">
                  {t('dedicatedAgents.form.termsField', 'Terms / notes')}
                </Text>
                {isOpen && !editingTerms && (
                  <IconButton
                    icon="pencil"
                    size={16}
                    onPress={() => setEditingTerms(true)}
                    accessibilityLabel={t('dedicatedAgents.accessibilityLabels.editTerms', 'Edit terms')}
                  />
                )}
              </View>

              {editingTerms ? (
                <View>
                  <TextInput
                    value={newTerms}
                    onChangeText={(text) => setNewTerms(text.slice(0, 1000))}
                    multiline
                    numberOfLines={3}
                    mode="outlined"
                    disabled={savingTerms}
                    style={{ marginBottom: spacing.sm }}
                  />
                  <View style={styles.termsActions}>
                    <Button mode="text" onPress={() => setEditingTerms(false)} disabled={savingTerms}>
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button mode="contained" onPress={handleUpdateTerms} loading={savingTerms} disabled={savingTerms}>
                      {t('common.save', 'Save')}
                    </Button>
                  </View>
                </View>
              ) : posting.terms ? (
                <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                  {posting.terms}
                </Text>
              ) : (
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, fontStyle: 'italic' }}
                >
                  {t('dedicatedAgents.agent.noTerms', 'No extra terms')}
                </Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {(pending.length > 0 || autoDeclined.length > 0) && (
          <View style={{ marginBottom: spacing.md }}>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              {t('dedicatedAgents.applicant.title', 'Pending')} ({pending.length})
              {autoDeclined.length > 0 && ` · ${autoDeclined.length} ${t('dedicatedAgents.applicant.autoDeclined', 'auto-declined')}`}
            </Text>
            {autoDeclined.map((app) => (
              <Card
                key={app.applicationId}
                style={{ marginBottom: spacing.sm, opacity: 0.6 }}
              >
                <Card.Content>
                  <View style={styles.applicantRow}>
                    <Avatar.Text
                      size={40}
                      label={app.agent.firstName[0]}
                      style={{ backgroundColor: colors.primary.main }}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                        {app.agent.firstName}
                      </Text>
                      <Chip compact mode="outlined" style={{ alignSelf: 'flex-start' }}>
                        {t('dedicatedAgents.applicant.autoDeclined', 'Auto-declined')}
                      </Chip>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
            {pending.map((app) => (
              <Card key={app.applicationId} style={{ marginBottom: spacing.sm }}>
                <Card.Content>
                  <View style={styles.applicantRow}>
                    <Avatar.Text
                      size={40}
                      label={app.agent.firstName[0]}
                      style={{ backgroundColor: colors.primary.main }}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                        {app.agent.firstName}
                      </Text>
                      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                        {t('dedicatedAgents.applicant.stats', 'Joined {{date}} · {{n}} deliveries · {{m}} missed', {
                          date: new Date(app.agent.joinedAt).toLocaleDateString(),
                          n: app.deliveriesCompleted,
                          m: app.missedDeliveries,
                        })}
                        {app.onTimePickupPct !== null && ` · ${t('dedicatedAgents.applicant.onTime', '{{pct}}% on-time pickups', { pct: app.onTimePickupPct })}`}
                        {app.distanceKm !== null && ` · ${app.distanceKm.toFixed(1)} km`}
                      </Text>
                    </View>
                  </View>

                  {isOpen && (
                    <View style={styles.applicantActions}>
                      <Button
                        mode="outlined"
                        onPress={() => handleDecline(app.applicationId)}
                        style={{ flex: 1, marginRight: spacing.xs }}
                        disabled={acceptingApp !== null}
                      >
                        {t('dedicatedAgents.applicant.decline', 'Decline')}
                      </Button>
                      <Button
                        mode="contained"
                        onPress={() =>
                          setConfirmAccept({
                            id: app.applicationId,
                            name: app.agent.firstName,
                          })
                        }
                        style={{ flex: 1, marginLeft: spacing.xs }}
                        loading={acceptingApp === app.applicationId}
                        disabled={acceptingApp !== null}
                      >
                        {t('dedicatedAgents.applicant.accept', 'Accept')}
                      </Button>
                    </View>
                  )}
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {accepted.length > 0 && (
          <View>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              {t('dedicatedAgents.applicant.accepted', 'Accepted')} ({accepted.length})
            </Text>
            {accepted.map((app) => (
              <Card key={app.applicationId} style={{ marginBottom: spacing.sm }}>
                <Card.Content>
                  <View style={styles.applicantRow}>
                    <Avatar.Text
                      size={40}
                      label={app.agent.firstName[0]}
                      style={{ backgroundColor: colors.primary.main }}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                        {app.agent.firstName}
                      </Text>
                      {app.phone && (
                        <Button
                          mode="text"
                          icon="phone"
                          onPress={() => Linking.openURL(`tel:${app.phone}`)}
                          compact
                          style={{ alignSelf: 'flex-start', marginLeft: -spacing.sm }}
                        >
                          {app.phone}
                        </Button>
                      )}
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={!!confirmAccept} onDismiss={() => setConfirmAccept(null)}>
          <Dialog.Title>
            {confirmAccept &&
              (isLastAccept
                ? t(
                    'dedicatedAgents.applicant.acceptLastConfirm',
                    'Accept {{name}}? This fills the request and declines the other applicants.',
                    { name: confirmAccept.name }
                  )
                : t('dedicatedAgents.applicant.acceptConfirm', 'Accept {{name}}?', {
                    name: confirmAccept.name,
                  }))}
          </Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setConfirmAccept(null)} disabled={acceptingApp !== null}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button 
              onPress={() => confirmAccept && handleAccept(confirmAccept.id)}
              loading={acceptingApp === confirmAccept?.id}
              disabled={acceptingApp !== null}
            >
              {t('dedicatedAgents.applicant.accept', 'Accept')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={confirmClose} onDismiss={() => !closingPosting && setConfirmClose(false)}>
          <Dialog.Title>
            {pending.length > 0
              ? t('dedicatedAgents.closeWithCount', 'Close posting ({{count}} will be auto-declined)', {
                  count: pending.length,
                })
              : t(
                  'dedicatedAgents.applicant.closeConfirm',
                  'Close this request? Pending applicants will be declined.'
                )}
          </Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setConfirmClose(false)} disabled={closingPosting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onPress={handleClose} loading={closingPosting} disabled={closingPosting}>
              {t('common.close', 'Close')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
      >
        {snackbarMessage}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  termsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  termsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  applicantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  applicantActions: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
});
