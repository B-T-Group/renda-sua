import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Snackbar,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModerationItemCard } from '../../components/moderation/ModerationItemCard';
import { QuickRejectionResponses } from '../../components/moderation/QuickRejectionResponses';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  approveSaleItem,
  fetchItemModerationQueue,
  messageBusinessAboutItem,
  rejectSaleItem,
} from '../../services/adminItemsApi';
import type {
  AdminItemModerationPagination,
  AdminItemModerationRow,
  ItemModerationQueueStatus,
} from '../../types/adminItems';

const PAGE_SIZE = 20;

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export default function AdminItemModerationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { me, loading: profileLoading } = useProfileMe();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS, me);

  const [status, setStatus] = useState<ItemModerationQueueStatus>('pending');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminItemModerationRow[]>([]);
  const [pagination, setPagination] = useState<AdminItemModerationPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [approveItem, setApproveItem] = useState<AdminItemModerationRow | null>(null);
  const [overruleItem, setOverruleItem] = useState<AdminItemModerationRow | null>(null);
  const [rejectItem, setRejectItem] = useState<AdminItemModerationRow | null>(null);
  const [messageItem, setMessageItem] = useState<AdminItemModerationRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAdmin) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetchItemModerationQueue({ status, page, limit: PAGE_SIZE });
        setItems(res.items);
        setPagination(res.pagination);
      } catch (e: unknown) {
        setItems([]);
        setPagination(null);
        setError(
          e instanceof Error
            ? e.message
            : t('admin.items.moderation.loadError', 'Could not load queue')
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, page, status, t]
  );

  useEffect(() => {
    if (!profileLoading && isAdmin) void load();
  }, [isAdmin, load, profileLoading]);

  const runApprove = useCallback(
    async (item: AdminItemModerationRow, successKey: string, successDefault: string) => {
      setActionBusy(true);
      try {
        const ok = await approveSaleItem(item.id);
        setApproveItem(null);
        setOverruleItem(null);
        setSnack(
          ok
            ? t(successKey, successDefault)
            : t('admin.items.moderation.actionFailed', 'Action failed')
        );
        if (ok) await load({ silent: true });
      } catch (e: unknown) {
        setSnack(
          e instanceof Error
            ? e.message
            : t('admin.items.moderation.actionFailed', 'Action failed')
        );
      } finally {
        setActionBusy(false);
      }
    },
    [load, t]
  );

  const onConfirmApprove = useCallback(async () => {
    if (!approveItem) return;
    await runApprove(
      approveItem,
      'admin.items.moderation.approveSuccess',
      'Item approved'
    );
  }, [approveItem, runApprove]);

  const onConfirmOverrule = useCallback(async () => {
    if (!overruleItem) return;
    await runApprove(
      overruleItem,
      'admin.items.moderation.overruleSuccess',
      'Rejection overruled — item approved'
    );
  }, [overruleItem, runApprove]);

  const onConfirmReject = useCallback(async () => {
    const reason = rejectNote.trim();
    if (!rejectItem || !reason) return;
    setActionBusy(true);
    try {
      const ok = await rejectSaleItem(rejectItem.id, reason);
      setRejectItem(null);
      setRejectNote('');
      if (ok) {
        setSnack(t('admin.items.moderation.rejectSuccess', 'Item rejected'));
        await load({ silent: true });
      } else {
        setSnack(t('admin.items.moderation.actionFailed', 'Action failed'));
      }
    } catch (e: unknown) {
      setSnack(
        e instanceof Error ? e.message : t('admin.items.moderation.actionFailed', 'Action failed')
      );
    } finally {
      setActionBusy(false);
    }
  }, [load, rejectItem, rejectNote, t]);

  const onConfirmMessage = useCallback(async () => {
    const body = messageBody.trim();
    if (!messageItem || !body) return;
    setActionBusy(true);
    try {
      await messageBusinessAboutItem(messageItem.id, {
        body,
        subject: messageSubject.trim() || undefined,
      });
      setMessageItem(null);
      setMessageSubject('');
      setMessageBody('');
      setSnack(t('admin.items.moderation.messageSent', 'Message sent to business'));
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('admin.items.moderation.messageFailed', 'Could not send message')
      );
    } finally {
      setActionBusy(false);
    }
  }, [messageBody, messageItem, messageSubject, t]);

  const openMessage = useCallback((item: AdminItemModerationRow) => {
    setMessageItem(item);
    setMessageSubject(
      t('admin.items.moderation.messageSubjectDefault', 'Re: {{name}}', {
        name: item.name,
      })
    );
    const aiNotes =
      item.rejection_reason?.trim() ||
      item.latest_ai_review?.decision_reason?.trim() ||
      '';
    setMessageBody(aiNotes);
  }, [t]);

  const renderItem = useCallback(
    ({ item }: { item: AdminItemModerationRow }) => (
      <ModerationItemCard
        item={item}
        actionBusy={actionBusy}
        onApprove={setApproveItem}
        onReject={(row) => {
          setRejectItem(row);
          setRejectNote('');
        }}
        onOverrule={setOverruleItem}
        onMessage={openMessage}
        onViewAiReview={(reviewId) =>
          navigation.navigate('AdminItemAiReviews', {
            reviewId,
            openedAt: Date.now(),
          })
        }
      />
    ),
    [actionBusy, navigation, openMessage]
  );

  if (profileLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { padding: spacing.lg, backgroundColor: colors.pageBackground }]}>
        <Text style={[typography.h6, { color: colors.error.main, textAlign: 'center' }]}>
          {t('admin.items.moderation.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  const sheetWidth = screenWidth - spacing.lg * 2;
  const firstApproveImage = approveItem?.item_images?.[0];
  const firstRejectImage = rejectItem?.item_images?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Text style={[typography.body2, { color: colors.text.secondary, marginBottom: spacing.sm }]}>
          {t(
            'admin.items.moderation.subtitle',
            'Review sale items before they appear in the public catalog.'
          )}
        </Text>
        <SegmentedButtons
          value={status}
          onValueChange={(v) => {
            setStatus(v as ItemModerationQueueStatus);
            setPage(1);
          }}
          buttons={[
            { value: 'pending', label: t('admin.items.moderation.filterPending', 'Pending') },
            { value: 'rejected', label: t('admin.items.moderation.filterRejected', 'Rejected') },
            { value: 'all', label: t('admin.items.moderation.filterAll', 'All') },
          ]}
        />
      </View>

      {error ? (
        <View style={{ padding: spacing.md }}>
          <Text style={{ color: colors.error.main }}>{error}</Text>
          <Button mode="contained-tonal" style={{ marginTop: spacing.sm }} onPress={() => void load()}>
            {t('common.retry', 'Retry')}
          </Button>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(row) => row.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load({ silent: true });
              }}
            />
          }
          ListEmptyComponent={
            <Text style={{ color: colors.text.secondary }}>
              {t('admin.items.moderation.empty', 'No items in this queue')}
            </Text>
          }
          ListFooterComponent={
            pagination && pagination.totalPages > 1 ? (
              <View style={styles.footer}>
                <Button
                  disabled={!pagination.hasPrev || loading}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('common.prev', 'Prev')}
                </Button>
                <Text style={{ color: colors.text.secondary }}>
                  {t('admin.items.moderation.pageOf', 'Page {{page}} of {{total}}', {
                    page: pagination.page,
                    total: pagination.totalPages,
                  })}
                </Text>
                <Button
                  disabled={!pagination.hasNext || loading}
                  onPress={() => setPage((p) => p + 1)}
                >
                  {t('common.next', 'Next')}
                </Button>
              </View>
            ) : null
          }
        />
      )}

      <Modal
        visible={!!approveItem}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setApproveItem(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.scrim} onPress={() => !actionBusy && setApproveItem(null)}>
          <Pressable
            style={[
              styles.sheet,
              {
                width: sheetWidth,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {firstApproveImage ? (
              <Image
                source={{ uri: firstApproveImage.image_url }}
                style={[styles.confirmThumb, { borderRadius: borderRadius.sm, borderColor: colors.divider }]}
                resizeMode="cover"
              />
            ) : null}
            <Text style={[typography.h6, { color: colors.text.primary, marginTop: firstApproveImage ? spacing.sm : 0 }]}>
              {t('admin.items.moderation.approveTitle', 'Approve item?')}
            </Text>
            {approveItem ? (
              <Text
                style={[typography.subtitle2, { color: colors.text.secondary, marginTop: 4 }]}
                numberOfLines={2}
              >
                {approveItem.name}
              </Text>
            ) : null}
            <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.sm }]}>
              {t(
                'admin.items.moderation.approveBody',
                'This item will become visible in the public catalog.'
              )}
            </Text>
            <View style={[styles.sheetActions, { marginTop: spacing.md }]}>
              <Button mode="text" disabled={actionBusy} onPress={() => setApproveItem(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button mode="contained" loading={actionBusy} onPress={() => void onConfirmApprove()}>
                {t('admin.items.moderation.approve', 'Approve')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!overruleItem}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setOverruleItem(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.scrim} onPress={() => !actionBusy && setOverruleItem(null)}>
          <Pressable
            style={[
              styles.sheet,
              {
                width: sheetWidth,
                maxHeight: screenHeight * 0.85,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[typography.h6, { color: colors.text.primary }]}>
              {t('admin.items.moderation.overruleTitle', 'Overrule rejection?')}
            </Text>
            {overruleItem ? (
              <Text
                style={[typography.subtitle2, { color: colors.text.secondary, marginTop: 4 }]}
                numberOfLines={2}
              >
                {overruleItem.name}
              </Text>
            ) : null}
            <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.sm }]}>
              {t(
                'admin.items.moderation.overruleBody',
                'This will approve the item and make it visible in the catalog despite the prior rejection.'
              )}
            </Text>
            {overruleItem?.rejection_reason ? (
              <ScrollView style={{ marginTop: spacing.sm, maxHeight: 120 }}>
                <Text style={[typography.caption, { color: colors.text.secondary }]}>
                  {t('admin.items.moderation.rejectionReason', 'Rejection reason')}
                </Text>
                <Text style={[typography.body2, { color: colors.text.primary, marginTop: 4 }]}>
                  {overruleItem.rejection_reason}
                </Text>
              </ScrollView>
            ) : null}
            <View style={[styles.sheetActions, { marginTop: spacing.md }]}>
              <Button mode="text" disabled={actionBusy} onPress={() => setOverruleItem(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button mode="contained" loading={actionBusy} onPress={() => void onConfirmOverrule()}>
                {t('admin.items.moderation.overruleApprove', 'Approve (overrule)')}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!rejectItem}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setRejectItem(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.kavFull}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={styles.scrim}
            onPress={() => {
              Keyboard.dismiss();
              if (!actionBusy) setRejectItem(null);
            }}
          >
            <Pressable
              style={[
                styles.sheet,
                {
                  width: sheetWidth,
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                  padding: spacing.lg,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {firstRejectImage ? (
                <Image
                  source={{ uri: firstRejectImage.image_url }}
                  style={[styles.confirmThumb, { borderRadius: borderRadius.sm, borderColor: colors.divider }]}
                  resizeMode="cover"
                />
              ) : null}
              <Text style={[typography.h6, { color: colors.text.primary, marginTop: firstRejectImage ? spacing.sm : 0 }]}>
                {t('admin.items.moderation.rejectTitle', 'Reject item')}
              </Text>
              {rejectItem ? (
                <Text
                  style={[typography.subtitle2, { color: colors.text.secondary, marginTop: 4 }]}
                  numberOfLines={2}
                >
                  {rejectItem.name}
                </Text>
              ) : null}
              <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.sm, marginBottom: spacing.sm }]}>
                {t(
                  'admin.items.moderation.rejectBody',
                  'Provide a reason. The business will be notified by email.'
                )}
              </Text>
              <QuickRejectionResponses
                value={rejectNote}
                onSelect={(response) => {
                  setRejectNote((current) => {
                    if (current.includes(response)) return current;
                    return current.trim() ? `${current.trim()}\n${response}` : response;
                  });
                }}
              />
              <TextInput
                mode="outlined"
                multiline
                numberOfLines={3}
                label={t('admin.items.moderation.rejectPlaceholder', 'Reason for rejection')}
                value={rejectNote}
                onChangeText={setRejectNote}
                blurOnSubmit
              />
              <View style={[styles.sheetActions, { marginTop: spacing.md }]}>
                <Button
                  mode="text"
                  disabled={actionBusy}
                  onPress={() => {
                    Keyboard.dismiss();
                    setRejectItem(null);
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  loading={actionBusy}
                  disabled={!rejectNote.trim()}
                  buttonColor={colors.error.main}
                  onPress={() => void onConfirmReject()}
                >
                  {t('admin.items.moderation.reject', 'Reject')}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!messageItem}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setMessageItem(null)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.kavFull}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={styles.scrim}
            onPress={() => {
              Keyboard.dismiss();
              if (!actionBusy) setMessageItem(null);
            }}
          >
            <Pressable
              style={[
                styles.sheet,
                {
                  width: sheetWidth,
                  maxHeight: screenHeight * 0.85,
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.lg,
                  paddingHorizontal: spacing.lg,
                  paddingTop: spacing.lg,
                  paddingBottom: Math.max(insets.bottom, spacing.lg),
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[typography.h6, { color: colors.text.primary }]}>
                {t('admin.items.moderation.messageTitle', 'Message business')}
              </Text>
              {messageItem ? (
                <Text
                  style={[typography.subtitle2, { color: colors.text.secondary, marginTop: 4 }]}
                  numberOfLines={2}
                >
                  {messageItem.business?.name} — {messageItem.name}
                </Text>
              ) : null}
              <TextInput
                mode="outlined"
                style={{ marginTop: spacing.sm }}
                label={t('admin.items.moderation.messageSubject', 'Subject')}
                value={messageSubject}
                onChangeText={setMessageSubject}
              />
              <TextInput
                mode="outlined"
                style={{ marginTop: spacing.sm }}
                multiline
                numberOfLines={4}
                label={t('admin.items.moderation.messageBody', 'Message')}
                value={messageBody}
                onChangeText={setMessageBody}
              />
              <View style={[styles.sheetActions, { marginTop: spacing.md }]}>
                <Button
                  mode="text"
                  disabled={actionBusy}
                  onPress={() => {
                    Keyboard.dismiss();
                    setMessageItem(null);
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  loading={actionBusy}
                  disabled={!messageBody.trim()}
                  onPress={() => void onConfirmMessage()}
                >
                  {t('admin.items.moderation.messageSend', 'Send')}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  kavFull: { flex: 1 },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    maxHeight: '80%',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  confirmThumb: {
    width: '100%',
    height: 160,
    borderWidth: 1,
  },
});
