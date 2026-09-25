import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../hooks/useApiClient';
import { AssignScheduleDialog } from './AssignDialog';
import { ImpactCard } from './fields';
import { impactObjectiveLines, moneyText, scheduleImpact } from './impact';
import {
  ObjectiveFields,
  objectivesFromRow,
  objectivesPayload,
  type ObjectiveValues,
} from './ObjectiveFields';
import { fromLocalInput, personName, ProgramTable, programRowSx, StatusChip, toLocalInput, useConfirm } from './shared';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'];

interface Assignment {
  id: string;
  amount: number;
  currency: string;
  ends_at?: string | null;
  status: string;
  decision?: string;
  reject_reason?: string | null;
  reject_note?: string | null;
  target_agent_recruitments?: number | null;
  target_client_signups?: number | null;
  target_merchant_recruitments?: number | null;
  target_item_sales_amount?: number | null;
  target_rental_amount?: number | null;
  agent?: { user?: { first_name?: string; last_name?: string; email?: string } };
}

interface Schedule {
  id: string;
  name: string;
  frequency: string;
  currency: string;
  default_amount: number;
  default_duration_days?: number | null;
  is_active: boolean;
  target_agent_recruitments?: number | null;
  target_client_signups?: number | null;
  target_merchant_recruitments?: number | null;
  target_item_sales_amount?: number | null;
  target_rental_amount?: number | null;
  assignments?: Assignment[];
}

export function ScheduleTables({
  schedules,
  onChanged,
  part = 'templates',
}: {
  schedules: Schedule[];
  onChanged: (message: string) => Promise<void>;
  part?: 'templates' | 'assignments';
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const confirm = useConfirm();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);

  function deactivate(row: Schedule) {
    confirm.ask({
      title: t('admin.paymentPrograms.deactivateScheduleTitle', 'Deactivate this schedule?'),
      message: t(
        'admin.paymentPrograms.deactivateScheduleMessage',
        'Active and paused assignments will end. Posted stipends stay. Reactivating the schedule does not resume them.'
      ),
      run: () =>
        api
          .post(`/admin/payment-programs/schedules/${row.id}/active`, { isActive: false })
          .then(() => onChanged(t('admin.paymentPrograms.inactive', 'Inactive'))),
    });
  }

  return (
    <Stack spacing={2}>
      {confirm.dialog}
      {part === 'templates' && (
        <ScheduleList schedules={schedules} onEdit={setSchedule} onDeactivate={deactivate} onChanged={onChanged} />
      )}
      {part === 'assignments' && (
        <AssignmentList schedules={schedules} onEdit={setAssignment} onChanged={onChanged} ask={confirm.ask} />
      )}
      {schedule && (
        <ScheduleDialog
          row={schedule}
          onClose={() => setSchedule(null)}
          onSave={(body) =>
            api.patch(`/admin/payment-programs/schedules/${schedule.id}`, body).then(() => {
              setSchedule(null);
              return onChanged(t('admin.paymentPrograms.save', 'Save'));
            })
          }
        />
      )}
      {assignment && (
        <AssignmentDialog
          row={assignment}
          onClose={() => setAssignment(null)}
          onSave={(body) =>
            api.patch(`/admin/payment-programs/assignments/${assignment.id}/terms`, body).then(() => {
              setAssignment(null);
              return onChanged(t('admin.paymentPrograms.save', 'Save'));
            })
          }
        />
      )}
    </Stack>
  );
}

