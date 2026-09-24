import { Stack, TextField, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ObjectiveValues {
  targetAgentRecruitments: string;
  targetClientSignups: string;
  targetMerchantRecruitments: string;
  targetItemSalesAmount: string;
  targetRentalAmount: string;
}

export const EMPTY_OBJECTIVES: ObjectiveValues = {
  targetAgentRecruitments: '',
  targetClientSignups: '',
  targetMerchantRecruitments: '',
  targetItemSalesAmount: '',
  targetRentalAmount: '',
};

export function objectivesFromRow(row?: {
  target_agent_recruitments?: number | null;
  target_client_signups?: number | null;
  target_merchant_recruitments?: number | null;
  target_item_sales_amount?: number | null;
  target_rental_amount?: number | null;
}): ObjectiveValues {
  return {
    targetAgentRecruitments: optionalString(row?.target_agent_recruitments),
    targetClientSignups: optionalString(row?.target_client_signups),
    targetMerchantRecruitments: optionalString(row?.target_merchant_recruitments),
    targetItemSalesAmount: optionalString(row?.target_item_sales_amount),
    targetRentalAmount: optionalString(row?.target_rental_amount),
  };
}

export function objectivesPayload(values: ObjectiveValues) {
  return {
    targetAgentRecruitments: optionalNumberOrNull(values.targetAgentRecruitments),
    targetClientSignups: optionalNumberOrNull(values.targetClientSignups),
    targetMerchantRecruitments: optionalNumberOrNull(
      values.targetMerchantRecruitments
    ),
    targetItemSalesAmount: optionalNumberOrNull(values.targetItemSalesAmount),
    targetRentalAmount: optionalNumberOrNull(values.targetRentalAmount),
  };
}

export function ObjectiveFields({
  values,
  onChange,
  currency,
}: {
  values: ObjectiveValues;
  onChange: (next: ObjectiveValues) => void;
  currency?: string;
}) {
  const { t } = useTranslation();
  function set(key: keyof ObjectiveValues, value: string) {
    onChange({ ...values, [key]: value });
  }
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">
        {t('admin.paymentPrograms.objectives', 'Objectives (optional)')}
      </Typography>
      <TextField
        label={t('admin.paymentPrograms.targetAgentRecruitments', 'Agent recruitments')}
        value={values.targetAgentRecruitments}
        onChange={(e) => set('targetAgentRecruitments', e.target.value)}
        type="number"
      />
      <TextField
        label={t('admin.paymentPrograms.targetClientSignups', 'Client signups')}
        value={values.targetClientSignups}
        onChange={(e) => set('targetClientSignups', e.target.value)}
        type="number"
      />
      <TextField
        label={t('admin.paymentPrograms.targetMerchantRecruitments', 'Merchant recruitments')}
        value={values.targetMerchantRecruitments}
        onChange={(e) => set('targetMerchantRecruitments', e.target.value)}
        type="number"
      />
      <TextField
        label={t(
          'admin.paymentPrograms.targetItemSalesAmount',
          'Item sales amount{{currency}}',
          { currency: currency ? ` (${currency})` : '' }
        )}
        value={values.targetItemSalesAmount}
        onChange={(e) => set('targetItemSalesAmount', e.target.value)}
        type="number"
      />
      <TextField
        label={t(
          'admin.paymentPrograms.targetRentalAmount',
          'Rental amount{{currency}}',
          { currency: currency ? ` (${currency})` : '' }
        )}
        value={values.targetRentalAmount}
        onChange={(e) => set('targetRentalAmount', e.target.value)}
        type="number"
      />
    </Stack>
  );
}

function optionalString(value?: number | null) {
  return value == null ? '' : String(value);
}

/** Empty field clears the target (null); used when saving objective forms. */
function optionalNumberOrNull(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
