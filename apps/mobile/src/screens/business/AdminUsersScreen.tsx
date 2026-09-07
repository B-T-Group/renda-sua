import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Snackbar, SegmentedButtons, Switch, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useAdminClients } from '../../hooks/useAdminClients';
import { useAdminBusinessesList } from '../../hooks/useAdminBusinessesList';
import { useAdminAgents } from '../../hooks/useAdminAgents';
import { useProfileMe } from '../../hooks/useProfileMe';
import { usePermission } from '../../hooks/usePermissions';
import { ClientUserCard } from '../../components/admin/ClientUserCard';
import { AgentAdminCard } from '../../components/admin/AgentAdminCard';
import { AdminBusinessCard } from '../../components/admin/AdminBusinessCard';
import { AdminBusinessFilters } from '../../components/admin/AdminBusinessFilters';
import type { BusinessRootStackParamList } from '../../navigation/types';
import type { AdminClientUser, AdminAgentUser } from '../../types/adminUsers';
import type { AdminBusinessListItem } from '../../types/adminBusinesses';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { threadsApi } from '../../services/threadsApi';

type Tab = 'clients' | 'businesses' | 'agents';

type NavProp = NativeStackNavigationProp<BusinessRootStackParamList>;

interface ComposeTarget {
  userId: string;
  name: string;
}

// ─── Module-level helper components (stable references, no remount on render) ─

interface PaginationFooterProps {
  page: number;
  totalPages: number;
  setPage: (n: number) => void;
  label: string;
  prevLabel: string;
  nextLabel: string;
  textColor: string;
  captionStyle: object;
}

function PaginationFooter({
  page,
  totalPages,
  setPage,
  label,
  prevLabel,
  nextLabel,
  textColor,
  captionStyle,
}: PaginationFooterProps) {
  if (totalPages <= 1) return null;
  return (
    <View style={styles.paginationRow}>
      <Button disabled={page <= 1} onPress={() => setPage(Math.max(1, page - 1))}>
        {prevLabel}
      </Button>
      <Text style={[captionStyle, { color: textColor }]}>{label}</Text>
      <Button
        disabled={page >= totalPages}
        onPress={() => setPage(Math.min(totalPages, page + 1))}
      >
        {nextLabel}
      </Button>
    </View>
  );
}

interface AccessDeniedBannerProps {
  label: string;
  textColor: string;
  padding: number;
}

