import {
  Alert,
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
import { useApiClient } from '../../hooks/useApiClient';

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
  const api = useApiClient();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [currency, setCurrency] = useState('XAF');
  const [amount, setAmount] = useState('10000');
  const [agentId, setAgentId] = useState('');
  const [scheduleId, setScheduleId] = useState('');

  return (
    <Stack spacing={2}>
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField select label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
        {['daily', 'weekly', 'biweekly', 'monthly'].map((value) => (
          <MenuItem key={value} value={value}>{value}</MenuItem>
        ))}
      </TextField>
      <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
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
      <TextField label="Agent id" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
      <Button
        variant="outlined"
        disabled={!scheduleId || !agentId}
        onClick={() =>
          void api
            .post(`/admin/payment-programs/schedules/${scheduleId}/assignments`, {
              agentId,
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
  const api = useApiClient();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [limit, setLimit] = useState('50000');
  const [programId, setProgramId] = useState('');
  const [userId, setUserId] = useState('');

  return (
    <Stack spacing={2}>
      <TextField label="Program name" value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
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
      <TextField label="User id" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <Button
        variant="outlined"
        disabled={!programId || !userId}
        onClick={() =>
          void api
            .post(`/admin/payment-programs/cash-advances/${programId}/facilities`, {
              userId,
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
  const api = useApiClient();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('5000');
  const [currency, setCurrency] = useState('XAF');
  const [applicability, setApplicability] = useState('any_store');
  const [businessId, setBusinessId] = useState('');

  return (
    <Stack spacing={2}>
      <TextField label="User id" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <TextField label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
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
        onClick={() =>
          void api
            .post('/admin/payment-programs/credits', {
              userId,
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
  const api = useApiClient();
  const [businessId, setBusinessId] = useState('');
  return (
    <Stack spacing={2}>
      <TextField label="Business id" value={businessId} onChange={(e) => setBusinessId(e.target.value)} />
      <Button
        variant="contained"
        onClick={() =>
          void api
            .post('/admin/payment-programs/partners', { businessId, isActive: true })
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
