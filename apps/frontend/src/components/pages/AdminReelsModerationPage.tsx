import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { usePermission } from '../../hooks/usePermissions';
import { useApiClient } from '../../hooks/useApiClient';

const REASON_IDS = [
  'inappropriate',
  'misleading',
  'lowQuality',
  'wrongProduct',
  'spam',
  'copyright',
  'other',
] as const;

type ReasonId = (typeof REASON_IDS)[number];

const REASON_DEFAULTS: Record<ReasonId, string> = {
  inappropriate: 'Inappropriate / adult content',
  misleading: 'Misleading product',
  lowQuality: 'Low quality / unusable',
  wrongProduct: 'Wrong or unrelated product',
  spam: 'Spam / promo spam',
  copyright: 'Copyright / trademark',
  other: 'Other',
};

type ReelRow = {
  id: string;
  caption: string | null;
  moderation_status: string;
  thumbnail_url: string | null;
  video_url: string | null;
};

const AdminReelsModerationPage: React.FC = () => {
  const { t } = useTranslation();
  const api = useApiClient();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS);
  const [rows, setRows] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonId, setReasonId] = useState<ReasonId | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = rows[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ReelRow[] | { data?: ReelRow[] }>(
        '/admin/reels/moderation?limit=50'
      );
      const body = res.data;
      setRows(Array.isArray(body) ? body : body?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const moderate = async (status: 'approved' | 'rejected', reason?: string) => {
    if (!current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/reels/${current.id}/moderation`, { status, reason });
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
      REASON_DEFAULTS[reasonId]
    );
    const reason =
      reasonId === 'other'
        ? notes.trim()
        : notes.trim()
          ? `${label}: ${notes.trim()}`
          : label;
    void moderate('rejected', reason);
  };

  if (!isAdmin) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>{t('admin.accessDenied', 'Access denied')}</Typography>
      </Container>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!current) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>
          {t('admin.reels.moderation.title', 'Reel moderation')}
        </Typography>
        <Typography sx={{ mb: 2 }}>
          {t('admin.reels.moderation.empty', 'No reels awaiting review')}
        </Typography>
        <Button component={RouterLink} to="/admin/reels/ai-reviews" variant="outlined">
          {t('admin.reels.moderation.openAiAudit', 'AI review audit')}
        </Button>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#000',
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 2, right: 120 }}>
        <Typography color="#fff" fontWeight={600}>
          {current.caption || current.id}
        </Typography>
        <Button
          component={RouterLink}
          to="/admin/reels/ai-reviews"
          size="small"
          sx={{ color: '#fff', mt: 1 }}
        >
          {t('admin.reels.moderation.openAiAudit', 'AI review audit')}
        </Button>
      </Box>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxHeight: 'calc(100vh - 160px)',
        }}
      >
        {current.video_url ? (
          <Box
            component="video"
            key={current.id}
            src={current.video_url}
            poster={current.thumbnail_url ?? undefined}
            controls
            autoPlay
            loop
            playsInline
            sx={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '100%',
              bgcolor: '#000',
            }}
          />
        ) : (
          <Typography color="#fff">
            {t('admin.reels.moderation.noVideo', 'Video not ready')}
          </Typography>
        )}
      </Box>
      {error ? (
        <Typography color="error" textAlign="center" sx={{ mb: 1 }}>
          {error}
        </Typography>
      ) : null}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          p: 2,
          bgcolor: 'rgba(0,0,0,0.75)',
          justifyContent: 'center',
        }}
      >
        <Button
          variant="contained"
          color="error"
          disabled={busy}
          onClick={() => setRejectOpen(true)}
          sx={{ minWidth: 140 }}
        >
          {t('admin.reels.moderation.reject', 'Reject')}
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={busy}
          onClick={() => void moderate('approved')}
          sx={{ minWidth: 140 }}
        >
          {t('admin.reels.moderation.approve', 'Approve')}
        </Button>
      </Stack>

      <Dialog open={rejectOpen} onClose={() => !busy && setRejectOpen(false)} fullWidth>
        <DialogTitle>
          {t('admin.reels.moderation.rejectTitle', 'Reject reel')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {t(
              'admin.reels.moderation.rejectBody',
              'Choose a reason. Merchants see this when their reel is rejected.'
            )}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {REASON_IDS.map((id) => (
              <Chip
                key={id}
                label={t(
                  `admin.reels.moderation.reasons.${id}`,
                  REASON_DEFAULTS[id]
                )}
                color={reasonId === id ? 'primary' : 'default'}
                onClick={() => setReasonId(id)}
              />
            ))}
          </Stack>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label={
              reasonId === 'other'
                ? t('admin.reels.moderation.rejectPlaceholder', 'Describe the issue')
                : t('admin.reels.moderation.notesOptional', 'Extra notes (optional)')
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)} disabled={busy}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!canSubmitReject || busy}
            onClick={onSubmitReject}
          >
            {t('admin.reels.moderation.submitReject', 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminReelsModerationPage;
