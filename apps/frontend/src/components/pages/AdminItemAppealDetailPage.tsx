import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { useItemAppealsAdmin } from '../../hooks/useItemAppealsAdmin';
import { usePermission } from '../../hooks/usePermissions';
import type { AppealDetail } from '../../types/itemAppealsAdmin';
import type { ItemSnapshot, RejectionCategory } from '../../types/itemRejectionRecovery';
import { REJECTION_CATEGORIES } from '../../types/itemRejectionRecovery';
import {
  categoryDefaultLabel,
  categoryLabelKey,
  extractRecoveryErrorCode,
  recoveryErrorI18n,
} from '../../utils/itemRejectionRecovery';
import { AppealSlaBadge } from '../admin/AppealSlaBadge';

const AdminItemAppealDetailPage: React.FC = () => {
  const { appealId = '' } = useParams();
  const { t } = useTranslation();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS);
  const { detail, loading, error, fetchDetail, decide } = useItemAppealsAdmin();

  useEffect(() => {
    if (isAdmin && appealId) void fetchDetail(appealId);
  }, [appealId, fetchDetail, isAdmin]);

  if (!isAdmin) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="error" variant="h6">
          {t('admin.itemAppeals.accessDenied', 'Access denied')}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button component={RouterLink} to="/admin/item-appeals" sx={{ mb: 2 }}>
        {t('admin.itemAppeals.backToQueue', 'Back to appeals')}
      </Button>
      {loading && !detail ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}
      {error ? (
        <Typography color="error">
          {t('admin.itemAppeals.loadError', 'Could not load appeals')}: {error}
        </Typography>
      ) : null}
      {detail ? <AppealDetailBody detail={detail} onDecide={decide} /> : null}
    </Container>
  );
};

