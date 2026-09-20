import { Alert, Button, Stack, Typography } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApiClient } from '../../../hooks/useApiClient';
import { AdvanceTables } from './AdvanceTables';
import { CampaignPanel } from './CampaignPanel';
import { CreditTables } from './CreditTables';
import { PartnerTables } from './PartnerTables';
import { AdvanceForm, AssignmentForm, CreditForm, PartnerForm, ScheduleForm } from './ProgramForms';
import { ScheduleTables } from './ScheduleTables';

export function ScheduleSection() {
  const rows = useProgramRows<any>('/admin/payment-programs/schedules');
  return (
    <SectionShell titleKey="admin.paymentPrograms.schedules" title="Schedules" notice={rows.notice}>
      <ScheduleForm onDone={rows.done} />
      <ScheduleTables part="templates" schedules={rows.data} onChanged={rows.done} />
    </SectionShell>
  );
}

export function AdvanceSection() {
  const { t } = useTranslation();
  const rows = useProgramRows<any>('/admin/payment-programs/cash-advances');
  return (
    <SectionShell titleKey="admin.paymentPrograms.advances" title="Cash advances" notice={rows.notice}>
      <AdvanceForm onDone={rows.done} />
      <AdvanceTables part="programs" programs={rows.data} onChanged={rows.done} />
      <Typography variant="h6">{t('admin.paymentPrograms.assignments', 'Assignments')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('admin.paymentPrograms.facilitiesNote', 'Lines already opened are assignments.')}
      </Typography>
      <Button component={Link} to="/admin/payment-programs/assignments" size="small" sx={{ alignSelf: 'flex-start' }}>
        {t('admin.paymentPrograms.viewAssignments', 'Manage assignments')}
      </Button>
      <AdvanceTables part="facilities" programs={rows.data} onChanged={rows.done} />
    </SectionShell>
  );
}

export function CreditSection() {
  const grants = useProgramRows<any>('/admin/payment-programs/credits');
  const partners = useProgramRows<any>('/admin/payment-programs/partners');
  return (
    <SectionShell titleKey="admin.paymentPrograms.credits" title="Credits" notice={grants.notice || partners.notice}>
      <CreditForm partners={partners.data} onDone={grants.done} />
      <CreditTables grants={grants.data} onChanged={grants.done} />
    </SectionShell>
  );
}

export function AssignmentSection() {
  const schedules = useProgramRows<any>('/admin/payment-programs/schedules');
  const programs = useProgramRows<any>('/admin/payment-programs/cash-advances');
  async function done(message: string) {
    await schedules.done(message);
    await programs.reload();
  }
  return (
    <SectionShell titleKey="admin.paymentPrograms.assignments" title="Assignments" notice={schedules.notice || programs.notice}>
      <AssignmentForm schedules={schedules.data} programs={programs.data} onDone={done} />
      <ScheduleTables part="assignments" schedules={schedules.data} onChanged={done} />
      <AdvanceTables part="facilities" programs={programs.data} onChanged={done} />
    </SectionShell>
  );
}

export function PartnerSection() {
  const rows = useProgramRows<any>('/admin/payment-programs/partners');
  return (
    <SectionShell titleKey="admin.paymentPrograms.partners" title="Partners" notice={rows.notice}>
      <PartnerForm onDone={rows.done} />
      <PartnerTables partners={rows.data} onChanged={rows.done} />
    </SectionShell>
  );
}

export function CampaignSection() {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <SectionShell titleKey="admin.paymentPrograms.campaigns" title="Campaigns" notice={notice}>
      <CampaignPanel onNotice={setNotice} />
    </SectionShell>
  );
}

function SectionShell({
  titleKey,
  title,
  notice,
  children,
}: {
  titleKey: string;
  title: string;
  notice: string | null;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={3}>
      <Button component={Link} to="/admin/payment-programs" size="small" sx={{ alignSelf: 'flex-start' }}>
        {t('admin.paymentPrograms.backToPrograms', 'Payment programs')}
      </Button>
      <Typography variant="h5">{t(titleKey, title)}</Typography>
      {notice && <Alert>{notice}</Alert>}
      {children}
    </Stack>
  );
}

function useProgramRows<T>(path: string) {
  const api = useApiClient();
  const [data, setData] = useState<T[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const response = await api.get(path);
    setData(response.data || []);
  }, [api, path]);

  useEffect(() => {
    void reload().catch((error: any) => setNotice(error?.message || 'Load failed'));
  }, [reload]);

  async function done(message: string) {
    setNotice(message);
    await reload();
  }

  return { data, notice, done, reload };
}
