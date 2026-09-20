import { Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../../common/ConfirmationModal';

export function personName(user?: {
  first_name?: string;
  last_name?: string;
  email?: string;
} | null): string {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return name || user?.email || '';
}

export function toLocalInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export const programHeadCell = {
  fontWeight: 600,
  color: 'text.secondary',
  bgcolor: 'action.hover',
  whiteSpace: 'nowrap',
};

export const programRowSx = { '&:last-child td': { borderBottom: 0 } };

export function ProgramTable({
  title,
  note,
  columns,
  children,
}: {
  title: string;
  note?: string;
  columns: Array<{ label: string; align?: 'left' | 'right' }>;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: note ? 0.5 : 1.5 }}>{title}</Typography>
      {note ? <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1.5 }}>{note}</Typography> : null}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.label} align={column.align || 'left'} sx={programHeadCell}>{column.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>{children}</TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export function StatusChip({ status }: { status: string }) {
  const { t } = useTranslation();
  const color =
    status === 'active' ? 'success' : status === 'paused' ? 'warning' : status === 'revoked' ? 'error' : 'default';
  return <Chip size="small" color={color} label={t(`admin.paymentPrograms.${status}`, status)} />;
}

export function useConfirm() {
  const [pending, setPending] = useState<null | { title: string; message: string; run: () => Promise<void> }>(null);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!pending) return;
    setLoading(true);
    try {
      await pending.run();
      setPending(null);
    } finally {
      setLoading(false);
    }
  }

  const dialog = (
    <ConfirmationModal
      open={!!pending}
      title={pending?.title || ''}
      message={pending?.message || ''}
      confirmColor="error"
      loading={loading}
      onCancel={() => setPending(null)}
      onConfirm={() => void confirm()}
    />
  );

  return { ask: setPending, dialog };
}
