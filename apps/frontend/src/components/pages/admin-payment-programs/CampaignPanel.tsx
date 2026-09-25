import {
  Button,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AFRICAN_MARKET_COUNTRY_CODES } from '../../../constants/marketCountries';
import { useApiClient } from '../../../hooks/useApiClient';
import { useSupportedCountries } from '../../../hooks/useSupportedCountries';
import { resolveCurrencyForCountry } from '../../../utils/resolveCurrencyForCountry';
import { ImpactCard } from './fields';
import { campaignImpact, moneyText } from './impact';
import { ProgramTable, programRowSx, StatusChip, fromLocalInput, useConfirm } from './shared';

interface PartnerOption {
  business_id: string;
  is_active: boolean;
  business?: { name?: string };
}

interface CampaignRow {
  id: string;
  name: string;
  country_code: string;
  persona: string;
  currency: string;
  is_active: boolean;
  subject_amount: number;
  subject_bonus_if_referred: number;
  referrer_amount: number;
  max_referrer_rewards: number;
  store_scope: string;
  business?: { name?: string } | null;
}

const emptyForm = {
  name: '',
  countryCode: 'CM',
  persona: 'client',
  startsAt: '',
  endsAt: '',
  currency: 'XAF',
  storeScope: 'partner_businesses',
  businessId: '',
  subjectAmount: '500',
  subjectBonusIfReferred: '250',
  storeCreditExpiresDays: '',
  referrerAmount: '250',
  maxReferrerRewards: '5',
};

export function CampaignPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const confirm = useConfirm();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [form, setForm] = useState(emptyForm);

  async function reload() {
    const [campaigns, partnerRows] = await Promise.all([
      api.get('/admin/payment-programs/campaigns'),
      api.get('/admin/payment-programs/partners'),
    ]);
    setRows(campaigns.data || []);
    setPartners((partnerRows.data || []).filter((row: PartnerOption) => row.is_active));
  }

  useEffect(() => {
    void reload().catch((error: any) => onNotice(error?.message || 'Load failed'));
  }, []);

  return (
    <Stack spacing={3}>
      <CampaignForm
        form={form}
        partners={partners}
        onChange={setForm}
        onSubmit={() => void submit()}
      />
      <CampaignTable rows={rows} onToggle={(row) => void toggle(row)} />
      {confirm.dialog}
    </Stack>
  );

  async function submit() {
    const startsAt = fromLocalInput(form.startsAt);
    const endsAt = fromLocalInput(form.endsAt);
    if (!startsAt || !endsAt) return;
    await api.post('/admin/payment-programs/campaigns', {
      ...form,
      startsAt,
      endsAt,
      subjectAmount: Number(form.subjectAmount),
      subjectBonusIfReferred: Number(form.subjectBonusIfReferred),
      referrerAmount: Number(form.referrerAmount),
      maxReferrerRewards: Number(form.maxReferrerRewards || 5),
      storeCreditExpiresDays: form.storeCreditExpiresDays
        ? Number(form.storeCreditExpiresDays)
        : undefined,
      businessId: form.storeScope === 'specific_business' ? form.businessId : undefined,
    });
    onNotice(t('admin.paymentPrograms.campaignCreated', 'Campaign created'));
    setForm(emptyForm);
    await reload();
  }

  function toggle(row: CampaignRow) {
    const next = !row.is_active;
    confirm.ask({
      title: t('admin.paymentPrograms.deactivateCampaignTitle', 'Change this campaign?'),
      message: next
        ? t('admin.paymentPrograms.reactivateCampaignMessage', 'New signups in this market will match it again.')
        : t('admin.paymentPrograms.deactivateCampaignMessage', 'New signups will not match it. Credits already granted stay.'),
      run: async () => {
        await api.post(`/admin/payment-programs/campaigns/${row.id}/active`, { isActive: next });
        await reload();
      },
    });
  }
}

