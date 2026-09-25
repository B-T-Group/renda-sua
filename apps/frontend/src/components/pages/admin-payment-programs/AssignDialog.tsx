import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../hooks/useApiClient';
import { DirectorySearch, ImpactCard, type DirectoryOption } from './fields';
import { advanceImpact, impactObjectiveLines, scheduleImpact } from './impact';
import { objectivesFromRow } from './ObjectiveFields';
import { fromLocalInput, toLocalInput } from './shared';

interface ScheduleTarget {
  id: string;
  name: string;
  frequency: string;
  currency: string;
  default_amount: number;
  default_duration_days?: number | null;
  target_agent_recruitments?: number | null;
  target_client_signups?: number | null;
  target_merchant_recruitments?: number | null;
  target_item_sales_amount?: number | null;
  target_rental_amount?: number | null;
}

interface AdvanceTarget {
  id: string;
  name: string;
  currency: string;
  default_limit: number;
}

export function AssignScheduleDialog({
  schedule,
  onClose,
  onDone,
}: {
  schedule: ScheduleTarget;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [agent, setAgent] = useState<DirectoryOption | null>(null);
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date().toISOString()));
  const ready = Boolean(agent && fromLocalInput(startsAt));
  const objectives = objectivesFromRow(schedule);
  const impactText = scheduleImpact(t, {
    amount: String(schedule.default_amount),
    currency: schedule.currency,
    frequency: schedule.frequency,
    days: schedule.default_duration_days ? String(schedule.default_duration_days) : '',
    name: agent?.name,
    locale: i18n.language,
  });
  const objectiveLines = impactObjectiveLines(
    t,
    objectives,
    schedule.currency,
    i18n.language
  );

  async function apply() {
    await api.post(`/admin/payment-programs/schedules/${schedule.id}/assignments`, {
      agentId: agent?.id,
      startsAt: fromLocalInput(startsAt),
    });
    onClose();
    await onDone(t('admin.paymentPrograms.assignmentCreated', 'Assignment created'));
  }

  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.assignAgentTitle', 'Assign an agent to {{name}}', { name: schedule.name })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <AgentField agent={agent} onChange={setAgent} />
          <TextField
            type="datetime-local"
            label={t('admin.paymentPrograms.startsAt', 'Starts at')}
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <ImpactCard text={impactText} objectives={objectiveLines} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={() => void apply()}>
          {t('admin.paymentPrograms.assign', 'Assign')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AssignAdvanceDialog({
  program,
  onClose,
  onDone,
}: {
  program: AdvanceTarget;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [agent, setAgent] = useState<DirectoryOption | null>(null);
  const ready = Boolean(agent?.userId);

  async function apply() {
    await api.post(`/admin/payment-programs/cash-advances/${program.id}/facilities`, {
      userId: agent?.userId,
      currency: program.currency,
      limitAmount: Number(program.default_limit),
    });
    onClose();
    await onDone(t('admin.paymentPrograms.assignmentCreated', 'Assignment created'));
  }

  return (
    <Dialog open onClose={onClose} fullWidth>
      <DialogTitle>{t('admin.paymentPrograms.assignAgentTitle', 'Assign an agent to {{name}}', { name: program.name })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <AgentField agent={agent} onChange={setAgent} />
          <ImpactCard text={advanceImpact(t, { amount: String(program.default_limit), currency: program.currency, name: agent?.name, locale: i18n.language })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('admin.paymentPrograms.cancel', 'Cancel')}</Button>
        <Button variant="contained" disabled={!ready} onClick={() => void apply()}>
          {t('admin.paymentPrograms.assign', 'Assign')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AgentField({
  agent,
  onChange,
}: {
  agent: DirectoryOption | null;
  onChange: (value: DirectoryOption | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <DirectorySearch
      label={t('admin.paymentPrograms.agent', 'Agent')}
      placeholder={t('admin.paymentPrograms.directorySearch', 'Name, email, or referral code')}
      endpoint="/admin/payment-programs/agents"
      value={agent}
      onChange={onChange}
    />
  );
}
