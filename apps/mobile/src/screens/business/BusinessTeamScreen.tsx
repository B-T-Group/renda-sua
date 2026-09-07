import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useBusinessDelegations } from '../../hooks/useBusinessDelegations';
import { businessApi } from '../../services/businessApi';
import type { BusinessLocation } from '../../types/business/locations';
import type {
  DelegationRoleSummary,
  DelegationTeamInvite,
  DelegationTeamMember,
} from '../../types/delegation';

function displayName(m: DelegationTeamMember): string {
  const name = [m.user?.first_name, m.user?.last_name].filter(Boolean).join(' ');
  return name || m.user?.email || '—';
}

export default function BusinessTeamScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const {
    members,
    invites,
    roles,
    loading,
    error,
    refresh,
    createInvite,
    resendInvite,
    changeInviteRole,
    changeMemberRole,
    revokeMember,
  } = useBusinessDelegations();

  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [picker, setPicker] = useState<
    | { kind: 'inviteLocation' }
    | { kind: 'inviteRole' }
    | { kind: 'memberRole'; memberId: string }
    | { kind: 'invitePendingRole'; inviteId: string }
    | null
  >(null);

  const defaultRoleId = useMemo(() => roles[0]?.id || '', [roles]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await businessApi.locations.list();
      const list = res.data?.business_locations ?? [];
      setLocations(list);
      setLocationId((prev) => prev || list[0]?.id || '');
    } catch {
      setLocations([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadLocations();
    }, [refresh, loadLocations])
  );

  useEffect(() => {
    if (!roleId && defaultRoleId) setRoleId(defaultRoleId);
  }, [defaultRoleId, roleId]);

  const resetInviteForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRoleId(defaultRoleId);
    setLocationId(locations[0]?.id || '');
  };

  const openInvite = () => {
    if (!roleId && defaultRoleId) setRoleId(defaultRoleId);
    if (!locationId && locations[0]?.id) setLocationId(locations[0].id);
    if (!roles.length) void refresh();
    setInviteOpen(true);
  };

  const handleInvite = async () => {
    if (!email.trim() || !locationId || !roleId) return;
    setSubmitting(true);
    try {
      await createInvite({
        email: email.trim(),
        business_location_id: locationId,
        role_id: roleId,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      });
      setSnack(t('delegation.team.inviteSent', 'Invite sent'));
      setInviteOpen(false);
      resetInviteForm();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t('delegation.team.inviteFailed', 'Could not send invite');
      setSnack(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async (invite: DelegationTeamInvite) => {
    try {
      await resendInvite(invite.id);
      setSnack(t('delegation.team.resent', 'Invite resent'));
    } catch (err: unknown) {
      setSnack(
        err instanceof Error
          ? err.message
          : t('delegation.team.resendFailed', 'Resend failed')
      );
    }
  };

  const onConfirmRevoke = async () => {
    if (!revokeId) return;
    try {
      await revokeMember(revokeId);
      setSnack(t('delegation.team.revoked', 'Access revoked'));
      setRevokeId(null);
    } catch (err: unknown) {
      setSnack(
        err instanceof Error
          ? err.message
          : t('delegation.team.revokeFailed', 'Could not revoke')
      );
    }
  };

  const selectedLocationName =
    locations.find((l) => l.id === locationId)?.name ||
    t('common.location', 'Location');
  const selectedRoleName =
    roles.find((r) => r.id === roleId)?.name ||
    t('delegation.team.role', 'Role');

  const pickerOptions: Array<{ id: string; label: string }> = useMemo(() => {
    if (!picker) return [];
    if (picker.kind === 'inviteLocation') {
      return locations.map((l) => ({ id: l.id, label: l.name }));
    }
    return roles.map((r: DelegationRoleSummary) => ({
      id: r.id,
      label: r.name,
    }));
  }, [picker, locations, roles]);

  const onPickOption = async (id: string) => {
    if (!picker) return;
    if (picker.kind === 'inviteLocation') setLocationId(id);
    if (picker.kind === 'inviteRole') setRoleId(id);
    if (picker.kind === 'memberRole') {
      try {
        await changeMemberRole(picker.memberId, id);
        setSnack(t('delegation.team.roleUpdated', 'Role updated'));
      } catch (err: unknown) {
        setSnack(
          err instanceof Error
            ? err.message
            : t('delegation.team.roleUpdateFailed', 'Could not update role')
        );
      }
    }
    if (picker.kind === 'invitePendingRole') {
      try {
        await changeInviteRole(picker.inviteId, id);
      } catch (err: unknown) {
        setSnack(
          err instanceof Error
            ? err.message
            : t('delegation.team.roleUpdateFailed', 'Could not update role')
        );
      }
    }
    setPicker(null);
  };

  // Don't wait on locations — invite form can load them in the background.
  // Surface team errors instead of trapping the user on a spinner.
  if (loading && members.length === 0 && invites.length === 0 && !error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
        <Text style={{ marginTop: spacing.md, color: colors.text.secondary }}>
          {t('delegation.team.loading', 'Loading team')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: insets.bottom + 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void refresh();
              void loadLocations();
            }}
          />
        }
      >
        <Text variant="bodyLarge" style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
          {t(
            'delegation.team.subtitle',
            'Invite people to manage orders at a location.'
          )}
        </Text>

        <Button
          mode="contained"
          onPress={openInvite}
          style={{ marginBottom: spacing.md }}
        >
          {t('delegation.team.invite', 'Invite')}
        </Button>

        {error ? (
          <Text style={{ color: colors.error.main, marginBottom: spacing.md }}>{error}</Text>
        ) : null}

        <Text
          variant="titleMedium"
          style={{ fontWeight: '700', color: colors.text.primary, marginBottom: spacing.sm }}
        >
          {t('delegation.team.members', 'Members')}
        </Text>
        {members.length === 0 ? (
          <Text style={{ color: colors.text.secondary, marginBottom: spacing.lg }}>
            {t('delegation.team.noMembers', 'No active members yet')}
          </Text>
        ) : (
          members.map((m) => (
            <View
              key={m.id}
              style={[
                styles.card,
                shadows.sm,
                {
                  backgroundColor: colors.background.paper,
                  borderColor: colors.divider,
                  borderRadius: borderRadius.card,
                  marginBottom: spacing.sm,
                  padding: spacing.md,
                },
              ]}
            >
              <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
                {displayName(m)}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {m.user?.email}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                {m.location?.name || '—'} · {m.role?.name || '—'}
              </Text>
              <View style={styles.rowActions}>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => setPicker({ kind: 'memberRole', memberId: m.id })}
                >
                  {t('delegation.team.changeRole', 'Change role')}
                </Button>
                <Button mode="text" textColor={colors.error.main} compact onPress={() => setRevokeId(m.id)}>
                  {t('delegation.team.revoke', 'Revoke')}
                </Button>
              </View>
            </View>
          ))
        )}

        <Text
          variant="titleMedium"
          style={{
            fontWeight: '700',
            color: colors.text.primary,
            marginTop: spacing.md,
            marginBottom: spacing.sm,
          }}
        >
          {t('delegation.team.pendingInvites', 'Pending invites')}
        </Text>
        {invites.length === 0 ? (
          <Text style={{ color: colors.text.secondary }}>
            {t('delegation.team.noInvites', 'No pending invites')}
          </Text>
        ) : (
          invites.map((inv) => (
            <View
              key={inv.id}
              style={[
                styles.card,
                shadows.sm,
                {
                  backgroundColor: colors.background.paper,
                  borderColor: colors.divider,
                  borderRadius: borderRadius.card,
                  marginBottom: spacing.sm,
                  padding: spacing.md,
                },
              ]}
            >
              <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
                {inv.email}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                {inv.location?.name || '—'} · {inv.role?.name || '—'}
              </Text>
              <View style={styles.rowActions}>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => setPicker({ kind: 'invitePendingRole', inviteId: inv.id })}
                >
                  {t('delegation.team.changeRole', 'Change role')}
                </Button>
                <Button mode="contained-tonal" compact onPress={() => void onResend(inv)}>
                  {t('delegation.team.resend', 'Resend')}
                </Button>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Invite sheet — hide while picker/revoke is open to avoid nested Modals */}
      <Modal
        visible={inviteOpen && !picker && !revokeId}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setInviteOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => !submitting && setInviteOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              shadows.md,
              {
                backgroundColor: colors.background.paper,
                borderRadius: borderRadius.xl,
                maxHeight: screenHeight * 0.85,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView contentContainerStyle={{ padding: spacing.md }}>
              <Text variant="titleLarge" style={{ marginBottom: spacing.md, fontWeight: '700' }}>
                {t('delegation.team.inviteTitle', 'Invite teammate')}
              </Text>
              <TextInput
                mode="outlined"
                label={t('common.email', 'Email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ marginBottom: spacing.sm }}
              />
              <TextInput
                mode="outlined"
                label={t('profile.firstName', 'First name')}
                value={firstName}
                onChangeText={setFirstName}
                style={{ marginBottom: spacing.sm }}
              />
              <TextInput
                mode="outlined"
                label={t('profile.lastName', 'Last name')}
                value={lastName}
                onChangeText={setLastName}
                style={{ marginBottom: spacing.sm }}
              />
              <Button
                mode="outlined"
                onPress={() => setPicker({ kind: 'inviteLocation' })}
                style={{ marginBottom: spacing.sm }}
              >
                {selectedLocationName}
              </Button>
              <Button
                mode="outlined"
                onPress={() => setPicker({ kind: 'inviteRole' })}
                style={{ marginBottom: spacing.md }}
              >
                {selectedRoleName}
              </Button>
              <View style={styles.rowActions}>
                <Button mode="text" disabled={submitting} onPress={() => setInviteOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  loading={submitting}
                  disabled={submitting || !email.trim() || !locationId || !roleId}
                  onPress={() => void handleInvite()}
                >
                  {t('delegation.team.sendInvite', 'Send invite')}
                </Button>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Generic picker */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.scrim} onPress={() => setPicker(null)}>
          <Pressable
            style={[
              styles.sheet,
              shadows.md,
              {
                backgroundColor: colors.background.paper,
                borderRadius: borderRadius.xl,
                maxHeight: screenHeight * 0.5,
                paddingBottom: insets.bottom + spacing.md,
                padding: spacing.md,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: spacing.sm }}>
              {t('common.select', 'Select')}
            </Text>
            <ScrollView>
              {pickerOptions.length === 0 ? (
                <Text style={{ color: colors.text.secondary }}>
                  {picker?.kind === 'inviteLocation'
                    ? t('delegation.team.noLocations', 'No locations')
                    : t('delegation.team.noRoles', 'No roles available')}
                </Text>
              ) : (
                pickerOptions.map((opt) => (
                  <Button
                    key={opt.id}
                    mode="text"
                    onPress={() => void onPickOption(opt.id)}
                    contentStyle={{ justifyContent: 'flex-start' }}
                  >
                    {opt.label}
                  </Button>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Revoke confirm */}
      <Modal visible={!!revokeId} transparent animationType="fade" onRequestClose={() => setRevokeId(null)}>
        <Pressable style={styles.scrim} onPress={() => setRevokeId(null)}>
          <Pressable
            style={[
              styles.sheet,
              shadows.md,
              {
                backgroundColor: colors.background.paper,
                borderRadius: borderRadius.xl,
                padding: spacing.md,
                paddingBottom: insets.bottom + spacing.md,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="titleLarge" style={{ fontWeight: '700', marginBottom: spacing.sm }}>
              {t('delegation.team.revokeTitle', 'Revoke access?')}
            </Text>
            <Text style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
              {t(
                'delegation.team.revokeMessage',
                'This person will lose access to this location immediately.'
              )}
            </Text>
            <View style={styles.rowActions}>
              <Button mode="text" onPress={() => setRevokeId(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button mode="contained" buttonColor={colors.error.main} onPress={() => void onConfirmRevoke()}>
                {t('delegation.team.revoke', 'Revoke')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 12,
  },
});
