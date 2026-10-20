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
} from '@mui/material';
import {
  Add as AddIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import AdminDedicatedAssignDialog from './AdminDedicatedAssignDialog';
import type { AdminAssignmentView, AssignmentStatus } from '../../../types/dedicatedAgents';

export function AdminDedicatedAssignmentsSection() {
  const { t } = useTranslation();
  const {
    getAdminAssignments,
    updateAdminAssignment,
    deleteAdminAssignment,
  } = useDedicatedAgents();

  const [assignments, setAssignments] = useState<AdminAssignmentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [slotFilter, setSlotFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

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
    try {
      const newStatus: AssignmentStatus = status === 'active' ? 'paused' : 'active';
      await updateAdminAssignment(assignmentId, { status: newStatus });
      await loadAssignments();
    } catch (err: any) {
      console.error('Error pause/resume:', err);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await deleteAdminAssignment(assignmentId);
      await loadAssignments();
      setConfirmRemove(null);
    } catch (err: any) {
      console.error('Error removing:', err);
    }
  };

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAssignDialogOpen(true)}
              aria-label={t('dedicatedAgents.superuser.assign', 'Assign')}
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
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAssignDialogOpen(true)}
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
                        >
                          {assignment.status === 'paused' ? <ResumeIcon /> : <PauseIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('dedicatedAgents.actions.remove', 'Remove')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setConfirmRemove(assignment.assignmentId)}
                          aria-label={t('dedicatedAgents.actions.remove', 'Remove')}
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
          <Button onClick={() => setConfirmRemove(null)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmRemove && handleRemove(confirmRemove)}
          >
            {t('dedicatedAgents.superuser.remove', 'Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