function ScheduleList({
  schedules,
  onEdit,
  onDeactivate,
  onChanged,
}: {
  schedules: Schedule[];
  onEdit: (row: Schedule) => void;
  onDeactivate: (row: Schedule) => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  if (!schedules.length) return <Typography>{t('admin.paymentPrograms.empty', 'Nothing here yet.')}</Typography>;
  return (
    <ProgramTable
      title={t('admin.paymentPrograms.existingSchedules', 'Existing schedules')}
      columns={[
        { label: t('admin.paymentPrograms.name', 'Name') },
        { label: t('admin.paymentPrograms.frequency', 'Frequency') },
        { label: t('admin.paymentPrograms.amount', 'Amount') },
        { label: t('admin.paymentPrograms.assignedUsers', 'Assigned'), width: '10%' },
        { label: t('admin.paymentPrograms.status', 'Status'), width: '12%' },
        { label: t('admin.paymentPrograms.actions', 'Actions'), align: 'right', width: '8%' },
      ]}
    >
      {schedules.map((row) => (
        <ScheduleRow key={row.id} row={row} onEdit={onEdit} onDeactivate={onDeactivate} onChanged={onChanged} />
      ))}
    </ProgramTable>
  );
}

function ScheduleRow({
  row,
  onEdit,
  onDeactivate,
  onChanged,
}: {
  row: Schedule;
  onEdit: (row: Schedule) => void;
  onDeactivate: (row: Schedule) => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const money = moneyText(row.default_amount, row.currency, i18n.language);
  return (
    <TableRow hover sx={programRowSx}>
      <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
      <TableCell>{t(`admin.paymentPrograms.${row.frequency}`, row.frequency)}</TableCell>
      <TableCell>{money}</TableCell>
      <TableCell>{openAssignmentCount(row)}</TableCell>
      <TableCell><StatusChip status={row.is_active ? 'active' : 'inactive'} /></TableCell>
      <TableCell align="right">
        <ScheduleActions row={row} onEdit={onEdit} onDeactivate={onDeactivate} onChanged={onChanged} api={api} />
      </TableCell>
    </TableRow>
  );
}

function openAssignmentCount(row: Schedule): number {
  return (row.assignments || []).filter((item) =>
    ['active', 'paused', 'pending_acceptance'].includes(item.status)
  ).length;
}

function ScheduleActions({
  row,
  onEdit,
  onDeactivate,
  onChanged,
  api,
}: {
  row: Schedule;
  onEdit: (row: Schedule) => void;
  onDeactivate: (row: Schedule) => void;
  onChanged: (message: string) => Promise<void>;
  api: { post: (url: string, body: unknown) => Promise<unknown> };
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <>
      <IconButton
        size="small"
        aria-label={t('admin.paymentPrograms.actions', 'Actions')}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <ScheduleActionsMenu
        row={row}
        anchor={anchor}
        onClose={() => setAnchor(null)}
        onDetails={() => setDetailsOpen(true)}
        onAssign={() => setAssigning(true)}
        onEdit={() => onEdit(row)}
        onDeactivate={onDeactivate}
        onChanged={onChanged}
        api={api}
      />
      {detailsOpen && <ScheduleDetailsDialog row={row} onClose={() => setDetailsOpen(false)} />}
      {assigning && (
        <AssignScheduleDialog schedule={row} onClose={() => setAssigning(false)} onDone={onChanged} />
      )}
    </>
  );
}

function ScheduleActionsMenu({
  row,
  anchor,
  onClose,
  onDetails,
  onAssign,
  onEdit,
  onDeactivate,
  onChanged,
  api,
}: {
  row: Schedule;
  anchor: HTMLElement | null;
  onClose: () => void;
  onDetails: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDeactivate: (row: Schedule) => void;
  onChanged: (message: string) => Promise<void>;
  api: { post: (url: string, body: unknown) => Promise<unknown> };
}) {
  const { t } = useTranslation();
  function pick(action: () => void) {
    onClose();
    action();
  }
  return (
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuItem onClick={() => pick(onDetails)}>
        <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{t('admin.paymentPrograms.details', 'Details')}</ListItemText>
      </MenuItem>
      {row.is_active ? (
        <MenuItem onClick={() => pick(onAssign)}>
          <ListItemIcon><PersonAddAlt1OutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('admin.paymentPrograms.assign', 'Assign')}</ListItemText>
        </MenuItem>
      ) : null}
      <MenuItem onClick={() => pick(onEdit)}>
        <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{t('admin.paymentPrograms.edit', 'Edit')}</ListItemText>
      </MenuItem>
      <ScheduleActiveMenuItem
        row={row}
        onDeactivate={onDeactivate}
        onChanged={onChanged}
        api={api}
        onDone={onClose}
      />
    </Menu>
  );
}

function ScheduleActiveMenuItem({
  row,
  onDeactivate,
  onChanged,
  api,
  onDone,
}: {
  row: Schedule;
  onDeactivate: (row: Schedule) => void;
  onChanged: (message: string) => Promise<void>;
  api: { post: (url: string, body: unknown) => Promise<unknown> };
  onDone: () => void;
}) {
  const { t } = useTranslation();
  if (row.is_active) {
    return (
      <MenuItem
        onClick={() => {
          onDone();
          onDeactivate(row);
        }}
      >
        <ListItemIcon><PauseCircleOutlineIcon fontSize="small" color="warning" /></ListItemIcon>
        <ListItemText>{t('admin.paymentPrograms.deactivate', 'Deactivate')}</ListItemText>
      </MenuItem>
    );
  }
  return (
    <MenuItem
      onClick={() => {
        onDone();
        void api
          .post(`/admin/payment-programs/schedules/${row.id}/active`, { isActive: true })
          .then(() => onChanged(t('admin.paymentPrograms.active', 'Active')));
      }}
    >
      <ListItemIcon><PlayCircleOutlineIcon fontSize="small" /></ListItemIcon>
      <ListItemText>{t('admin.paymentPrograms.reactivate', 'Reactivate')}</ListItemText>
    </MenuItem>
  );
}

function ScheduleDetailsDialog({ row, onClose }: { row: Schedule; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const objectives = objectivesFromRow(row);
  const text = scheduleImpact(t, {
    amount: String(row.default_amount),
    currency: row.currency,
    frequency: row.frequency,
    days: row.default_duration_days ? String(row.default_duration_days) : '',
    locale: i18n.language,
  });
  const lines = impactObjectiveLines(t, objectives, row.currency, i18n.language);
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{row.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <ImpactCard text={text} objectives={lines} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignmentList({
  schedules,
  onEdit,
  onChanged,
  ask,
}: {
  schedules: Schedule[];
  onEdit: (row: Assignment) => void;
  onChanged: (message: string) => Promise<void>;
  ask: ReturnType<typeof useConfirm>['ask'];
}) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const rows = schedules.flatMap((schedule) =>
    (schedule.assignments || []).map((row) => ({ ...row, schedule, scheduleActive: schedule.is_active }))
  );
  if (!rows.length) return null;

  function setStatus(id: string, status: string) {
    return api
      .patch(`/admin/payment-programs/assignments/${id}`, { status })
      .then(() => onChanged(t(`admin.paymentPrograms.${status}`, status)));
  }

  return (
    <ProgramTable
      title={t('admin.paymentPrograms.existingAssignments', 'Schedule assignments')}
      columns={[
        { label: t('admin.paymentPrograms.agent', 'Agent') },
        { label: t('admin.paymentPrograms.schedule', 'Schedule') },
        { label: t('admin.paymentPrograms.amount', 'Amount') },
        { label: t('admin.paymentPrograms.status', 'Status') },
        { label: t('admin.paymentPrograms.decision', 'Decision') },
        { label: t('admin.paymentPrograms.actions', 'Actions'), align: 'right' },
      ]}
    >
      {rows.map((row) => (
        <TableRow key={row.id} hover sx={programRowSx}>
          <TableCell sx={{ fontWeight: 600 }}>{personName(row.agent?.user) || row.id}</TableCell>
          <TableCell>{row.schedule.name}</TableCell>
          <TableCell>{moneyText(row.amount, row.currency, i18n.language)}</TableCell>
          <TableCell><StatusChip status={row.status} /></TableCell>
          <TableCell>
            <DecisionCell decision={row.decision} reason={row.reject_reason} note={row.reject_note} />
          </TableCell>
          <TableCell align="right">
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              {['active', 'paused', 'pending_acceptance'].includes(row.status) && (
                <Button size="small" onClick={() => onEdit(row)}>{t('admin.paymentPrograms.edit', 'Edit')}</Button>
              )}
              {row.status === 'active' && (
                <Button size="small" onClick={() => void setStatus(row.id, 'paused')}>
                  {t('admin.paymentPrograms.pause', 'Pause')}
                </Button>
              )}
              {row.status === 'paused' && row.scheduleActive && (
                <Button size="small" onClick={() => void setStatus(row.id, 'active')}>
                  {t('admin.paymentPrograms.resume', 'Resume')}
                </Button>
              )}
              {['active', 'paused'].includes(row.status) && (
                <Button
                  size="small"
                  color="warning"
                  onClick={() =>
                    ask({
                      title: t('admin.paymentPrograms.endAssignmentTitle', 'End this assignment?'),
                      message: t(
                        'admin.paymentPrograms.endAssignmentMessage',
                        'The agent will not receive future periods. Stipends already posted stay in the wallet.'
                      ),
                      run: () => setStatus(row.id, 'ended'),
                    })
                  }
                >
                  {t('admin.paymentPrograms.end', 'End')}
                </Button>
              )}
            </Stack>
          </TableCell>
        </TableRow>
      ))}
    </ProgramTable>
  );
}

function DecisionCell({
  decision,
  reason,
  note,
}: {
  decision?: string;
  reason?: string | null;
  note?: string | null;
}) {
  const { t } = useTranslation();
  const label = decision
    ? t(`admin.paymentPrograms.decision.${decision}`, decision)
    : '—';
  const detail = [reason, note].filter(Boolean).join(' · ');
  return (
    <Stack spacing={0.25}>
      <StatusChip status={decision || 'pending'} />
      {detail ? (
        <Typography variant="caption" color="text.secondary">
          {detail}
        </Typography>
      ) : null}
      <Typography variant="caption" sx={{ display: 'none' }}>
        {label}
      </Typography>
    </Stack>
  );
}

function ScheduleDialog({
  row,
  onClose,
  onSave,
}: {
  row: Schedule;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [name, setName] = useState(row.name);
  const [frequency, setFrequency] = useState(row.frequency);
  const [amount, setAmount] = useState(String(row.default_amount));
  const [days, setDays] = useState(row.default_duration_days ? String(row.default_duration_days) : '');
  const [objectives, setObjectives] = useState<ObjectiveValues>(objectivesFromRow(row));
  const impact = scheduleImpact(t, {
    amount,
    currency: row.currency,
    frequency,
    days,
    locale: i18n.language,
  });
  const objectiveLines = impactObjectiveLines(t, objectives, row.currency, i18n.language);
  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.editSchedule', 'Edit schedule')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t('admin.paymentPrograms.name', 'Name')} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField select label={t('admin.paymentPrograms.frequency', 'Frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {FREQUENCIES.map((value) => (
              <MenuItem key={value} value={value}>{t(`admin.paymentPrograms.${value}`, value)}</MenuItem>
            ))}
          </TextField>
          <TextField label={t('admin.paymentPrograms.amount', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label={t('admin.paymentPrograms.durationDays', 'Duration (days)')} value={days} onChange={(e) => setDays(e.target.value)} />
          <Typography variant="body2" color="text.secondary">{row.currency}</Typography>
          <ObjectiveFields values={objectives} onChange={setObjectives} currency={row.currency} />
          <ImpactCard text={impact} objectives={objectiveLines} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button
          variant="contained"
          onClick={() =>
            void onSave({
              name,
              frequency,
              defaultAmount: Number(amount),
              defaultDurationDays: days ? Number(days) : undefined,
              ...objectivesPayload(objectives),
            })
          }
        >
          {t('admin.paymentPrograms.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AssignmentDialog({
  row,
  onClose,
  onSave,
}: {
  row: Assignment;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(row.amount));
  const [endsAt, setEndsAt] = useState(toLocalInput(row.ends_at));
  const [objectives, setObjectives] = useState<ObjectiveValues>(objectivesFromRow(row));
  const canEditObjectives = row.status === 'pending_acceptance';
  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.editAssignment', 'Edit assignment')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t('admin.paymentPrograms.amount', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField
            type="datetime-local"
            label={t('admin.paymentPrograms.expiry', 'Expiry')}
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          {canEditObjectives && (
            <ObjectiveFields values={objectives} onChange={setObjectives} currency={row.currency} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button
          variant="contained"
          onClick={() =>
            void onSave({
              amount: Number(amount),
              endsAt: fromLocalInput(endsAt),
              ...(canEditObjectives ? objectivesPayload(objectives) : {}),
            })
          }
        >
          {t('admin.paymentPrograms.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
