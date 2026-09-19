import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../hooks/useApiClient';
import { fromLocalInput, personName, StatusChip, toLocalInput, useConfirm } from './shared';

interface Facility {
  id: string;
  limit_amount: number;
  currency: string;
  status: string;
  ends_at?: string | null;
  user?: { first_name?: string; last_name?: string; email?: string };
  account?: { cash_advance_balance?: number };
}

interface Program {
  id: string;
  name: string;
  currency: string;
  default_limit: number;
  is_active: boolean;
  facilities?: Facility[];
}

export function AdvanceTables({
  programs,
  onChanged,
  part = 'programs',
}: {
  programs: Program[];
  onChanged: (message: string) => Promise<void>;
  part?: 'programs' | 'facilities';
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const confirm = useConfirm();
  const [program, setProgram] = useState<Program | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const rows = programs.flatMap((item) => (item.facilities || []).map((row) => ({ ...row, program: item })));

  return (
    <Stack spacing={2}>
      {confirm.dialog}
      {part === 'programs' && (
        <ProgramList programs={programs} onEdit={setProgram} onChanged={onChanged} ask={confirm.ask} />
      )}
      {part === 'facilities' && (
        <FacilityList rows={rows} onEdit={setFacility} onChanged={onChanged} ask={confirm.ask} />
      )}
      {program && (
        <ProgramDialog
          row={program}
          onClose={() => setProgram(null)}
          onSave={(body) =>
            api.patch(`/admin/payment-programs/cash-advances/${program.id}`, body).then(() => {
              setProgram(null);
              return onChanged(t('admin.paymentPrograms.save', 'Save'));
            })
          }
        />
      )}
      {facility && (
        <FacilityDialog
          row={facility}
          onClose={() => setFacility(null)}
          onSave={(body) =>
            api.patch(`/admin/payment-programs/cash-advances/facilities/${facility.id}`, body).then(() => {
              setFacility(null);
              return onChanged(t('admin.paymentPrograms.save', 'Save'));
            })
          }
        />
      )}
    </Stack>
  );
}

function ProgramList({
  programs,
  onEdit,
  onChanged,
  ask,
}: {
  programs: Program[];
  onEdit: (row: Program) => void;
  onChanged: (message: string) => Promise<void>;
  ask: ReturnType<typeof useConfirm>['ask'];
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  if (!programs.length) return <Typography>{t('admin.paymentPrograms.empty', 'Nothing here yet.')}</Typography>;

  function setActive(id: string, isActive: boolean) {
    return api
      .post(`/admin/payment-programs/cash-advances/${id}/active`, { isActive })
      .then(() => onChanged(t(isActive ? 'admin.paymentPrograms.active' : 'admin.paymentPrograms.inactive', isActive ? 'Active' : 'Inactive')));
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.paymentPrograms.name', 'Name')}</TableCell>
          <TableCell>{t('admin.paymentPrograms.limit', 'Limit')}</TableCell>
          <TableCell>{t('admin.paymentPrograms.status', 'Status')}</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {programs.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.default_limit} {row.currency}</TableCell>
            <TableCell><StatusChip status={row.is_active ? 'active' : 'inactive'} /></TableCell>
            <TableCell>
              <Button size="small" onClick={() => onEdit(row)}>{t('admin.paymentPrograms.edit', 'Edit')}</Button>
              {row.is_active ? (
                <Button
                  size="small"
                  color="warning"
                  onClick={() =>
                    ask({
                      title: t('admin.paymentPrograms.deactivateProgramTitle', 'Deactivate this program?'),
                      message: t(
                        'admin.paymentPrograms.deactivateProgramMessage',
                        'New facilities cannot be opened. Existing lines stay open until you close them.'
                      ),
                      run: () => setActive(row.id, false),
                    })
                  }
                >
                  {t('admin.paymentPrograms.deactivate', 'Deactivate')}
                </Button>
              ) : (
                <Button size="small" onClick={() => void setActive(row.id, true)}>
                  {t('admin.paymentPrograms.reactivate', 'Reactivate')}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function FacilityList({
  rows,
  onEdit,
  onChanged,
  ask,
}: {
  rows: Array<Facility & { program: Program }>;
  onEdit: (row: Facility) => void;
  onChanged: (message: string) => Promise<void>;
  ask: ReturnType<typeof useConfirm>['ask'];
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  if (!rows.length) return null;
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.paymentPrograms.agent', 'Agent')}</TableCell>
          <TableCell>{t('admin.paymentPrograms.program', 'Program')}</TableCell>
          <TableCell>{t('admin.paymentPrograms.limit', 'Limit')}</TableCell>
          <TableCell>{t('admin.paymentPrograms.drawn', 'Drawn')}</TableCell>
          <TableCell>{t('admin.paymentPrograms.status', 'Status')}</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{personName(row.user) || row.id}</TableCell>
            <TableCell>{row.program.name}</TableCell>
            <TableCell>{row.limit_amount} {row.currency}</TableCell>
            <TableCell>{Math.abs(Number(row.account?.cash_advance_balance || 0))}</TableCell>
            <TableCell><StatusChip status={row.status} /></TableCell>
            <TableCell>
              {row.status === 'active' && (
                <>
                  <Button size="small" onClick={() => onEdit(row)}>{t('admin.paymentPrograms.edit', 'Edit')}</Button>
                  <Button
                    size="small"
                    color="warning"
                    onClick={() =>
                      ask({
                        title: t('admin.paymentPrograms.closeFacilityTitle', 'Close this cash-advance line?'),
                        message: t(
                          'admin.paymentPrograms.closeFacilityMessage',
                          'The agent cannot draw more. Any debt stays and is still repaid by deposits.'
                        ),
                        run: () =>
                          api
                            .post(`/admin/payment-programs/cash-advances/facilities/${row.id}/close`)
                            .then(() => onChanged(t('admin.paymentPrograms.closed', 'Closed'))),
                      })
                    }
                  >
                    {t('admin.paymentPrograms.close', 'Close')}
                  </Button>
                </>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProgramDialog({
  row,
  onClose,
  onSave,
}: {
  row: Program;
  onClose: () => void;
  onSave: (body: { name: string; defaultLimit: number }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(row.name);
  const [limit, setLimit] = useState(String(row.default_limit));
  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.editProgram', 'Edit program')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t('admin.paymentPrograms.name', 'Name')} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label={t('admin.paymentPrograms.limit', 'Limit')} value={limit} onChange={(e) => setLimit(e.target.value)} />
          <Typography variant="body2" color="text.secondary">{row.currency}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={() => void onSave({ name, defaultLimit: Number(limit) })}>
          {t('admin.paymentPrograms.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function FacilityDialog({
  row,
  onClose,
  onSave,
}: {
  row: Facility;
  onClose: () => void;
  onSave: (body: { limitAmount: number; endsAt: string | null }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(String(row.limit_amount));
  const [endsAt, setEndsAt] = useState(toLocalInput(row.ends_at));
  const drawn = Math.abs(Number(row.account?.cash_advance_balance || 0));
  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.editFacility', 'Edit facility')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label={t('admin.paymentPrograms.limit', 'Limit')} value={limit} onChange={(e) => setLimit(e.target.value)} />
          <Typography variant="body2">{t('admin.paymentPrograms.drawn', 'Drawn')}: {drawn}</Typography>
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
        <Button
          variant="contained"
          disabled={Number(limit) < drawn}
          onClick={() => void onSave({ limitAmount: Number(limit), endsAt: fromLocalInput(endsAt) })}
        >
          {t('admin.paymentPrograms.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
