import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import type {
  ApplicantCard,
  DedicatedPostingView,
} from '../../../types/dedicatedAgents';

const ApplicantsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locationId, postingId } = useParams<{ locationId: string; postingId: string }>();
  const dedicatedApi = useDedicatedAgents();

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<DedicatedPostingView | null>(null);
  const [applications, setApplications] = useState<ApplicantCard[]>([]);
  const [editingTerms, setEditingTerms] = useState(false);
  const [newTerms, setNewTerms] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmAccept, setConfirmAccept] = useState<{ id: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!locationId || !postingId) return;

    try {
      setLoading(true);
      const response = await dedicatedApi.getApplications(locationId, postingId);
      setPosting(response.posting);
      setApplications(response.applications);
      setNewTerms(response.posting.terms || '');
    } catch (err: any) {
      console.error('Error loading applications:', err);
    } finally {
      setLoading(false);
    }
  }, [locationId, postingId, dedicatedApi]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAccept = async (applicationId: string) => {
    if (!locationId || !postingId) return;

    try {
      await dedicatedApi.acceptApplication(locationId, postingId, applicationId);
      await loadData();
      setConfirmAccept(null);
    } catch (err: any) {
      console.error('Error accepting application:', err);
    }
  };

  const handleDecline = async (applicationId: string) => {
    if (!locationId || !postingId) return;

    try {
      await dedicatedApi.declineApplication(locationId, postingId, applicationId);
      await loadData();
    } catch (err: any) {
      console.error('Error declining application:', err);
    }
  };

  const handleUpdateTerms = async () => {
    if (!locationId || !postingId) return;

    try {
      await dedicatedApi.updatePosting(locationId, postingId, {
        terms: newTerms.trim() || null,
      });
      await loadData();
      setEditingTerms(false);
    } catch (err: any) {
      console.error('Error updating terms:', err);
    }
  };

  const handleClose = async () => {
    if (!locationId || !postingId) return;

    try {
      await dedicatedApi.closePosting(locationId, postingId);
      navigate(`/business/locations/${locationId}/dedicated-agents`);
    } catch (err: any) {
      console.error('Error closing posting:', err);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (!posting) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Posting not found</Alert>
      </Container>
    );
  }

  const pending = applications.filter((a) => a.status === 'applied');
  const accepted = applications.filter((a) => a.status === 'accepted');
  const isOpen = posting.status === 'open';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/business/locations/${locationId}/dedicated-agents`)}
        sx={{ mb: 2 }}
      >
        {t('common.back', 'Back')}
      </Button>

      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack spacing={1} flex={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {posting.slotKeys.map((slotKey) => (
                  <Chip
                    key={slotKey}
                    label={t(`dedicatedAgents.slots.${slotKey}`, slotKey)}
                    size="small"
                  />
                ))}
              </Stack>
              
              <Typography variant="body2">
                {t('dedicatedAgents.posting.progress', '{{accepted}}/{{needed}} accepted', {
                  accepted: posting.acceptedCount,
                  needed: posting.headcount,
                })}
                {' · '}
                {new Date(posting.expiresAt).toLocaleDateString()}
              </Typography>
            </Stack>

            {isOpen && (
              <IconButton onClick={() => setConfirmClose(true)}>
                <CloseIcon />
              </IconButton>
            )}
          </Stack>

          {posting.terms && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" fontWeight={600}>
                  {t('dedicatedAgents.form.termsField', 'Terms / notes')}
                </Typography>
                {isOpen && !editingTerms && (
                  <IconButton size="small" onClick={() => setEditingTerms(true)}>
                    <EditIcon />
                  </IconButton>
                )}
              </Stack>

              {editingTerms ? (
                <Stack spacing={1}>
                  <TextField
                    multiline
                    rows={3}
                    value={newTerms}
                    onChange={(e) => setNewTerms(e.target.value.slice(0, 1000))}
                    fullWidth
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={() => setEditingTerms(false)}>
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button size="small" variant="contained" onClick={handleUpdateTerms}>
                      {t('common.save', 'Save')}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {posting.terms}
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </Paper>

      {pending.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            Pending ({pending.length})
          </Typography>
          <Stack spacing={1.5}>
            {pending.map((app) => (
              <Paper key={app.applicationId} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar src={app.agent.photoUrl || undefined}>
                    {app.agent.firstName[0]}
                  </Avatar>
                  
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="body1" fontWeight={600}>
                      {app.agent.firstName} {app.agent.lastName[0]}.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Joined {new Date(app.agent.joinedAt).toLocaleDateString()} · ✓{' '}
                      {app.deliveriesCompleted} · ✕ {app.missedDeliveries}
                      {app.onTimePickupPct !== null && ` · ${app.onTimePickupPct}% on-time`}
                      {app.distanceKm !== null && ` · ${app.distanceKm.toFixed(1)} km`}
                    </Typography>
                  </Stack>

                  {isOpen && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={() => handleDecline(app.applicationId)}
                      >
                        {t('dedicatedAgents.applicant.decline', 'Decline')}
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<CheckIcon />}
                        onClick={() =>
                          setConfirmAccept({
                            id: app.applicationId,
                            name: app.agent.firstName,
                          })
                        }
                      >
                        {t('dedicatedAgents.applicant.accept', 'Accept')}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {accepted.length > 0 && (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>
            Accepted ({accepted.length})
          </Typography>
          <Stack spacing={1.5}>
            {accepted.map((app) => (
              <Paper key={app.applicationId} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar src={app.agent.photoUrl || undefined}>
                    {app.agent.firstName[0]}
                  </Avatar>
                  
                  <Stack flex={1} spacing={0.5}>
                    <Typography variant="body1" fontWeight={600}>
                      {app.agent.firstName} {app.agent.lastName[0]}.
                    </Typography>
                    {app.phone && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <PhoneIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {app.phone}
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      <Dialog open={!!confirmAccept} onClose={() => setConfirmAccept(null)}>
        <DialogTitle>
          {confirmAccept &&
            (posting.acceptedCount + 1 === posting.headcount
              ? t(
                  'dedicatedAgents.applicant.acceptLastConfirm',
                  'Accept {{name}}? This fills the request and declines the other applicants.',
                  { name: confirmAccept.name }
                )
              : t('dedicatedAgents.applicant.acceptConfirm', 'Accept {{name}}?', {
                  name: confirmAccept.name,
                }))}
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmAccept(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => confirmAccept && handleAccept(confirmAccept.id)}
          >
            {t('dedicatedAgents.applicant.accept', 'Accept')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)}>
        <DialogTitle>
          {t(
            'dedicatedAgents.applicant.closeConfirm',
            'Close this request? Pending applicants will be declined.'
          )}
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmClose(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" color="error" onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ApplicantsScreen;
