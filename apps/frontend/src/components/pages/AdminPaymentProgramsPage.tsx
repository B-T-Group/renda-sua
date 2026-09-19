import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Container,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CURRENCIES } from '../../constants/enums';
import { useApiClient } from '../../hooks/useApiClient';

interface DirectoryOption {
  id: string;
  userId?: string;
  name: string;
  email: string;
  referralCode?: string | null;
  phone?: string | null;
}

function optionLabel(option: DirectoryOption): string {
  const extra = option.phone || option.referralCode;
  const suffix = extra ? ` · ${extra}` : '';
  return `${option.name} · ${option.email}${suffix}`;
}

function CurrencyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      select
      label={t('admin.paymentPrograms.currency', 'Currency')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {CURRENCIES.map((code) => (
        <MenuItem key={code} value={code}>
          {code}
        </MenuItem>
      ))}
    </TextField>
  );
}

function DirectorySearch({
  label,
  placeholder,
  endpoint,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  endpoint: string;
  value: DirectoryOption | null;
  onChange: (value: DirectoryOption | null) => void;
}) {
  const api = useApiClient();
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<DirectoryOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = input.trim();
    if (term.length < 2) {
      setOptions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      void api
        .get(endpoint, { params: { search: term } })
        .then((response) => setOptions(response.data || []))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => window.clearTimeout(handle);
  }, [api, endpoint, input]);

  const shown =
    value && !options.some((row) => row.id === value.id) ? [value, ...options] : options;

  return (
    <Autocomplete
      options={shown}
      loading={loading}
      value={value}
      filterOptions={(items) => items}
      onChange={(_event, next) => onChange(next)}
      onInputChange={(_event, next, reason) => {
        if (reason === 'input') setInput(next);
      }}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(left, right) => left.id === right.id}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} />
      )}
    />
  );
}

export default function AdminPaymentProgramsPage() {
  const { t } = useTranslation();
  const api = useApiClient();
  const [tab, setTab] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);

  async function reload() {
    const [scheduleRows, programRows, partnerRows] = await Promise.all([
      api.get('/admin/payment-programs/schedules'),
      api.get('/admin/payment-programs/cash-advances'),
      api.get('/admin/payment-programs/partners'),
    ]);
    setSchedules(scheduleRows.data || []);
    setPrograms(programRows.data || []);
    setPartners(partnerRows.data || []);
  }

  useEffect(() => {
    void reload().catch((error: any) => setNotice(error?.message || 'Load failed'));
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('admin.paymentPrograms.title', 'Payment programs')}
      </Typography>
      {notice && <Alert sx={{ mb: 2 }}>{notice}</Alert>}
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label={t('admin.paymentPrograms.schedules', 'Schedules')} />
        <Tab label={t('admin.paymentPrograms.advances', 'Cash advances')} />
        <Tab label={t('admin.paymentPrograms.credits', 'Credits')} />
        <Tab label={t('admin.paymentPrograms.partners', 'Partners')} />
      </Tabs>
      {tab === 0 && (
        <ScheduleForm
          schedules={schedules}
          onDone={async (message) => {
            setNotice(message);
            await reload();
          }}
        />
      )}
      {tab === 1 && (
        <AdvanceForm
          programs={programs}
          onDone={async (message) => {
            setNotice(message);
            await reload();
          }}
        />
      )}
      {tab === 2 && <CreditForm onDone={setNotice} />}
      {tab === 3 && (
        <PartnerForm
          partners={partners}
          onDone={async (message) => {
            setNotice(message);
            await reload();
          }}
        />
      )}
    </Container>
  );
}

function ScheduleForm({ schedules, onDone }: { schedules: any[]; onDone: (message: string) => Promise<void> }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [currency, setCurrency] = useState('XAF');
  const [amount, setAmount] = useState('10000');
  const [agent, setAgent] = useState<DirectoryOption | null>(null);
  const [scheduleId, setScheduleId] = useState('');

  return (
    <Stack spacing={2}>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField select label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
        {['daily', 'weekly', 'biweekly', 'monthly'].map((value) => (
          <MenuItem key={value} value={value}>{value}</MenuItem>
        ))}
      </TextField>
      <CurrencyField value={currency} onChange={setCurrency} />
      <TextField label="Default amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Button
        variant="contained"
        onClick={() =>
          void api
            .post('/admin/payment-programs/schedules', {
              name,
              frequency,
              currency,
              defaultAmount: Number(amount),
            })
            .then(() => onDone('Schedule created'))
        }
      >
        Create schedule
      </Button>
      <TextField select label="Schedule" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
        {schedules.map((row) => (
          <MenuItem key={row.id} value={row.id}>{row.name}</MenuItem>
        ))}
      </TextField>
      <DirectorySearch
        label={t('admin.paymentPrograms.agent', 'Agent')}
        placeholder={t('admin.paymentPrograms.directorySearch', 'Name, email, or referral code')}
        endpoint="/admin/payment-programs/agents"
        value={agent}
        onChange={setAgent}
      />
      <Button
        variant="outlined"
        disabled={!scheduleId || !agent}
        onClick={() =>
          void api
            .post(`/admin/payment-programs/schedules/${scheduleId}/assignments`, {
              agentId: agent?.id,
              startsAt: new Date().toISOString(),
            })
            .then(() => onDone('Schedule applied to agent'))
        }
      >
        Apply to agent
      </Button>
      <Box>
        {schedules.map((row) => (
          <Typography key={row.id} variant="body2">
            {row.name} · {row.frequency} · {row.default_amount} {row.currency}
          </Typography>
        ))}
      </Box>
    </Stack>
  );
}

