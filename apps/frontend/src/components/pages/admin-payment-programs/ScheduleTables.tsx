import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../hooks/useApiClient';
import { moneyText } from './impact';
import { fromLocalInput, personName, ProgramTable, programRowSx, StatusChip, toLocalInput, useConfirm } from './shared';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'];

interface Assignment {
  id: string;
  amount: number;
  currency: string;
  ends_at?: string | null;
  status: string;
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
        { label: t('admin.paymentPrograms.status', 'Status') },
        { label: t('admin.paymentPrograms.actions', 'Actions'), align: 'right' },
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
      <TableCell><StatusChip status={row.is_active ? 'active' : 'inactive'} /></TableCell>
      <TableCell align="right">
        <ScheduleActions row={row} onEdit={onEdit} onDeactivate={onDeactivate} onChanged={onChanged} api={api} />
      </TableCell>
    </TableRow>
  );
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
  return (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <Button size="small" onClick={() => onEdit(row)}>{t('admin.paymentPrograms.edit', 'Edit')}</Button>
      {row.is_active ? (
        <Button size="small" color="warning" onClick={() => onDeactivate(row)}>
          {t('admin.paymentPrograms.deactivate', 'Deactivate')}
        </Button>
      ) : (
        <Button
          size="small"
          onClick={() =>
            void api
              .post(`/admin/payment-programs/schedules/${row.id}/active`, { isActive: true })
              .then(() => onChanged(t('admin.paymentPrograms.active', 'Active')))
          }
        >
          {t('admin.paymentPrograms.reactivate', 'Reactivate')}
        </Button>
      )}
    </Stack>
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
        { label: t('admin.paymentPrograms.actions', 'Actions'), align: 'right' },
      ]}
    >
      {rows.map((row) => (
        <TableRow key={row.id} hover sx={programRowSx}>
          <TableCell sx={{ fontWeight: 600 }}>{personName(row.agent?.user) || row.id}</TableCell>
          <TableCell>{row.schedule.name}</TableCell>
          <TableCell>{moneyText(row.amount, row.currency, i18n.language)}</TableCell>
          <TableCell><StatusChip status={row.status} /></TableCell>
          <TableCell align="right">
            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
              {['active', 'paused'].includes(row.status) && (
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

function ScheduleDialog({
  row,
  onClose,
  onSave,
}: {
  row: Schedule;
  onClose: () => void;
  onSave: (body: { name: string; frequency: string; defaultAmount: number; defaultDurationDays?: number }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(row.name);
  const [frequency, setFrequency] = useState(row.frequency);
  const [amount, setAmount] = useState(String(row.default_amount));
  const [days, setDays] = useState(row.default_duration_days ? String(row.default_duration_days) : '');
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
  onSave: (body: { amount: number; endsAt: string | null }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(String(row.amount));
  const [endsAt, setEndsAt] = useState(toLocalInput(row.ends_at));
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={() => void onSave({ amount: Number(amount), endsAt: fromLocalInput(endsAt) })}>
          {t('admin.paymentPrograms.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
