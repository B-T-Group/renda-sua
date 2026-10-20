import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  WifiOff as WifiOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import {
  useTrackSiteEvent,
  SITE_EVENT_DEDICATED_UI_SECTION_VIEWED,
  SITE_EVENT_DEDICATED_UI_AGENT_PAUSED,
  SITE_EVENT_DEDICATED_UI_AGENT_RESUMED,
  SITE_EVENT_DEDICATED_UI_AGENT_REMOVED,
  SITE_EVENT_DEDICATED_UI_ACTION_CONFLICT,
} from '../../../hooks/useTrackSiteEvent';
import AdminDedicatedAssignDialog from './AdminDedicatedAssignDialog';
import type { AdminAssignmentView, AssignmentStatus } from '../../../types/dedicatedAgents';

export function AdminDedicatedAssignmentsSection() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const {
    getAdminAssignments,
    updateAdminAssignment,
    deleteAdminAssignment,
  } = useDedicatedAgents();
  const { trackSiteEvent } = useTrackSiteEvent();
  const isOnline = useOnlineStatus();

  const [assignments, setAssignments] = useState<AdminAssignmentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Track section viewed
  useEffect(() => {
    void trackSiteEvent({
      eventType: SITE_EVENT_DEDICATED_UI_SECTION_VIEWED,
      metadata: { surface: 'admin', platform: 'web' },
    });
  }, [trackSiteEvent]);

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: any = {};
      if (cityFilter) filters.city = cityFilter;
      if (locationFilter) filters.locationId = locationFilter;
      if (slotFilter !== 'all') filters.slotKey = slotFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (sourceFilter !== 'all') filters.source = sourceFilter;
      const result = await getAdminAssignments(filters);
      setAssignments(result.assignments);
    } catch (err: any) {
      console.error('Error loading assignments:', err);
      setError(err.response?.data?.message || t('dedicatedAgents.generic', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  }, [getAdminAssignments, cityFilter, locationFilter, slotFilter, statusFilter, sourceFilter, t]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handlePauseResume = async (assignmentId: string, status: AssignmentStatus) => {
    if (busyIds.has(assignmentId)) return;
    
    setBusyIds((prev) => new Set(prev).add(assignmentId));
    try {
      const newStatus: AssignmentStatus = status === 'active' ? 'paused' : 'active';
      await updateAdminAssignment(assignmentId, { status: newStatus });
      await loadAssignments();
      
      // Track action
      void trackSiteEvent({
        eventType: newStatus === 'paused' ? SITE_EVENT_DEDICATED_UI_AGENT_PAUSED : SITE_EVENT_DEDICATED_UI_AGENT_RESUMED,
        metadata: { platform: 'web', surface: 'admin', role: 'superuser' },
      });
    } catch (err: any) {
      console.error('Error pause/resume:', err);
      const code = err.response?.data?.code;
      if (err.response?.status === 409) {
        const message = code && t(`dedicatedAgents.errors.${code}`, { defaultValue: t('dedicatedAgents.generic', 'Something went wrong') })
          ? t(`dedicatedAgents.errors.${code}`, t('dedicatedAgents.generic', 'Something went wrong'))
          : t('dedicatedAgents.generic', 'Something went wrong');
        enqueueSnackbar(message, { variant: 'error' });
        await loadAssignments();
        void trackSiteEvent({
          eventType: SITE_EVENT_DEDICATED_UI_ACTION_CONFLICT,
          metadata: { endpoint: 'updateAdminAssignment', code, platform: 'web', role: 'superuser' },
        });
      } else {
        enqueueSnackbar(t('dedicatedAgents.generic', 'Something went wrong'), { variant: 'error' });
      }
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (busyIds.has(assignmentId)) return;
    
    setBusyIds((prev) => new Set(prev).add(assignmentId));
    try {
      await deleteAdminAssignment(assignmentId);
      await loadAssignments();
      setConfirmRemove(null);
      
      // Track action
      void trackSiteEvent({
        eventType: SITE_EVENT_DEDICATED_UI_AGENT_REMOVED,
        metadata: { platform: 'web', surface: 'admin', role: 'superuser' },
      });
    } catch (err: any) {
      console.error('Error removing:', err);
      const code = err.response?.data?.code;
      if (err.response?.status === 409) {
        const message = code && t(`dedicatedAgents.errors.${code}`, { defaultValue: t('dedicatedAgents.generic', 'Something went wrong') })
          ? t(`dedicatedAgents.errors.${code}`, t('dedicatedAgents.generic', 'Something went wrong'))
          : t('dedicatedAgents.generic', 'Something went wrong');
        enqueueSnackbar(message, { variant: 'error' });
        await loadAssignments();
        setConfirmRemove(null);
        void trackSiteEvent({
          eventType: SITE_EVENT_DEDICATED_UI_ACTION_CONFLICT,
          metadata: { endpoint: 'deleteAdminAssignment', code, platform: 'web', role: 'superuser' },
        });
      } else {
        enqueueSnackbar(t('dedicatedAgents.generic', 'Something went wrong'), { variant: 'error' });
        setConfirmRemove(null);
      }
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
    }
  };

  return (
    <Box>
      {!isOnline && (
        <Alert severity="warning" icon={<WifiOffIcon />} sx={{ mb: 2 }}>
          {t('dedicatedAgents.offline', 'Offline · showing last update')}
        </Alert>
      )}
      
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={!isOnline ? <WifiOffIcon /> : <AddIcon />}
              onClick={() => setAssignDialogOpen(true)}
              aria-label={t('dedicatedAgents.superuser.assign', 'Assign')}
              disabled={!isOnline}
            >
              {t('dedicatedAgents.superuser.assign', 'Assign')}
            </Button>

            <TextField
              size="small"
              label={t('common.city', 'City')}
              value={cityFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCityFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            />

            <TextField
              size="small"
              label={t('dedicatedAgents.superuser.location', 'Location')}
              value={locationFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocationFilter(e.target.value)}
              sx={{ minWidth: 150 }}
            />

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('dedicatedAgents.superuser.slots', 'Slots')}</InputLabel>
              <Select
                value={slotFilter}
                label={t('dedicatedAgents.superuser.slots', 'Slots')}
                onChange={(e) => setSlotFilter(e.target.value)}
              >
                <MenuItem value="all">{t('common.all', 'All')}</MenuItem>
                <MenuItem value="morning">{t('dedicatedAgents.slots.morning', 'Morning')}</MenuItem>
                <MenuItem value="afternoon">{t('dedicatedAgents.slots.afternoon', 'Afternoon')}</MenuItem>
                <MenuItem value="evening">{t('dedicatedAgents.slots.evening', 'Evening')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('dedicatedAgents.superuser.status', 'Status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('dedicatedAgents.superuser.status', 'Status')}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">{t('common.all', 'All')}</MenuItem>
                <MenuItem value="active">{t('dedicatedAgents.superuser.active', 'Active')}</MenuItem>
                <MenuItem value="paused">{t('dedicatedAgents.superuser.paused', 'Paused')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>{t('common.source', 'Source')}</InputLabel>
              <Select
                value={sourceFilter}
                label={t('common.source', 'Source')}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <MenuItem value="all">{t('common.all', 'All')}</MenuItem>
                <MenuItem value="posting_accept">{t('dedicatedAgents.superuser.posting', 'Posting')}</MenuItem>
                <MenuItem value="superuser_assign">{t('dedicatedAgents.superuser.adminAssigned', 'Admin assigned')}</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAssignments}
              disabled={loading}
              aria-label={t('common.refresh', 'Refresh')}
            >
              {t('common.refresh', 'Refresh')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="error">
                {error}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadAssignments}
              >
                {t('dedicatedAgents.retry', 'Retry')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                {t('dedicatedAgents.superuser.noAssignments', 'No assignments found.')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setAssignDialogOpen(true)}
                disabled={!isOnline}
              >
                {t('dedicatedAgents.superuser.assign', 'Assign')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('dedicatedAgents.superuser.agent', 'Agent')}</TableCell>
                <TableCell>{t('dedicatedAgents.superuser.location', 'Location')}</TableCell>
                <TableCell>{t('dedicatedAgents.superuser.slots', 'Slots')}</TableCell>
                <TableCell>{t('dedicatedAgents.superuser.status', 'Status')}</TableCell>
                <TableCell>{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.assignmentId}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {assignment.agent.firstName} {assignment.agent.lastName}
                        </Typography>
                        <Chip
                          label={assignment.agent.isInternal ? t('dedicatedAgents.chips.type.internal', 'Internal') : t('dedicatedAgents.chips.type.independent', 'Independent')}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                      {assignment.possible_relation && !assignment.relation_dismissed && (
                        <Tooltip title={t('dedicatedAgents.superuser.relationWarning', 'Agent may be related to this business')}>
                          <WarningIcon color="warning" fontSize="small" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{assignment.location.businessName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {assignment.location.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`dedicatedAgents.slots.${assignment.slotKey}`, assignment.slotKey)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`dedicatedAgents.chips.status.${assignment.status}`, assignment.status === 'paused' ? 'Paused' : 'Active')}
                      color={assignment.status === 'paused' ? 'default' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title={assignment.status === 'paused' ? t('dedicatedAgents.actions.resume', 'Resume') : t('dedicatedAgents.actions.pause', 'Pause')}>
                        <IconButton
                          size="small"
                          onClick={() => handlePauseResume(assignment.assignmentId, assignment.status)}
                          aria-label={assignment.status === 'paused' ? t('dedicatedAgents.actions.resume', 'Resume') : t('dedicatedAgents.actions.pause', 'Pause')}
                          disabled={!isOnline || busyIds.has(assignment.assignmentId)}
                        >
                          {busyIds.has(assignment.assignmentId) ? (
                            <CircularProgress size={20} />
                          ) : assignment.status === 'paused' ? (
                            <ResumeIcon />
                          ) : (
                            <PauseIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('dedicatedAgents.actions.remove', 'Remove')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setConfirmRemove(assignment.assignmentId)}
                          aria-label={t('dedicatedAgents.actions.remove', 'Remove')}
                          disabled={!isOnline || busyIds.has(assignment.assignmentId)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AdminDedicatedAssignDialog
        open={assignDialogOpen}
        onClose={() => setAssignDialogOpen(false)}
        onSuccess={loadAssignments}
      />

      <Dialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('dedicatedAgents.superuser.removeConfirm', 'Remove assignment?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t(
              'dedicatedAgents.superuser.removeConfirmDesc',
              'The agent will no longer be dedicated to this location.'
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(null)} disabled={confirmRemove ? busyIds.has(confirmRemove) : false}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmRemove && handleRemove(confirmRemove)}
            disabled={confirmRemove ? busyIds.has(confirmRemove) : false}
            startIcon={confirmRemove && busyIds.has(confirmRemove) ? <CircularProgress size={16} /> : null}
          >
            {t('dedicatedAgents.superuser.remove', 'Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