function AccessDeniedBanner({ label, textColor, padding }: AccessDeniedBannerProps) {
  return (
    <View style={[styles.centered, { padding }]}>
      <Text style={{ color: textColor, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

interface EmptyTextProps {
  msg: string | null;
  emptyLabel: string;
  textColor: string;
  topMargin: number;
}

function EmptyText({ msg, emptyLabel, textColor, topMargin }: EmptyTextProps) {
  return (
    <Text style={{ color: textColor, textAlign: 'center', marginTop: topMargin }}>
      {msg ?? emptyLabel}
    </Text>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation<NavProp>();

  const [tab, setTab] = useState<Tab>('clients');

  const { me } = useProfileMe();
  const canSendMessages = usePermission(PlatformPermissions.OPS_USER_MESSAGES, me);

  // Compose state
  const [composeTarget, setComposeTarget] = useState<ComposeTarget | null>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const openCompose = useCallback((userId: string, name: string) => {
    setComposeTarget({ userId, name });
    setComposeSubject('');
    setComposeBody('');
  }, []);

  const closeCompose = useCallback(() => setComposeTarget(null), []);

  const sendMessage = useCallback(async () => {
    if (!composeTarget || !composeBody.trim() || composeSending) return;
    setComposeSending(true);
    try {
      const result = await threadsApi.adminSendThread({
        recipientUserId: composeTarget.userId,
        subject: composeSubject.trim() || undefined,
        body: composeBody.trim(),
      });
      if (result.success) {
        setSnackMessage(t('admin.users.messageSent', 'Message sent'));
        closeCompose();
      } else {
        setSnackMessage(t('common.error', 'Failed to send message'));
      }
    } catch (e: any) {
      setSnackMessage(e?.message ?? t('common.error', 'Error'));
    } finally {
      setComposeSending(false);
    }
  }, [composeTarget, composeBody, composeSubject, composeSending, closeCompose, t]);

  const clients = useAdminClients();
  const businesses = useAdminBusinessesList();
  const agents = useAdminAgents();

  // ─── search state per tab ────────────────────────────────────────────────
  const activeSearch =
    tab === 'clients'
      ? clients.search
      : tab === 'businesses'
        ? businesses.search
        : agents.search;

  const onActiveSearchChange = useCallback(
    (text: string) => {
      if (tab === 'clients') clients.onSearchChange(text);
      else if (tab === 'businesses') businesses.onSearchChange(text);
      else agents.onSearchChange(text);
    },
    [tab, clients, businesses, agents]
  );

  // ─── render helpers (declared before early returns to satisfy Rules of Hooks) ─
  const renderClientItem = useCallback(
    ({ item }: { item: AdminClientUser }) => (
      <View>
        <ClientUserCard item={item} />
        {canSendMessages ? (
          <Button
            mode="text"
            icon="message-text-outline"
            compact
            onPress={() => openCompose(item.user_id, `${item.user.first_name} ${item.user.last_name}`.trim())}
            style={{ alignSelf: 'flex-end', marginTop: -8, marginRight: 4 }}
          >
            {t('admin.users.sendMessage', 'Message')}
          </Button>
        ) : null}
      </View>
    ),
    [canSendMessages, openCompose, t]
  );

  const renderBusinessItem = useCallback(
    ({ item }: { item: AdminBusinessListItem }) => (
      <AdminBusinessCard
        item={item}
        showRail={false}
        canSendMessages={canSendMessages}
        onVerify={(businessId) =>
          navigation.navigate('AdminBusinessVerification', { businessId })
        }
        onMessage={openCompose}
        onApplyReferral={businesses.applyReferral}
      />
    ),
    [canSendMessages, navigation, openCompose, businesses.applyReferral]
  );

  const renderAgentItem = useCallback(
    ({ item }: { item: AdminAgentUser }) => (
      <View>
        <AgentAdminCard item={item} onApplyReferral={agents.applyReferral} />
        {canSendMessages ? (
          <Button
            mode="text"
            icon="message-text-outline"
            compact
            onPress={() => openCompose(item.user_id, `${item.user.first_name} ${item.user.last_name}`.trim())}
            style={{ alignSelf: 'flex-end', marginTop: -8, marginRight: 4 }}
          >
            {t('admin.users.sendMessage', 'Message')}
          </Button>
        ) : null}
      </View>
    ),
    [canSendMessages, openCompose, t, agents.applyReferral]
  );

  // ─── access guard ────────────────────────────────────────────────────────
  const anyAccess =
    clients.canAccess || businesses.canAccess || agents.canAccess;

  if (clients.profileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!anyAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text variant="titleMedium" style={{ color: colors.text.primary, textAlign: 'center' }}>
          {t('admin.users.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  // ─── shared prop builders (avoid inline JSX for ListFooter/ListEmpty) ────
  const accessDeniedProps: AccessDeniedBannerProps = {
    label: t('admin.users.accessDenied', 'Access denied'),
    textColor: colors.text.secondary,
    padding: spacing.xl,
  };

  const emptyProps = (msg: string | null): EmptyTextProps => ({
    msg,
    emptyLabel: t('admin.users.empty', 'No results found.'),
    textColor: colors.text.secondary,
    topMargin: spacing.lg,
  });

  const paginationProps = (
    page: number,
    totalPages: number,
    setPage: (n: number) => void
  ): PaginationFooterProps => ({
    page,
    totalPages,
    setPage,
    label: t('admin.businesses.pageOf', 'Page {{page}} of {{total}}', {
      page,
      total: totalPages,
    }),
    prevLabel: t('common.previous', 'Previous'),
    nextLabel: t('common.next', 'Next'),
    textColor: colors.text.secondary,
    captionStyle: typography.caption,
  });

  return (
  <>
    <View style={[styles.root, { backgroundColor: colors.pageBackground }]}>
      {/* ─── Search + tabs header ─────────────────────────────────── */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.sm,
            backgroundColor: colors.surface,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <RNTextInput
          value={activeSearch}
          onChangeText={onActiveSearchChange}
          placeholder={t('admin.users.searchPlaceholder', 'Search by name or email')}
          placeholderTextColor={colors.text.secondary}
          style={[
            styles.searchInput,
            {
              borderColor: colors.divider,
              borderRadius: borderRadius.md,
              color: colors.text.primary,
              backgroundColor: colors.pageBackground,
            },
          ]}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          style={{ marginTop: spacing.sm }}
          buttons={[
            { value: 'clients', label: t('admin.users.tabClients', 'Clients') },
            { value: 'businesses', label: t('admin.users.tabBusinesses', 'Businesses') },
            { value: 'agents', label: t('admin.users.tabAgents', 'Agents') },
          ]}
        />
      </View>

      {/* ─── Clients tab ─────────────────────────────────────────── */}
      {tab === 'clients' && (
        <>
          {!clients.canAccess ? (
            <AccessDeniedBanner {...accessDeniedProps} />
          ) : clients.loading && !clients.refreshing ? (
            <View style={styles.centered}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={clients.items}
              keyExtractor={(item) => item.id}
              renderItem={renderClientItem}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: insets.bottom + spacing.xl },
              ]}
              refreshControl={
                <RefreshControl refreshing={clients.refreshing} onRefresh={clients.refresh} />
              }
              ListEmptyComponent={<EmptyText {...emptyProps(clients.error)} />}
              ListFooterComponent={
                <PaginationFooter
                  {...paginationProps(clients.page, clients.totalPages, clients.setPage)}
                />
              }
            />
          )}
        </>
      )}

      {/* ─── Businesses tab ──────────────────────────────────────── */}
      {tab === 'businesses' && (
        <>
          {!businesses.canAccess ? (
            <AccessDeniedBanner {...accessDeniedProps} />
          ) : (
            <View style={{ flex: 1 }}>
              {/* Filters */}
              <View
                style={[
                  styles.filtersBar,
                  {
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs ?? 6,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.divider,
                  },
                ]}
              >
                <AdminBusinessFilters
                  compact
                  lifecycleStatus={businesses.lifecycleStatus}
                  idDocumentStatus={businesses.idDocumentStatus}
                  needsAttention={businesses.needsAttention}
                  onLifecycleChange={(v) => businesses.applyFilter('lifecycle', v)}
                  onIdDocumentChange={(v) => businesses.applyFilter('idDoc', v)}
                  onNeedsAttentionChange={(v) =>
                    businesses.applyFilter('attention', v)
                  }
                />
              </View>

              {businesses.loading && !businesses.refreshing ? (
                <View style={styles.centered}>
                  <ActivityIndicator />
                </View>
              ) : (
                <FlatList
                  data={businesses.items}
                  keyExtractor={(item) => item.id}
                  renderItem={renderBusinessItem}
                  contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + spacing.xl },
                  ]}
                  refreshControl={
                    <RefreshControl
                      refreshing={businesses.refreshing}
                      onRefresh={businesses.refresh}
                    />
                  }
                  ListEmptyComponent={<EmptyText {...emptyProps(businesses.error)} />}
                  ListFooterComponent={
                    <PaginationFooter
                      {...paginationProps(
                        businesses.page,
                        businesses.totalPages,
                        businesses.setPage
                      )}
                    />
                  }
                />
              )}
            </View>
          )}
        </>
      )}

      {/* ─── Agents tab ──────────────────────────────────────────── */}
      {tab === 'agents' && (
        <>
          {!agents.canAccess ? (
            <AccessDeniedBanner {...accessDeniedProps} />
          ) : (
            <View style={{ flex: 1 }}>
              {/* Unverified-only toggle */}
              <View
                style={[
                  styles.agentFilterBar,
                  {
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs ?? 6,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.divider,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.body2,
                    { color: colors.text.primary, flex: 1, minWidth: 0 },
                  ]}
                >
                  {t('admin.users.agent.unverifiedOnly', 'Unverified only')}
                </Text>
                <Switch
                  value={agents.unverifiedOnly}
                  onValueChange={agents.toggleUnverifiedOnly}
                />
              </View>

              {agents.loading && !agents.refreshing ? (
                <View style={styles.centered}>
                  <ActivityIndicator />
                </View>
              ) : (
                <FlatList
                  data={agents.items}
                  keyExtractor={(item) => item.id}
                  renderItem={renderAgentItem}
                  contentContainerStyle={[
                    styles.listContent,
                    { paddingBottom: insets.bottom + spacing.xl },
                  ]}
                  refreshControl={
                    <RefreshControl refreshing={agents.refreshing} onRefresh={agents.refresh} />
                  }
                  ListEmptyComponent={<EmptyText {...emptyProps(agents.error)} />}
                  ListFooterComponent={
                    <PaginationFooter
                      {...paginationProps(agents.page, agents.totalPages, agents.setPage)}
                    />
                  }
                />
              )}
            </View>
          )}
        </>
      )}
    </View>

    {/* Compose Message Modal */}
    <Modal
      visible={!!composeTarget}
      transparent
      animationType="fade"
      onRequestClose={closeCompose}
      statusBarTranslucent
    >
      <Pressable style={styles.modalScrim} onPress={closeCompose}>
        <Pressable
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              maxHeight: screenHeight * 0.8,
              width: '90%',
              padding: spacing.lg,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={[typography.subheading, { color: colors.text.primary, flex: 1 }]}>
              {t('admin.users.sendMessageTitle', 'Message {{name}}', { name: composeTarget?.name ?? '' })}
            </Text>
            <IconButton icon="close" size={20} onPress={closeCompose} />
          </View>
          <RNTextInput
            placeholder={t('admin.users.messageSubject', 'Subject (optional)')}
            placeholderTextColor={colors.text.disabled}
            value={composeSubject}
            onChangeText={setComposeSubject}
            style={[
              styles.composeInput,
              {
                borderColor: colors.divider,
                borderRadius: borderRadius.sm,
                color: colors.text.primary,
                backgroundColor: colors.pageBackground,
                padding: spacing.sm,
                marginBottom: spacing.sm,
              },
            ]}
          />
          <RNTextInput
            placeholder={t('admin.users.messageBody', 'Write your message…')}
            placeholderTextColor={colors.text.disabled}
            value={composeBody}
            onChangeText={setComposeBody}
            multiline
            style={[
              styles.composeInput,
              styles.composeBodyInput,
              {
                borderColor: colors.divider,
                borderRadius: borderRadius.sm,
                color: colors.text.primary,
                backgroundColor: colors.pageBackground,
                padding: spacing.sm,
              },
            ]}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={closeCompose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={sendMessage}
              loading={composeSending}
              disabled={!composeBody.trim() || composeSending}
            >
              {t('messages.send', 'Send')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    <Snackbar
      visible={!!snackMessage}
      onDismiss={() => setSnackMessage('')}
      duration={3000}
    >
      {snackMessage}
    </Snackbar>
  </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 0 },
  searchInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
  },
  filtersBar: { gap: 0 },
  agentFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSheet: { width: '90%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  composeInput: {
    borderWidth: 1,
    fontSize: 15,
  },
  composeBodyInput: {
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
});
