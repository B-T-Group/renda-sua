import { Button, MenuItem, Stack, TextField } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../hooks/useApiClient';
import {
  CurrencyField,
  DirectorySearch,
  FormGrid,
  ImpactCard,
  type DirectoryOption,
} from './fields';
import { advanceImpact, creditImpact, impactObjectiveLines, scheduleImpact } from './impact';
import {
  EMPTY_OBJECTIVES,
  ObjectiveFields,
  objectivesFromRow,
  objectivesPayload,
  type ObjectiveValues,
} from './ObjectiveFields';
import {
  AdvanceArt,
  AssignmentArt,
  CreditArt,
  ScheduleArt,
} from './ProgramArt';
import { fromLocalInput, toLocalInput } from './shared';

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'];

interface ScheduleTemplate {
  id: string;
  name: string;
  is_active: boolean;
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

interface AdvanceTemplate {
  id: string;
  name: string;
  is_active: boolean;
  currency: string;
  default_limit: number;
}

interface PartnerRow {
  business_id: string;
  is_active: boolean;
  business?: { name?: string };
}

export function ScheduleForm({ onDone }: { onDone: (message: string) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [currency, setCurrency] = useState('XAF');
  const [amount, setAmount] = useState('10000');
  const [days, setDays] = useState('');
  const [objectives, setObjectives] = useState<ObjectiveValues>(EMPTY_OBJECTIVES);
  const ready = Boolean(name.trim()) && Number(amount) > 0;
  const impact = scheduleImpact(t, {
    amount,
    currency,
    frequency,
    days,
    locale: i18n.language,
  });
  const objectiveLines = impactObjectiveLines(t, objectives, currency, i18n.language);

  async function create() {
    await api.post('/admin/payment-programs/schedules', {
      ...scheduleBody(name, frequency, currency, amount, days),
      ...objectivesPayload(objectives),
    });
    await onDone(t('admin.paymentPrograms.scheduleCreated', 'Schedule created'));
  }

  return (
    <Stack spacing={2.5}>
      <FormGrid>
        <TextField label={t('admin.paymentPrograms.name', 'Name')} value={name} onChange={(e) => setName(e.target.value)} />
        <FrequencyField value={frequency} onChange={setFrequency} />
        <CurrencyField value={currency} onChange={setCurrency} />
        <TextField label={t('admin.paymentPrograms.amount', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label={t('admin.paymentPrograms.durationDays', 'Duration (days)')} value={days} onChange={(e) => setDays(e.target.value)} />
      </FormGrid>
      <ObjectiveFields values={objectives} onChange={setObjectives} currency={currency} />
      <ImpactCard
        text={impact}
        objectives={objectiveLines}
        art={
          <ScheduleArt
            label={t('admin.paymentPrograms.whatThisDoes', 'What this does')}
          />
        }
      />
      <Button
        variant="contained"
        disabled={!ready}
        onClick={() => void create()}
        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
      >
        {t('admin.paymentPrograms.createSchedule', 'Create schedule')}
      </Button>
    </Stack>
  );
}

export function AdvanceForm({ onDone }: { onDone: (message: string) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [limit, setLimit] = useState('50000');
  const ready = Boolean(name.trim()) && Number(limit) > 0;
  const impact = advanceImpact(t, { amount: limit, currency, locale: i18n.language });

  async function create() {
    await api.post('/admin/payment-programs/cash-advances', { name: name.trim(), currency, defaultLimit: Number(limit) });
    await onDone(t('admin.paymentPrograms.programCreated', 'Program created'));
  }

  return (
    <Stack spacing={2.5}>
      <FormGrid>
        <TextField label={t('admin.paymentPrograms.name', 'Name')} value={name} onChange={(e) => setName(e.target.value)} />
        <CurrencyField value={currency} onChange={setCurrency} />
        <TextField label={t('admin.paymentPrograms.limit', 'Limit')} value={limit} onChange={(e) => setLimit(e.target.value)} />
      </FormGrid>
      <ImpactCard
        text={impact}
        art={
          <AdvanceArt
            label={t('admin.paymentPrograms.whatThisDoes', 'What this does')}
          />
        }
      />
      <Button
        variant="contained"
        disabled={!ready}
        onClick={() => void create()}
        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
      >
        {t('admin.paymentPrograms.createProgram', 'Create program')}
      </Button>
    </Stack>
  );
}

export function CreditForm({ partners, onDone }: { partners: PartnerRow[]; onDone: (message: string) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [client, setClient] = useState<DirectoryOption | null>(null);
  const [amount, setAmount] = useState('5000');
  const [currency, setCurrency] = useState('XAF');
  const [applicability, setApplicability] = useState('any_store');
  const [businessId, setBusinessId] = useState('');
  const active = partners.filter((row) => row.is_active);
  const selected = active.find((row) => row.business_id === businessId);
  const blocked = !client?.userId || !(Number(amount) > 0) || (applicability === 'specific_business' && !businessId);
  const impact = creditImpact(t, {
    amount,
    currency,
    scope: applicability,
    storeName: selected?.business?.name,
    clientName: client?.name,
    locale: i18n.language,
  });

  async function grant() {
    await api.post('/admin/payment-programs/credits', {
      userId: client?.userId,
      amount: Number(amount),
      currency,
      applicability,
      businessId: businessId || undefined,
      businessName: selected?.business?.name,
    });
    await onDone(t('admin.paymentPrograms.creditGranted', 'Credit granted'));
  }

  return (
    <Stack spacing={2.5}>
      <FormGrid>
        <DirectorySearch
          label={t('admin.paymentPrograms.client', 'Client')}
          placeholder={t('admin.paymentPrograms.clientSearch', 'Name, email, or phone number')}
          endpoint="/admin/payment-programs/clients"
          value={client}
          onChange={setClient}
        />
        <TextField label={t('admin.paymentPrograms.amount', 'Amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <CurrencyField value={currency} onChange={setCurrency} />
        <ScopeField value={applicability} onChange={setApplicability} />
        {applicability === 'specific_business' ? (
          <PartnerPicker partners={active} value={businessId} onChange={setBusinessId} />
        ) : null}
      </FormGrid>
      <ImpactCard
        text={impact}
        art={
          <CreditArt
            label={t('admin.paymentPrograms.whatThisDoes', 'What this does')}
          />
        }
      />
      <Button
        variant="contained"
        disabled={blocked}
        onClick={() => void grant()}
        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
      >
        {t('admin.paymentPrograms.grantCredits', 'Grant credits')}
      </Button>
    </Stack>
  );
}

export function AssignmentForm({
  schedules,
  programs,
  onDone,
}: {
  schedules: ScheduleTemplate[];
  programs: AdvanceTemplate[];
  onDone: (message: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [kind, setKind] = useState('schedule');
  const [templateId, setTemplateId] = useState('');
  const [agent, setAgent] = useState<DirectoryOption | null>(null);
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date().toISOString()));
  const templates = kind === 'schedule' ? schedules.filter((row) => row.is_active) : programs.filter((row) => row.is_active);
  const selected = templates.find((row) => row.id === templateId);
  const ready = Boolean(templateId && agent && (kind === 'advance' ? agent.userId : fromLocalInput(startsAt)));
  const impact = assignmentImpact(t, i18n.language, selected, agent?.name);

  async function apply() {
    await postAssignment(api, kind, templateId, agent, startsAt, programs);
    await onDone(t('admin.paymentPrograms.assignmentCreated', 'Assignment created'));
  }

  return (
    <Stack spacing={2.5}>
      <FormGrid>
        <TextField select label={t('admin.paymentPrograms.assignKind', 'Apply')} value={kind} onChange={(e) => { setKind(e.target.value); setTemplateId(''); }}>
          <MenuItem value="schedule">{t('admin.paymentPrograms.schedules', 'Schedules')}</MenuItem>
          <MenuItem value="advance">{t('admin.paymentPrograms.advances', 'Cash advances')}</MenuItem>
        </TextField>
        <TextField select label={t('admin.paymentPrograms.template', 'Template')} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {templates.map((row) => <MenuItem key={row.id} value={row.id}>{row.name}</MenuItem>)}
        </TextField>
        <DirectorySearch
          label={t('admin.paymentPrograms.agent', 'Agent')}
          placeholder={t('admin.paymentPrograms.directorySearch', 'Name, email, or referral code')}
          endpoint="/admin/payment-programs/agents"
          value={agent}
          onChange={setAgent}
        />
        {kind === 'schedule' ? (
          <TextField type="datetime-local" label={t('admin.paymentPrograms.startsAt', 'Starts at')} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} InputLabelProps={{ shrink: true }} />
        ) : null}
      </FormGrid>
      <ImpactCard
        text={impact.text}
        objectives={impact.objectives}
        art={
          <AssignmentArt
            label={t('admin.paymentPrograms.whatThisDoes', 'What this does')}
          />
        }
      />
      <Button
        variant="contained"
        disabled={!ready}
        onClick={() => void apply()}
        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
      >
        {t('admin.paymentPrograms.assign', 'Assign')}
      </Button>
    </Stack>
  );
}

export function PartnerForm({ onDone }: { onDone: (message: string) => Promise<void> }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const [business, setBusiness] = useState<DirectoryOption | null>(null);

  async function mark() {
    await api.post('/admin/payment-programs/partners', { businessId: business?.id, isActive: true });
    await onDone(t('admin.paymentPrograms.partnerMarked', 'Partner saved'));
  }

  return (
    <Stack spacing={2}>
      <DirectorySearch
        label={t('admin.paymentPrograms.business', 'Business')}
        placeholder={t('admin.paymentPrograms.directorySearch', 'Name, email, or referral code')}
        endpoint="/admin/payment-programs/businesses"
        value={business}
        onChange={setBusiness}
      />
      <Button variant="contained" disabled={!business} onClick={() => void mark()}>
        {t('admin.paymentPrograms.markPartner', 'Mark as partner')}
      </Button>
    </Stack>
  );
}

function FrequencyField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <TextField select label={t('admin.paymentPrograms.frequency', 'Frequency')} value={value} onChange={(e) => onChange(e.target.value)}>
      {FREQUENCIES.map((item) => (
        <MenuItem key={item} value={item}>{t(`admin.paymentPrograms.${item}`, item)}</MenuItem>
      ))}
    </TextField>
  );
}

function ScopeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <TextField select label={t('admin.paymentPrograms.appliesTo', 'Applies to')} value={value} onChange={(e) => onChange(e.target.value)}>
      <MenuItem value="any_store">{t('admin.paymentPrograms.anyStore', 'Any store')}</MenuItem>
      <MenuItem value="partner_businesses">{t('admin.paymentPrograms.allPartners', 'All partner businesses')}</MenuItem>
      <MenuItem value="specific_business">{t('admin.paymentPrograms.onePartner', 'One partner business')}</MenuItem>
    </TextField>
  );
}

function PartnerPicker({
  partners,
  value,
  onChange,
}: {
  partners: PartnerRow[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      select
      label={t('admin.paymentPrograms.partnerBusiness', 'Partner business')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      helperText={partners.length ? undefined : t('admin.paymentPrograms.noPartners', 'Add an active partner before granting credit for one store.')}
    >
      {partners.map((row) => (
        <MenuItem key={row.business_id} value={row.business_id}>{row.business?.name || row.business_id}</MenuItem>
      ))}
    </TextField>
  );
}

function scheduleBody(name: string, frequency: string, currency: string, amount: string, days: string) {
  return {
    name: name.trim(),
    frequency,
    currency,
    defaultAmount: Number(amount),
    defaultDurationDays: Number(days) > 0 ? Number(days) : undefined,
  };
}

function assignmentImpact(
  t: (key: string, fallback: string, options?: Record<string, string>) => string,
  locale: string,
  selected: ScheduleTemplate | AdvanceTemplate | undefined,
  name?: string
): { text: string; objectives: string[] } {
  if (!selected) {
    return {
      text: t('admin.paymentPrograms.pickTemplate', 'Choose a template to see what the agent will receive.'),
      objectives: [],
    };
  }
  if ('default_limit' in selected) {
    return {
      text: advanceImpact(t, { amount: String(selected.default_limit), currency: selected.currency, name, locale }),
      objectives: [],
    };
  }
  const objectives = objectivesFromRow(selected);
  return {
    text: scheduleImpact(t, {
      amount: String(selected.default_amount),
      currency: selected.currency,
      frequency: selected.frequency,
      days: selected.default_duration_days ? String(selected.default_duration_days) : '',
      name,
      locale,
    }),
    objectives: impactObjectiveLines(t, objectives, selected.currency, locale),
  };
}

async function postAssignment(
  api: { post: (url: string, body: unknown) => Promise<unknown> },
  kind: string,
  templateId: string,
  agent: DirectoryOption | null,
  startsAt: string,
  programs: AdvanceTemplate[]
) {
  if (kind === 'schedule') {
    await api.post(`/admin/payment-programs/schedules/${templateId}/assignments`, {
      agentId: agent?.id,
      startsAt: fromLocalInput(startsAt),
    });
    return;
  }
  const program = programs.find((row) => row.id === templateId);
  await api.post(`/admin/payment-programs/cash-advances/${templateId}/facilities`, {
    userId: agent?.userId,
    currency: program?.currency,
    limitAmount: Number(program?.default_limit),
  });
}
