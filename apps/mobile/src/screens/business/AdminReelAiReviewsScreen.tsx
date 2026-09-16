import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Dialog,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { apiRequest } from '../../services/apiClient';

type ReviewRow = {
  id: string;
  reel_id: string;
  status: string;
  decision_reason: string | null;
  prompt_version: string;
  admin_feedback: string | null;
  created_at: string;
  reel?: {
    caption: string | null;
    thumbnail_url: string | null;
    video_url: string | null;
    moderation_status: string;
  } | null;
};

type ReviewDetail = ReviewRow & {
  raw_model_response?: unknown;
  admin_feedback_notes?: string | null;
};

export default function AdminReelAiReviewsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { me } = useProfileMe();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS, me);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiRequest<{ reviews: ReviewRow[] }>(
      '/admin/reels/ai-reviews?status=all&page=1&limit=30'
    );
    setReviews(res?.reviews ?? []);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load()
      .catch((e: unknown) =>
        setSnack(e instanceof Error ? e.message : 'Load failed')
      )
      .finally(() => setLoading(false));
  }, [isAdmin, load]);

  const openDetail = async (id: string) => {
    try {
      const row = await apiRequest<ReviewDetail>(`/admin/reels/ai-reviews/${id}`);
      setDetail(row);
      setNotes(row.admin_feedback_notes ?? '');
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Failed to load detail');
    }
  };

  const onFeedback = async (feedback: 'agree' | 'disagree') => {
    if (!detail) return;
    setBusy(true);
    try {
      await apiRequest(`/admin/reels/ai-reviews/${detail.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback, notes: notes.trim() || undefined }),
      });
      setSnack(t('admin.reels.aiReviews.feedbackSaved', 'Feedback saved'));
      setDetail(null);
      await load();
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
      await apiRequest(`/admin/reels/ai-reviews/${detail.id}/override`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          reason:
            action === 'force_reject'
              ? notes.trim() ||
                t(
                  'admin.reels.aiReviews.defaultOverrideReject',
                  'Admin reversed the AI decision'
                )
              : undefined,
        }),
      });
      setSnack(t('admin.reels.aiReviews.overrideSaved', 'Override applied'));
      setDetail(null);
      await load();
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text>{t('admin.accessDenied', 'Access denied')}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: spacing.lg }}>
            {t('admin.reels.aiReviews.empty', 'No AI reviews yet')}
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              padding: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: 12,
            }}
          >
            <Text variant="titleSmall">
              {item.reel?.caption || item.reel_id}
            </Text>
            <Text variant="bodySmall">
              {item.status} · {item.prompt_version}
            </Text>
            <Text variant="bodySmall" numberOfLines={2}>
              {item.decision_reason}
            </Text>
            <Button compact onPress={() => void openDetail(item.id)}>
              {t('admin.reels.aiReviews.open', 'Open')}
            </Button>
          </View>
        )}
      />
      <Portal>
        <Dialog visible={!!detail} onDismiss={() => !busy && setDetail(null)}>
          <Dialog.Title>
            {t('admin.reels.aiReviews.detailTitle', 'AI review')}
          </Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 420 }}>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{ marginBottom: 8 }}>
                {detail?.decision_reason}
              </Text>
              <Text variant="bodySmall" style={{ marginBottom: 8 }}>
                {detail?.status} · {detail?.prompt_version}
              </Text>
              <TextInput
                mode="outlined"
                label={t('admin.reels.aiReviews.notes', 'Notes')}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </Dialog.Content>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button disabled={busy} onPress={() => void onFeedback('agree')}>
              {t('admin.reels.aiReviews.agree', 'Agree')}
            </Button>
            <Button disabled={busy} onPress={() => void onFeedback('disagree')}>
              {t('admin.reels.aiReviews.disagree', 'Disagree')}
            </Button>
            <Button disabled={busy} onPress={() => void onOverride('force_approve')}>
              {t('admin.reels.aiReviews.forceApprove', 'Force approve')}
            </Button>
            <Button disabled={busy} onPress={() => void onOverride('force_reject')}>
              {t('admin.reels.aiReviews.forceReject', 'Force reject')}
            </Button>
            <Button disabled={busy} onPress={() => void onOverride('force_requeue')}>
              {t('admin.reels.aiReviews.requeue', 'Requeue AI')}
            </Button>
            <Button onPress={() => setDetail(null)} disabled={busy}>
              {t('common.close', 'Close')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dialogActions: { flexWrap: 'wrap', justifyContent: 'flex-start' },
});
