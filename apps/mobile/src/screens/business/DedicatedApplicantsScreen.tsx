import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, Linking } from 'react-native';
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
  const [newTerms, setNewTerms] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState<{ id: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await dedicatedAgentsService.getApplications(locationId, postingId);
      setPosting(response.posting);
      setApplications(response.applications);
      setNewTerms(response.posting.terms || '');
    } catch (err: any) {
      console.error('Error loading applications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId, postingId]);

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
      await dedicatedAgentsService.acceptApplication(locationId, postingId, applicationId);
      await loadData();
      setConfirmAccept(null);
    } catch (err: any) {
      console.error('Error accepting application:', err);
    }
  };

  const handleDecline = async (applicationId: string) => {
    try {
      await dedicatedAgentsService.declineApplication(locationId, postingId, applicationId);
      await loadData();
    } catch (err: any) {
      console.error('Error declining application:', err);
    }
  };

  const handleUpdateTerms = async () => {
    try {
      await dedicatedAgentsService.updatePosting(locationId, postingId, {
        terms: newTerms.trim() || null,
      });
      await loadData();
      setEditingTerms(false);
    } catch (err: any) {
      console.error('Error updating terms:', err);
    }
  };

  const handleClose = async () => {
    try {
      await dedicatedAgentsService.closePosting(locationId, postingId);
      setConfirmClose(false);
      navigation.goBack();
    } catch (err: any) {
      console.error('Error closing posting:', err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!posting) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <Text variant="titleMedium">Posting not found</Text>
      </View>
    );
  }

  const pending = applications.filter((a) => a.status === 'applied');
  const accepted = applications.filter((a) => a.status === 'accepted');
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
                  {t('dedicatedAgents.posting.progress', '{{accepted}}/{{needed}} accepted', {
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
                    />
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      setMenuVisible(false);
                      setConfirmClose(true);
                    }}
                    title="Close"
                  />
                </Menu>
              )}
            </View>

            {posting.terms && (
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
                      style={{ marginBottom: spacing.sm }}
                    />
                    <View style={styles.termsActions}>
                      <Button mode="text" onPress={() => setEditingTerms(false)}>
                        {t('common.cancel', 'Cancel')}
                      </Button>
                      <Button mode="contained" onPress={handleUpdateTerms}>
                        {t('common.save', 'Save')}
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                    {posting.terms}
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {pending.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              Pending ({pending.length})
            </Text>
            {pending.map((app) => (
              <Card key={app.applicationId} style={{ marginBottom: spacing.sm }}>
                <Card.Content>
                  <View style={styles.applicantRow}>
                    <Avatar.Text
                      size={40}
                      label={app.agent.firstName[0]}
                      style={{ backgroundColor: colors.primaryContainer }}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                        {app.agent.firstName} {app.agent.lastName[0]}.
                      </Text>
                      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                        Joined {new Date(app.agent.joinedAt).toLocaleDateString()} · ✓{' '}
                        {app.deliveriesCompleted} · ✕ {app.missedDeliveries}
                        {app.onTimePickupPct !== null && ` · ${app.onTimePickupPct}% on-time`}
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
              Accepted ({accepted.length})
            </Text>
            {accepted.map((app) => (
              <Card key={app.applicationId} style={{ marginBottom: spacing.sm }}>
                <Card.Content>
                  <View style={styles.applicantRow}>
                    <Avatar.Text
                      size={40}
                      label={app.agent.firstName[0]}
                      style={{ backgroundColor: colors.primaryContainer }}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text variant="titleSmall" style={{ fontWeight: '600' }}>
                        {app.agent.firstName} {app.agent.lastName[0]}.
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
            <Button onPress={() => setConfirmAccept(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onPress={() => confirmAccept && handleAccept(confirmAccept.id)}>
              {t('dedicatedAgents.applicant.accept', 'Accept')}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={confirmClose} onDismiss={() => setConfirmClose(false)}>
          <Dialog.Title>
            {t(
              'dedicatedAgents.applicant.closeConfirm',
              'Close this request? Pending applicants will be declined.'
            )}
          </Dialog.Title>
          <Dialog.Actions>
            <Button onPress={() => setConfirmClose(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onPress={handleClose}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
