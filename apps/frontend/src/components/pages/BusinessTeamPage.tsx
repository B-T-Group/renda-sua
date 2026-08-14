import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Close as CloseIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useBusinessDelegations } from '../../hooks/useBusinessDelegations';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import ConfirmationModal from '../common/ConfirmationModal';
import LoadingPage from '../common/LoadingPage';

const BusinessTeamPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { locations, loading: locationsLoading } = useBusinessLocations();
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

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [locationId, setLocationId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const defaultRoleId = useMemo(() => roles[0]?.id || '', [roles]);

  useEffect(() => {
    if (!roleId && defaultRoleId) setRoleId(defaultRoleId);
  }, [defaultRoleId, roleId]);

  useEffect(() => {
    if (!locationId && locations[0]?.id) setLocationId(locations[0].id);
  }, [locationId, locations]);

  const resetInviteForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setRoleId(defaultRoleId);
    setLocationId(locations[0]?.id || '');
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
      enqueueSnackbar(
        t('delegation.team.inviteSent', 'Invite sent'),
        { variant: 'success' }
      );
      setInviteOpen(false);
      resetInviteForm();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.error ||
          err?.message ||
          t('delegation.team.inviteFailed', 'Could not send invite'),
        { variant: 'error' }
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || locationsLoading) {
    return (
      <LoadingPage
        message={t('delegation.team.loading', 'Loading team')}
        subtitle={t('common.pleaseWait', 'Please wait')}
        showProgress
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {t('delegation.team.title', 'Team')}
          </Typography>
          <Typography color="text.secondary">
            {t(
              'delegation.team.subtitle',
              'Invite people to manage orders at a location.'
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => void refresh()}
            variant="outlined"
          >
            {t('common.refresh', 'Refresh')}
          </Button>
          <Button variant="contained" onClick={() => setInviteOpen(true)}>
            {t('delegation.team.invite', 'Invite')}
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, overflow: 'auto' }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="h6" fontWeight={700}>
            {t('delegation.team.members', 'Members')}
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.name', 'Name')}</TableCell>
              <TableCell>{t('common.email', 'Email')}</TableCell>
              <TableCell>{t('common.location', 'Location')}</TableCell>
              <TableCell>{t('delegation.team.role', 'Role')}</TableCell>
              <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    {t('delegation.team.noMembers', 'No active members yet')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {[m.user?.first_name, m.user?.last_name]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </TableCell>
                <TableCell>{m.user?.email}</TableCell>
                <TableCell>{m.location?.name}</TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <Select
                      value={m.role?.id || ''}
                      onChange={(e) => {
                        void changeMemberRole(m.id, String(e.target.value)).then(
                          () =>
                            enqueueSnackbar(
                              t('delegation.team.roleUpdated', 'Role updated'),
                              { variant: 'success' }
                            )
                        );
                      }}
                    >
                      {roles.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="right">
                  <Button color="error" onClick={() => setRevokeId(m.id)}>
                    {t('delegation.team.revoke', 'Revoke')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ overflow: 'auto' }}>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="h6" fontWeight={700}>
            {t('delegation.team.pendingInvites', 'Pending invites')}
          </Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('common.email', 'Email')}</TableCell>
              <TableCell>{t('common.location', 'Location')}</TableCell>
              <TableCell>{t('delegation.team.role', 'Role')}</TableCell>
              <TableCell align="right">{t('common.actions', 'Actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invites.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    {t('delegation.team.noInvites', 'No pending invites')}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {invites.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.email}</TableCell>
                <TableCell>{inv.location?.name}</TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <Select
                      value={inv.role?.id || ''}
                      onChange={(e) => {
                        void changeInviteRole(inv.id, String(e.target.value));
                      }}
                    >
                      {roles.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell align="right">
                  <Button
                    onClick={() => {
                      void resendInvite(inv.id)
                        .then(() =>
                          enqueueSnackbar(
                            t('delegation.team.resent', 'Invite resent'),
                            { variant: 'success' }
                          )
                        )
                        .catch((err: any) =>
                          enqueueSnackbar(
                            err?.response?.data?.error ||
                              t('delegation.team.resendFailed', 'Resend failed'),
                            { variant: 'error' }
                          )
                        );
                    }}
                  >
                    {t('delegation.team.resend', 'Resend')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog
        open={inviteOpen}
        onClose={() => !submitting && setInviteOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ pr: 6 }}>
          {t('delegation.team.inviteTitle', 'Invite teammate')}
          <IconButton
            onClick={() => setInviteOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
            disabled={submitting}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label={t('common.email', 'Email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('common.firstName', 'First name')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                fullWidth
              />
              <TextField
                label={t('common.lastName', 'Last name')}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                fullWidth
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>
                {t('common.location', 'Location')}
              </InputLabel>
              <Select
                label={t('common.location', 'Location')}
                value={locationId}
                onChange={(e) => setLocationId(String(e.target.value))}
              >
                {locations.map((loc) => (
                  <MenuItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t('delegation.team.role', 'Role')}</InputLabel>
              <Select
                label={t('delegation.team.role', 'Role')}
                value={roleId}
                onChange={(e) => setRoleId(String(e.target.value))}
              >
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setInviteOpen(false)} disabled={submitting}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={() => void handleInvite()}
                disabled={submitting || !email.trim() || !locationId || !roleId}
                startIcon={
                  submitting ? <CircularProgress size={16} /> : undefined
                }
              >
                {t('delegation.team.sendInvite', 'Send invite')}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={Boolean(revokeId)}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => {
          if (!revokeId) return;
          void revokeMember(revokeId)
            .then(() => {
              enqueueSnackbar(
                t('delegation.team.revoked', 'Access revoked'),
                { variant: 'success' }
              );
              setRevokeId(null);
            })
            .catch((err: any) =>
              enqueueSnackbar(
                err?.response?.data?.error ||
                  t('delegation.team.revokeFailed', 'Could not revoke'),
                { variant: 'error' }
              )
            );
        }}
        title={t('delegation.team.revokeTitle', 'Revoke access?')}
        message={t(
          'delegation.team.revokeMessage',
          'This person will lose access to this location immediately.'
        )}
        confirmText={t('delegation.team.revoke', 'Revoke')}
        confirmColor="error"
      />    </Container>
  );
};

export default BusinessTeamPage;