function CampaignForm({
  form,
  partners,
  onChange,
  onSubmit,
}: {
  form: typeof emptyForm;
  partners: PartnerOption[];
  onChange: (next: typeof emptyForm) => void;
  onSubmit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const set = (key: keyof typeof emptyForm, value: string) => onChange({ ...form, [key]: value });
  const store = partners.find((row) => row.business_id === form.businessId);
  const amountsReady = [form.subjectAmount, form.referrerAmount, form.subjectBonusIfReferred || '0'].every((value) => {
    const number = Number(value);
    return value.trim() !== '' && Number.isFinite(number) && number >= 0;
  });
  const missingStore = form.storeScope === 'specific_business' && !form.businessId;
  const blocked = !form.name || !form.startsAt || !form.endsAt || !amountsReady || missingStore;
  const impact = campaignImpact(t, {
    persona: form.persona,
    market: form.countryCode,
    currency: form.currency,
    locale: i18n.language,
    storeScope: form.storeScope,
    storeName: store?.business?.name,
    subjectAmount: form.subjectAmount,
    bonus: form.subjectBonusIfReferred || '0',
    referrerAmount: form.referrerAmount,
    cap: form.maxReferrerRewards,
    expiresDays: form.storeCreditExpiresDays,
    hasWindow: Boolean(form.startsAt && form.endsAt),
  });
  return (
    <Stack spacing={2.5}>
      <Typography variant="h6">{t('admin.paymentPrograms.campaigns', 'Credit campaigns')}</Typography>
      <TextField label={t('admin.paymentPrograms.name', 'Name')} value={form.name} onChange={(e) => set('name', e.target.value)} />
      <CampaignBasics form={form} onChange={onChange} />
      <CampaignWindow form={form} onChange={set} />
      <ScopeFields form={form} partners={partners} onChange={set} />
      <AmountFields form={form} onChange={set} />
      <ImpactCard text={impact} />
      <Button
        variant="contained"
        onClick={onSubmit}
        disabled={blocked}
        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
      >
        {t('admin.paymentPrograms.createCampaign', 'Create campaign')}
      </Button>
    </Stack>
  );
}

function CampaignBasics({
  form,
  onChange,
}: {
  form: typeof emptyForm;
  onChange: (next: typeof emptyForm) => void;
}) {
  const { t } = useTranslation();
  const { countries } = useSupportedCountries();

  function setMarket(countryCode: string) {
    onChange({
      ...form,
      countryCode,
      currency: resolveCurrencyForCountry(countryCode, countries),
    });
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <MarketField value={form.countryCode} onChange={setMarket} countries={countries} />
        <TextField
          label={t('admin.paymentPrograms.currency', 'Currency')}
          value={form.currency}
          disabled
          helperText={t(
            'admin.paymentPrograms.currencyFromMarket',
            'Set by the selected market'
          )}
          sx={{ flex: 1 }}
        />
      </Stack>
      <TextField
        select
        label={t('admin.paymentPrograms.persona', 'Persona')}
        value={form.persona}
        onChange={(e) => onChange({ ...form, persona: e.target.value })}
      >
        {['client', 'agent', 'business', 'any'].map((persona) => (
          <MenuItem key={persona} value={persona}>
            {t(`admin.paymentPrograms.${persona}`, persona)}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}

function MarketField({
  value,
  onChange,
  countries,
}: {
  value: string;
  onChange: (value: string) => void;
  countries: Array<{ code: string; name: string }>;
}) {
  const { t } = useTranslation();
  const options = marketOptions(countries, value);
  return (
    <TextField
      select
      label={t('admin.paymentPrograms.market', 'Market')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ flex: 1 }}
    >
      {options.map((country) => (
        <MenuItem key={country.code} value={country.code}>
          {country.name} ({country.code})
        </MenuItem>
      ))}
    </TextField>
  );
}

function marketOptions(
  countries: Array<{ code: string; name: string }>,
  current: string
): Array<{ code: string; name: string }> {
  const list = countries.length
    ? countries.map((country) => ({
        code: country.code.toUpperCase(),
        name: country.name,
      }))
    : AFRICAN_MARKET_COUNTRY_CODES.map((code) => ({ code, name: code }));
  if (current && !list.some((row) => row.code === current)) {
    return [{ code: current, name: current }, ...list];
  }
  return list;
}

function CampaignWindow({ form, onChange }: { form: typeof emptyForm; onChange: (key: keyof typeof emptyForm, value: string) => void }) {
  const { t } = useTranslation();
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField type="datetime-local" label={t('admin.paymentPrograms.startsAt', 'Starts at')} value={form.startsAt} onChange={(e) => onChange('startsAt', e.target.value)} InputLabelProps={{ shrink: true }} />
      <TextField type="datetime-local" label={t('admin.paymentPrograms.endsAt', 'Ends at')} value={form.endsAt} onChange={(e) => onChange('endsAt', e.target.value)} InputLabelProps={{ shrink: true }} />
    </Stack>
  );
}

function ScopeFields({
  form,
  partners,
  onChange,
}: {
  form: typeof emptyForm;
  partners: PartnerOption[];
  onChange: (key: keyof typeof emptyForm, value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <TextField fullWidth select label={t('admin.paymentPrograms.appliesTo', 'Applies to')} value={form.storeScope} onChange={(e) => onChange('storeScope', e.target.value)}>
        <MenuItem value="any_store">{t('admin.paymentPrograms.anyStore', 'Any store')}</MenuItem>
        <MenuItem value="partner_businesses">{t('admin.paymentPrograms.allPartners', 'All partner businesses')}</MenuItem>
        <MenuItem value="specific_business">{t('admin.paymentPrograms.onePartner', 'One partner business')}</MenuItem>
      </TextField>
      {form.storeScope === 'specific_business' && (
        <TextField fullWidth select label={t('admin.paymentPrograms.partnerBusiness', 'Partner business')} value={form.businessId} onChange={(e) => onChange('businessId', e.target.value)}>
          {partners.map((partner) => (
            <MenuItem key={partner.business_id} value={partner.business_id}>{partner.business?.name || partner.business_id}</MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  );
}

function AmountFields({
  form,
  onChange,
}: {
  form: typeof emptyForm;
  onChange: (key: keyof typeof emptyForm, value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <TextField fullWidth label={t('admin.paymentPrograms.storeCredit', 'Store credit for the new user')} value={form.subjectAmount} onChange={(e) => onChange('subjectAmount', e.target.value)} />
      <TextField fullWidth label={t('admin.paymentPrograms.referredBonus', 'Extra store credit if referred')} value={form.subjectBonusIfReferred} onChange={(e) => onChange('subjectBonusIfReferred', e.target.value)} />
      <TextField fullWidth label={t('admin.paymentPrograms.referrerCash', 'Withdrawable cash for the referrer')} value={form.referrerAmount} onChange={(e) => onChange('referrerAmount', e.target.value)} />
      <TextField fullWidth label={t('admin.paymentPrograms.referrerCap', 'Referrer reward cap')} value={form.maxReferrerRewards} onChange={(e) => onChange('maxReferrerRewards', e.target.value)} />
      <TextField fullWidth label={t('admin.paymentPrograms.expiresDays', 'Store credit expires (days)')} value={form.storeCreditExpiresDays} onChange={(e) => onChange('storeCreditExpiresDays', e.target.value)} />
    </Stack>
  );
}

function CampaignTable({ rows, onToggle }: { rows: CampaignRow[]; onToggle: (row: CampaignRow) => void }) {
  const { t, i18n } = useTranslation();
  if (!rows.length) return <Typography>{t('admin.paymentPrograms.empty', 'Nothing here yet.')}</Typography>;
  return (
    <ProgramTable
      title={t('admin.paymentPrograms.existingCampaigns', 'Existing campaigns')}
      columns={[
        { label: t('admin.paymentPrograms.name', 'Name'), width: '22%' },
        { label: t('admin.paymentPrograms.market', 'Market'), width: '16%' },
        { label: t('admin.paymentPrograms.storeCreditCol', 'Store credit'), width: '16%' },
        { label: t('admin.paymentPrograms.referrerCashCol', 'Referrer cash'), width: '16%' },
        { label: t('admin.paymentPrograms.status', 'Status'), width: '12%' },
        { label: t('admin.paymentPrograms.actions', 'Actions'), align: 'right', width: '18%' },
      ]}
    >
      {rows.map((row) => (
        <TableRow key={row.id} hover sx={programRowSx}>
          <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
          <TableCell>{row.country_code} · {t(`admin.paymentPrograms.${row.persona}`, row.persona)}</TableCell>
          <TableCell>{moneyText(row.subject_amount, row.currency, i18n.language)}</TableCell>
          <TableCell>{moneyText(row.referrer_amount, row.currency, i18n.language)} / {row.max_referrer_rewards}</TableCell>
          <TableCell><StatusChip status={row.is_active ? 'active' : 'inactive'} /></TableCell>
          <TableCell align="right">
            <Button size="small" color={row.is_active ? 'warning' : 'primary'} onClick={() => onToggle(row)}>
              {row.is_active ? t('admin.paymentPrograms.deactivate', 'Deactivate') : t('admin.paymentPrograms.reactivate', 'Reactivate')}
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </ProgramTable>
  );
}
