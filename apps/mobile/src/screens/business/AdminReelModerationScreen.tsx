import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission } from '../../hooks/usePermissions';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { apiRequest } from '../../services/apiClient';
import { ReelPlayer } from '../../components/reels/ReelPlayer';
import {
  REEL_REJECT_REASON_DEFAULTS,
  REEL_REJECT_REASON_IDS,
  resolveReelRejectReason,
  type ReelRejectReasonId,
} from '../../utils/reelRejectReasons';

type ReelRow = {
  id: string;
  caption: string | null;
  moderation_status: string;
  thumbnail_url: string | null;
  video_url: string | null;
  business_id: string;
};

export default function AdminReelModerationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { me } = useProfileMe();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS, me);
  const [rows, setRows] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonId, setReasonId] = useState<ReelRejectReasonId | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = rows[0] ?? null;

  const load = useCallback(async () => {
    const res = await apiRequest<ReelRow[]>('/admin/reels/moderation?limit=50');
    setRows(Array.isArray(res) ? res : []);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load()
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load')
      )
      .finally(() => setLoading(false));
  }, [isAdmin, load]);

  const moderate = async (status: 'approved' | 'rejected', reason?: string) => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/admin/reels/${current.id}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      });
      setRows((prev) => prev.slice(1));
      setRejectOpen(false);
      setReasonId(null);
      setNotes('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Moderation failed');
    } finally {
      setBusy(false);
    }
  };

  const canSubmitReject = useMemo(() => {
    if (!reasonId) return false;
    if (reasonId === 'other') return notes.trim().length > 0;
    return true;
  }, [reasonId, notes]);

  const onSubmitReject = () => {
    if (!reasonId || !canSubmitReject) return;
    const label = t(
      `admin.reels.moderation.reasons.${reasonId}`,
      REEL_REJECT_REASON_DEFAULTS[reasonId]
    );
    void moderate('rejected', resolveReelRejectReason(reasonId, notes, label));
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
      <View style={[styles.center, { backgroundColor: '#000' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!current) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: 24 }]}>
        <Text style={{ textAlign: 'center', marginBottom: 16 }}>
          {t('admin.reels.moderation.empty', 'No reels awaiting review')}
        </Text>
        <Button mode="outlined" onPress={() => navigation.navigate('AdminReelAiReviews' as never)}>
          {t('admin.reels.moderation.openAiAudit', 'AI review audit')}
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {current.video_url ? (
        <ReelPlayer
          uri={current.video_url}
          active
          posterUri={current.thumbnail_url}
        />
      ) : (
        <View style={[styles.center, { height }]}>
          <Text style={{ color: '#fff' }}>
            {t('admin.reels.moderation.noVideo', 'Video not ready')}
          </Text>
        </View>
      )}
      <View style={[styles.caption, { top: insets.top + 8 }]} pointerEvents="none">
        <Text style={styles.captionText} numberOfLines={3}>
          {current.caption || current.id}
        </Text>
      </View>
      {error ? (
        <Text style={[styles.error, { bottom: insets.bottom + 88 }]}>{error}</Text>
      ) : null}
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          mode="contained"
          buttonColor={colors.error.main}
          textColor="#fff"
          loading={busy}
          disabled={busy}
          onPress={() => setRejectOpen(true)}
          style={styles.actionBtn}
        >
          {t('admin.reels.moderation.reject', 'Reject')}
        </Button>
        <Button
          mode="contained"
          buttonColor={colors.success?.main ?? colors.primary.main}
          textColor="#fff"
          loading={busy}
          disabled={busy}
          onPress={() => void moderate('approved')}
          style={styles.actionBtn}
        >
          {t('admin.reels.moderation.approve', 'Approve')}
        </Button>
      </View>
      <Portal>
        <Dialog visible={rejectOpen} onDismiss={() => !busy && setRejectOpen(false)}>
          <Dialog.Title>
            {t('admin.reels.moderation.rejectTitle', 'Reject reel')}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12 }}>
              {t(
                'admin.reels.moderation.rejectBody',
                'Choose a reason. Merchants see this when their reel is rejected.'
              )}
            </Text>
            <View style={styles.chips}>
              {REEL_REJECT_REASON_IDS.map((id) => (
                <Chip
                  key={id}
                  selected={reasonId === id}
                  onPress={() => setReasonId(id)}
                  style={{ marginBottom: 8 }}
                >
                  {t(
                    `admin.reels.moderation.reasons.${id}`,
                    REEL_REJECT_REASON_DEFAULTS[id]
                  )}
                </Chip>
              ))}
            </View>
            <TextInput
              mode="outlined"
              label={
                reasonId === 'other'
                  ? t('admin.reels.moderation.rejectPlaceholder', 'Describe the issue')
                  : t('admin.reels.moderation.notesOptional', 'Extra notes (optional)')
              }
              value={notes}
              onChangeText={setNotes}
              multiline
              style={{ marginTop: 8 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectOpen(false)} disabled={busy}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onPress={onSubmitReject}
              loading={busy}
              disabled={!canSubmitReject || busy}
            >
              {t('admin.reels.moderation.submitReject', 'Reject')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  caption: {
    position: 'absolute',
    left: 16,
    right: 72,
  },
  captionText: { color: '#fff', fontWeight: '600' },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  actionBtn: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: {
    position: 'absolute',
    left: 16,
    right: 16,
    color: '#ff8a80',
    textAlign: 'center',
  },
});
