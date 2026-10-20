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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [relationFilter, setRelationFilter] = useState<string>('all');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (relationFilter !== 'all') filters.hasRelation = relationFilter === 'yes';
      const result = await getAdminAssignments(filters);
      setAssignments(result.assignments);
    } catch (err: any) {
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [getAdminAssignments, statusFilter, relationFilter]);

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
            >
              {t('dedicatedAgents.superuser.assign', 'Assign')}
            </Button>

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
              <InputLabel>{t('dedicatedAgents.superuser.relation', 'Relation')}</InputLabel>
              <Select
                value={relationFilter}
                label={t('dedicatedAgents.superuser.relation', 'Relation')}
                onChange={(e) => setRelationFilter(e.target.value)}
              >
                <MenuItem value="all">{t('common.all', 'All')}</MenuItem>
                <MenuItem value="yes">{t('dedicatedAgents.superuser.hasRelation', 'Has relation')}</MenuItem>
                <MenuItem value="no">{t('dedicatedAgents.superuser.noRelation', 'No relation')}</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadAssignments}
              disabled={loading}
            >
              {t('common.refresh', 'Refresh')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              {t('dedicatedAgents.superuser.noAssignments', 'No assignments found.')}
            </Typography>
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
                      label={assignment.status === 'paused' ? t('dedicatedAgents.superuser.paused', 'Paused') : t('dedicatedAgents.superuser.active', 'Active')}
                      color={assignment.status === 'paused' ? 'default' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title={assignment.status === 'paused' ? t('dedicatedAgents.superuser.resume', 'Resume') : t('dedicatedAgents.superuser.pause', 'Pause')}>
                        <IconButton
                          size="small"
                          onClick={() => handlePauseResume(assignment.assignmentId, assignment.status)}
                        >
                          {assignment.status === 'paused' ? <ResumeIcon /> : <PauseIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('dedicatedAgents.superuser.remove', 'Remove')}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setConfirmRemove(assignment.assignmentId)}
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
