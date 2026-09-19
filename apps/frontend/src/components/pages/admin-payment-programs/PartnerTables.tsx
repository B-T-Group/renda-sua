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
import { StatusChip, useConfirm } from './shared';

export interface PartnerRow {
  id: string;
  business_id: string;
  is_active: boolean;
  notes?: string | null;
  business?: { name?: string };
}

export function PartnerTables({
  partners,
  onChanged,
}: {
  partners: PartnerRow[];
  onChanged: (message: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const confirm = useConfirm();
  const [partner, setPartner] = useState<PartnerRow | null>(null);
  if (!partners.length) return <Typography>{t('admin.paymentPrograms.empty', 'Nothing here yet.')}</Typography>;

  function save(row: PartnerRow, isActive: boolean, notes?: string | null) {
    return api
      .post('/admin/payment-programs/partners', {
        businessId: row.business_id,
        isActive,
        notes: notes ?? row.notes ?? null,
      })
      .then(() => onChanged(t(isActive ? 'admin.paymentPrograms.active' : 'admin.paymentPrograms.inactive', isActive ? 'Active' : 'Inactive')));
  }

  return (
    <Stack spacing={2}>
      {confirm.dialog}
      <Typography variant="body2" color="text.secondary">
        {t(
          'admin.paymentPrograms.partnerStillApplies',
          'Deactivating a partner stops all-partner credits from matching that store. A credit granted for that specific store still applies.'
        )}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('admin.paymentPrograms.business', 'Business')}</TableCell>
            <TableCell>{t('admin.paymentPrograms.notes', 'Notes')}</TableCell>
            <TableCell>{t('admin.paymentPrograms.status', 'Status')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {partners.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.business?.name || row.business_id}</TableCell>
              <TableCell>{row.notes || '—'}</TableCell>
              <TableCell><StatusChip status={row.is_active ? 'active' : 'inactive'} /></TableCell>
              <TableCell>
                <Button size="small" onClick={() => setPartner(row)}>{t('admin.paymentPrograms.edit', 'Edit')}</Button>
                {row.is_active ? (
                  <Button
                    size="small"
                    color="warning"
                    onClick={() =>
                      confirm.ask({
                        title: t('admin.paymentPrograms.deactivatePartnerTitle', 'Deactivate this partner?'),
                        message: t(
                          'admin.paymentPrograms.deactivatePartnerMessage',
                          'New credits for all partner stores will skip this business. A credit already named for this store still applies.'
                        ),
                        run: () => save(row, false),
                      })
                    }
                  >
                    {t('admin.paymentPrograms.deactivate', 'Deactivate')}
                  </Button>
                ) : (
                  <Button size="small" onClick={() => void save(row, true)}>
                    {t('admin.paymentPrograms.reactivate', 'Reactivate')}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {partner && (
        <PartnerDialog
          row={partner}
          onClose={() => setPartner(null)}
          onSave={(notes) => save(partner, partner.is_active, notes).then(() => setPartner(null))}
        />
      )}
    </Stack>
  );
}

function PartnerDialog({
  row,
  onClose,
  onSave,
}: {
  row: PartnerRow;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(row.notes || '');
  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.editPartner', 'Edit partner')}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          sx={{ mt: 1 }}
          label={t('admin.paymentPrograms.notes', 'Notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={() => void onSave(notes)}>
          {t('admin.paymentPrograms.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
