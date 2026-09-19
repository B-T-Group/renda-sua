import { Chip } from '@mui/material';
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