function AdvanceForm({ programs, onDone }: { programs: any[]; onDone: (message: string) => Promise<void> }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [limit, setLimit] = useState('50000');
  const [programId, setProgramId] = useState('');
  const [agent, setAgent] = useState<DirectoryOption | null>(null);

  return (
    <Stack spacing={2}>
      <TextField label="Program name" value={name} onChange={(e) => setName(e.target.value)} />
      <CurrencyField value={currency} onChange={setCurrency} />
      <TextField label="Default limit" value={limit} onChange={(e) => setLimit(e.target.value)} />
      <Button
        variant="contained"
        onClick={() =>
          void api
            .post('/admin/payment-programs/cash-advances', {
              name,
              currency,
              defaultLimit: Number(limit),
            })
            .then(() => onDone('Cash advance program created'))
        }
      >
        Create program
      </Button>
      <TextField select label="Program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
        {programs.map((row) => (
          <MenuItem key={row.id} value={row.id}>{row.name}</MenuItem>
        ))}
      </TextField>
      <DirectorySearch
        label={t('admin.paymentPrograms.agent', 'Agent')}
        placeholder={t('admin.paymentPrograms.directorySearch', 'Name, email, or referral code')}
        endpoint="/admin/payment-programs/agents"
        value={agent}
        onChange={setAgent}
      />
      <Button
        variant="outlined"
        disabled={!programId || !agent?.userId}
        onClick={() =>
          void api
            .post(`/admin/payment-programs/cash-advances/${programId}/facilities`, {
              userId: agent?.userId,
              currency,
              limitAmount: Number(limit),
            })
            .then(() => onDone('Facility opened'))
        }
      >
        Open facility
      </Button>
    </Stack>
  );
}

function CreditForm({ onDone }: { onDone: (message: string) => void }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const [client, setClient] = useState<DirectoryOption | null>(null);
  const [amount, setAmount] = useState('5000');
  const [currency, setCurrency] = useState('XAF');
  const [applicability, setApplicability] = useState('any_store');
  const [businessId, setBusinessId] = useState('');

  return (
    <Stack spacing={2}>
      <DirectorySearch
        label={t('admin.paymentPrograms.client', 'Client')}
        placeholder={t('admin.paymentPrograms.clientSearch', 'Name, email, or phone number')}
        endpoint="/admin/payment-programs/clients"
        value={client}
        onChange={setClient}
      />
      <TextField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <CurrencyField value={currency} onChange={setCurrency} />
      <TextField select label="Applies to" value={applicability} onChange={(e) => setApplicability(e.target.value)}>
        <MenuItem value="any_store">Any store</MenuItem>
        <MenuItem value="partner_businesses">All partner businesses</MenuItem>
        <MenuItem value="specific_business">One partner business</MenuItem>
      </TextField>
      {applicability === 'specific_business' && (
        <TextField label="Business id" value={businessId} onChange={(e) => setBusinessId(e.target.value)} />
      )}
      <Button
        variant="contained"
        disabled={!client?.userId}
        onClick={() =>
          void api
            .post('/admin/payment-programs/credits', {
              userId: client?.userId,
              amount: Number(amount),
              currency,
              applicability,
              businessId: businessId || undefined,
            })
            .then(() => onDone('Purchase credit granted'))
        }
      >
        Grant credits
      </Button>
    </Stack>
  );
}

function PartnerForm({ partners, onDone }: { partners: any[]; onDone: (message: string) => Promise<void> }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const [business, setBusiness] = useState<DirectoryOption | null>(null);
  return (
    <Stack spacing={2}>
      <DirectorySearch
        label={t('admin.paymentPrograms.business', 'Business')}
        placeholder={t('admin.paymentPrograms.directorySearch', 'Name, email, or referral code')}
        endpoint="/admin/payment-programs/businesses"
        value={business}
        onChange={setBusiness}
      />
      <Button
        variant="contained"
        disabled={!business}
        onClick={() =>
          void api
            .post('/admin/payment-programs/partners', { businessId: business?.id, isActive: true })
            .then(() => onDone('Partner business saved'))
        }
      >
        Mark as partner
      </Button>
      {partners.map((row) => (
        <Typography key={row.id} variant="body2">
          {row.business?.name || row.business_id} · {row.is_active ? 'active' : 'inactive'}
        </Typography>
      ))}
    </Stack>
  );
}
