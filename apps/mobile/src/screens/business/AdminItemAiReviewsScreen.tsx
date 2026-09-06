import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusPill } from '../../components/common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import type { BusinessRootStackParamList } from '../../navigation/types';
import {
  fetchItemAiReviewDetail,
  fetchItemAiReviews,
  overrideItemAiReview,
  submitItemAiReviewFeedback,
} from '../../services/adminItemsApi';
import type {
  AdminItemAiReviewDetail,
  AdminItemAiReviewRow,
  AdminItemModerationPagination,
  ItemAiReviewAuditStatus,
} from '../../types/adminItems';

const PAGE_SIZE = 20;

export default function AdminItemAiReviewsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const route = useRoute<RouteProp<BusinessRootStackParamList, 'AdminItemAiReviews'>>();
  const initialReviewId = route.params?.reviewId;
  const openedAt = route.params?.openedAt;
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, loading: profileLoading } = useProfileMe();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS, me);

  const [status, setStatus] = useState<ItemAiReviewAuditStatus>('all');
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<AdminItemAiReviewRow[]>([]);
  const [pagination, setPagination] =
    useState<AdminItemModerationPagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<AdminItemAiReviewDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const openDetailRequestRef = React.useRef(0);
  const lastOpenedAtRef = React.useRef<number | undefined>(undefined);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAdmin) return;
      if (!opts?.silent) setLoading(true);
      try {
        const res = await fetchItemAiReviews({ status, page, limit: PAGE_SIZE });
        setReviews(res.reviews);
        setPagination(res.pagination);
      } catch (e: unknown) {
        setReviews([]);
        setSnack(e instanceof Error ? e.message : 'Load failed');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, status, page]
  );

  const openDetail = useCallback(async (id: string) => {
    const requestId = ++openDetailRequestRef.current;
    try {
      const row = await fetchItemAiReviewDetail(id);
      if (requestId !== openDetailRequestRef.current) return;
      setDetail(row);
      setNotes(row.admin_feedback_notes ?? '');
    } catch (e: unknown) {
      if (requestId !== openDetailRequestRef.current) return;
      setSnack(e instanceof Error ? e.message : 'Failed to load detail');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!initialReviewId || !isAdmin || !openedAt) return;
      if (lastOpenedAtRef.current === openedAt) return;
      lastOpenedAtRef.current = openedAt;
      void openDetail(initialReviewId);
      navigation.setParams({ reviewId: undefined, openedAt: undefined });
    }, [initialReviewId, openedAt, isAdmin, openDetail, navigation])
  );

  const onFeedback = async (feedback: 'agree' | 'disagree') => {
    if (!detail) return;
    setBusy(true);
    try {
      await submitItemAiReviewFeedback(detail.id, feedback, notes.trim() || undefined);
      setSnack(t('admin.items.aiReviews.feedbackSaved', 'Feedback saved'));
      setDetail(null);
      void load({ silent: true });
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Feedback failed');
    } finally {
      setBusy(false);
    }
  };

  const onOverride = async (
    action: 'force_approve' | 'force_reject' | 'force_requeue'
  ) => {
    if (!detail) return;
    setBusy(true);
    try {
      await overrideItemAiReview(detail.id, action, notes.trim() || undefined);
      setSnack(t('admin.items.aiReviews.overrideSaved', 'Override applied'));
      setDetail(null);
      void load({ silent: true });
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setBusy(false);
    }
  };

  if (profileLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { padding: spacing.lg }]}>
        <Text>{t('admin.items.moderation.accessDenied', 'Access denied')}</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.pageBackground,
        paddingTop: insets.top,
      }}
    >
      <Text
        style={[
          typography.h6,
          { color: colors.text.primary, paddingHorizontal: spacing.md },
        ]}
      >
        {t('admin.items.aiReviews.title', 'Sale item AI reviews')}
      </Text>
      <SegmentedButtons
        style={{ margin: spacing.md }}
        value={status}
        onValueChange={(v) => {
          setPage(1);
          setStatus(v as ItemAiReviewAuditStatus);
        }}
        buttons={[
          { value: 'all', label: t('admin.items.aiReviews.filterAll', 'All') },
          {
            value: 'approved',
            label: t('admin.items.aiReviews.filterApproved', 'Approved'),
          },
          {
            value: 'rejected',
            label: t('admin.items.aiReviews.filterRejected', 'Rejected'),
          },
          {
            value: 'proposal',
            label: t('admin.items.aiReviews.filterProposal', 'Proposals'),
          },
        ]}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load({ silent: true });
              }}
            />
          }
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <Text style={{ color: colors.text.secondary }}>
              {t('admin.items.aiReviews.empty', 'No AI reviews yet.')}
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                shadows.sm,
                {
                  borderColor: colors.divider,
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              <Text style={{ color: colors.text.primary, fontWeight: '600' }}>
                {item.item?.name ?? item.item_id}
              </Text>
              <Text style={{ color: colors.text.secondary, marginTop: 4 }}>
                {item.item?.business?.name}
              </Text>
              <StatusPill
                compact
                style={{ marginTop: 8 }}
                label={item.status}
                backgroundColor={colors.info.main + '22'}
                textColor={colors.info.main}
              />
              {item.decision_reason ? (
                <Text
                  numberOfLines={3}
                  style={{ color: colors.text.secondary, marginTop: 8 }}
                >
                  {item.decision_reason}
                </Text>
              ) : null}
              <Text style={{ color: colors.text.secondary, marginTop: 4, fontSize: 12 }}>
                {item.prompt_version}
                {item.admin_feedback ? ` · ${item.admin_feedback}` : ''}
              </Text>
              <Button mode="text" onPress={() => void openDetail(item.id)}>
                {t('admin.items.aiReviews.open', 'Review')}
              </Button>
            </View>
          )}
          ListFooterComponent={
            pagination && pagination.totalPages > 1 ? (
              <View style={styles.footer}>
                <Button
                  disabled={!pagination.hasPrev || loading}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('common.prev', 'Prev')}
                </Button>
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

      <Portal>
        <Dialog visible={!!detail} onDismiss={() => setDetail(null)}>
          <Dialog.Title>
            {t('admin.items.aiReviews.detailTitle', 'AI decision detail')}
          </Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 420 }}>
            <ScrollView>
              <Text style={{ color: colors.text.primary, fontWeight: '600' }}>
                {detail?.item?.name}
              </Text>
              <Text style={{ color: colors.text.secondary, marginTop: 8 }}>
                {detail?.decision_reason}
              </Text>
              <Text style={{ color: colors.text.secondary, marginTop: 8, fontSize: 12 }}>
                {JSON.stringify(detail?.rubric ?? {}, null, 2)}
              </Text>
              <TextInput
                mode="outlined"
                multiline
                label={t('admin.items.aiReviews.notes', 'Notes')}
                value={notes}
                onChangeText={setNotes}
                style={{ marginTop: spacing.md }}
              />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={{ flexWrap: 'wrap' }}>
            <Button disabled={busy} onPress={() => void onFeedback('agree')}>
              {t('admin.items.aiReviews.agree', 'Agree')}
            </Button>
            <Button disabled={busy} onPress={() => void onFeedback('disagree')}>
              {t('admin.items.aiReviews.disagree', 'Disagree')}
            </Button>
            <Button disabled={busy} onPress={() => void onOverride('force_approve')}>
              {t('admin.items.aiReviews.forceApprove', 'Force approve')}
            </Button>
            <Button disabled={busy} onPress={() => void onOverride('force_reject')}>
              {t('admin.items.aiReviews.forceReject', 'Force reject')}
            </Button>
            <Button disabled={busy} onPress={() => void onOverride('force_requeue')}>
              {t('admin.items.aiReviews.requeue', 'Requeue')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