function AppealDetailBody({
  detail,
  onDecide,
}: {
  detail: AppealDetail;
  onDecide: ReturnType<typeof useItemAppealsAdmin>['decide'];
}) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<'uphold' | 'overturn'>('uphold');
  const [overturnTo, setOverturnTo] = useState<'approve' | 're_review'>(
    detail.editedSinceRejection ? 're_review' : 'approve'
  );
  const [note, setNote] = useState('');
  const [correctedCategory, setCorrectedCategory] = useState<RejectionCategory | ''>(
    detail.rejection?.category ?? ''
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (decision === 'uphold' && !note.trim()) return;
    setBusy(true);
    try {
      const result = await onDecide(detail.appeal.id, {
        decision,
        note: note.trim() || undefined,
        overturnTo: decision === 'overturn' ? overturnTo : undefined,
        correctedCategory: correctedCategory || undefined,
      });
      if (result.warnings.includes('SELF_REVIEW_NO_OTHER_ADMIN')) {
        enqueueSnackbar(
          t(
            'admin.itemAppeals.selfReviewWarning',
            'You are the only moderator. This decision was recorded with a warning.'
          ),
          { variant: 'warning' }
        );
      }
      enqueueSnackbar(t('admin.itemAppeals.decided', 'Appeal decided'), {
        variant: 'success',
      });
      navigate('/admin/item-appeals');
    } catch (error: unknown) {
      const copy = recoveryErrorI18n(extractRecoveryErrorCode(error));
      enqueueSnackbar(t(copy.key, copy.defaultValue), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">
        {detail.item?.name ?? t('admin.itemAppeals.untitled', 'Untitled item')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {detail.business?.name ?? '—'}
      </Typography>
      <AppealSlaBadge state={detail.appeal.slaState} dueAt={detail.appeal.slaDueAt} />
      {detail.selfReview ? (
        <Alert severity="warning">
          {t(
            'admin.itemAppeals.selfReviewNotice',
            'This appeal is about a rejection you made. Another moderator should decide it when one is available.'
          )}
        </Alert>
      ) : null}
      {detail.editedSinceRejection ? (
        <Alert severity="info">
          {t(
            'admin.itemAppeals.editedSince',
            'The item changed after the rejection. Overturn will send it back for review.'
          )}
        </Alert>
      ) : null}
      <ComparisonCards
        snapshot={detail.rejection?.itemSnapshot ?? null}
        current={detail.item}
        edited={detail.editedSinceRejection}
      />
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            {t('admin.itemAppeals.rejection', 'Original rejection')}
          </Typography>
          <Typography variant="body2">
            {detail.rejection?.category
              ? t(
                  categoryLabelKey(detail.rejection.category),
                  categoryDefaultLabel(detail.rejection.category)
                )
              : '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {detail.rejection?.reason || '—'}
          </Typography>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            {t('admin.itemAppeals.appealEvidence', 'Appeal')}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
            {detail.appeal.reason}
          </Typography>
          <EvidenceList urls={detail.appeal.evidenceUrls} />
        </CardContent>
      </Card>
      <HistoryList detail={detail} />
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            {t('admin.itemAppeals.decide', 'Decide')}
          </Typography>
          <RadioGroup
            row
            value={decision}
            onChange={(e) => setDecision(e.target.value as 'uphold' | 'overturn')}
          >
            <FormControlLabel
              value="uphold"
              control={<Radio />}
              label={t('admin.itemAppeals.uphold', 'Uphold')}
            />
            <FormControlLabel
              value="overturn"
              control={<Radio />}
              label={t('admin.itemAppeals.overturn', 'Overturn')}
            />
          </RadioGroup>
          {decision === 'overturn' ? (
            <FormControl size="small" sx={{ minWidth: 220, my: 1 }}>
              <InputLabel>{t('admin.itemAppeals.overturnTo', 'After overturn')}</InputLabel>
              <Select
                label={t('admin.itemAppeals.overturnTo', 'After overturn')}
                value={detail.editedSinceRejection ? 're_review' : overturnTo}
                disabled={detail.editedSinceRejection}
                onChange={(e) =>
                  setOverturnTo(e.target.value as 'approve' | 're_review')
                }
              >
                <MenuItem value="approve">
                  {t('admin.itemAppeals.approve', 'Approve')}
                </MenuItem>
                <MenuItem value="re_review">
                  {t('admin.itemAppeals.reReview', 'Re-review')}
                </MenuItem>
              </Select>
            </FormControl>
          ) : null}
          <FormControl fullWidth size="small" sx={{ my: 1 }}>
            <InputLabel>{t('admin.itemAppeals.correctCategory', 'Correct category')}</InputLabel>
            <Select
              label={t('admin.itemAppeals.correctCategory', 'Correct category')}
              value={correctedCategory}
              onChange={(e) =>
                setCorrectedCategory(e.target.value as RejectionCategory | '')
              }
            >
              {REJECTION_CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {t(categoryLabelKey(category), categoryDefaultLabel(category))}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            minRows={3}
            required={decision === 'uphold'}
            label={t('admin.itemAppeals.note', 'Note to the business')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
            sx={{ my: 1 }}
          />
          <Button
            variant="contained"
            disabled={busy || (decision === 'uphold' && !note.trim())}
            onClick={() => void submit()}
          >
            {t('admin.itemAppeals.submitDecision', 'Submit decision')}
          </Button>
        </CardContent>
      </Card>
    </Stack>
  );
}

function ComparisonCards({
  snapshot,
  current,
  edited,
}: {
  snapshot: ItemSnapshot | null;
  current: ItemSnapshot | null;
  edited: boolean;
}) {
  const { t } = useTranslation();
  if (!edited) {
    return <ItemCard title={t('admin.itemAppeals.currentItem', 'Current item')} item={current} />;
  }
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { md: '1fr 1fr' } }}>
      <ItemCard title={t('admin.itemAppeals.asRejected', 'As rejected')} item={snapshot} />
      <ItemCard title={t('admin.itemAppeals.currentItem', 'Current item')} item={current} />
    </Box>
  );
}

function ItemCard({ title, item }: { title: string; item: ItemSnapshot | null }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2">{item?.name || '—'}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
          {item?.description || '—'}
        </Typography>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          {item?.price != null ? `${item.price} ${item.currency ?? ''}`.trim() : '—'}
          {item?.condition ? ` · ${item.condition}` : ''}
        </Typography>
        <EvidenceList
          urls={(item?.item_images ?? [])
            .map((image) => image.image_url)
            .filter((url): url is string => Boolean(url))}
        />
      </CardContent>
    </Card>
  );
}

function EvidenceList({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
      {urls.map((url) =>
        url.toLowerCase().endsWith('.pdf') ? (
          <Button key={url} href={url} target="_blank" rel="noreferrer" size="small">
            PDF
          </Button>
        ) : (
          <Box
            key={url}
            component="img"
            src={url}
            alt=""
            sx={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 1 }}
          />
        )
      )}
    </Box>
  );
}

function HistoryList({ detail }: { detail: AppealDetail }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          {t('admin.itemAppeals.history', 'Item history')}
        </Typography>
        {detail.history.rejections.map((row) => (
          <Typography key={row.id} variant="body2" color="text.secondary">
            {row.createdAt} · {row.category} · {row.reason}
          </Typography>
        ))}
        {detail.history.audit.map((row) => (
          <Typography key={row.id ?? `${row.action}-${row.created_at}`} variant="caption" display="block">
            {row.created_at} · {row.action}
          </Typography>
        ))}
      </CardContent>
    </Card>
  );
}

export default AdminItemAppealDetailPage;
