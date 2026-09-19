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

export interface CreditGrant {
  id: string;
  amount: number;
  remaining_amount: number;
  currency: string;
  applicability: string;
  expires_at?: string | null;
  memo?: string | null;
  revoked_at?: string | null;
  user?: { first_name?: string; last_name?: string; email?: string };
  business?: { name?: string } | null;
}

export function CreditTables({
  grants,
  onChanged,
}: {
  grants: CreditGrant[];
  onChanged: (message: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const confirm = useConfirm();
  const [grant, setGrant] = useState<CreditGrant | null>(null);
  if (!grants.length) return <Typography>{t('admin.paymentPrograms.empty', 'Nothing here yet.')}</Typography>;

  return (
    <Stack spacing={2}>
      {confirm.dialog}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('admin.paymentPrograms.client', 'Client')}</TableCell>
            <TableCell>{t('admin.paymentPrograms.appliesTo', 'Applies to')}</TableCell>
            <TableCell>{t('admin.paymentPrograms.remaining', 'Remaining')}</TableCell>
            <TableCell>{t('admin.paymentPrograms.status', 'Status')}</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {grants.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{personName(row.user) || row.id}</TableCell>
              <TableCell>{scopeText(row, t)}</TableCell>
              <TableCell>{row.remaining_amount} / {row.amount} {row.currency}</TableCell>
              <TableCell><StatusChip status={row.revoked_at ? 'revoked' : 'active'} /></TableCell>
              <TableCell>
                {!row.revoked_at && (
                  <>
                    <Button size="small" onClick={() => setGrant(row)}>{t('admin.paymentPrograms.edit', 'Edit')}</Button>
                    <Button
                      size="small"
                      color="warning"
                      onClick={() =>
                        confirm.ask({
                          title: t('admin.paymentPrograms.revokeGrantTitle', 'Revoke this credit?'),
                          message: t(
                            'admin.paymentPrograms.revokeGrantMessage',
                            'The remaining balance becomes zero. Past redemptions stay, and a cancelled order will not restore this grant.'
                          ),
                          run: () =>
                            api
                              .post(`/admin/payment-programs/credits/${row.id}/revoke`)
                              .then(() => onChanged(t('admin.paymentPrograms.revoked', 'Revoked'))),
                        })
                      }
                    >
                      {t('admin.paymentPrograms.revoke', 'Revoke')}
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {grant && (
        <GrantDialog
          row={grant}
          onClose={() => setGrant(null)}
          onSave={(body) =>
            api.patch(`/admin/payment-programs/credits/${grant.id}`, body).then(() => {
              setGrant(null);
              return onChanged(t('admin.paymentPrograms.save', 'Save'));
            })
          }
        />
      )}
    </Stack>
  );
}

function scopeText(row: CreditGrant, t: (key: string, fallback: string) => string): string {
  if (row.applicability === 'specific_business') return row.business?.name || t('admin.paymentPrograms.onePartner', 'One partner business');
  if (row.applicability === 'partner_businesses') return t('admin.paymentPrograms.allPartners', 'All partner businesses');
  return t('admin.paymentPrograms.anyStore', 'Any store');
}

function GrantDialog({
  row,
  onClose,
  onSave,
}: {
  row: CreditGrant;
  onClose: () => void;
  onSave: (body: { expiresAt: string | null; memo: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [expiresAt, setExpiresAt] = useState(toLocalInput(row.expires_at));
  const [memo, setMemo] = useState(row.memo || '');
  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.editGrant', 'Edit credit')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            type="datetime-local"
            label={t('admin.paymentPrograms.expiry', 'Expiry')}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField label={t('admin.paymentPrograms.memo', 'Memo')} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={() => void onSave({ expiresAt: fromLocalInput(expiresAt), memo })}>
          {t('admin.paymentPrograms.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
