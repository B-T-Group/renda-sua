import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { Chip, Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminBusinessVerificationSummary } from '../../hooks/useAdminBusinesses';

export type VerificationStepStatus =
  | 'done'
  | 'pending'
  | 'missing'
  | 'rejected';

export interface AdminBusinessVerificationStepsProps {
  summary?: AdminBusinessVerificationSummary | null;
  dense?: boolean;
}

function contractStepStatus(
  summary?: AdminBusinessVerificationSummary | null
): VerificationStepStatus {
  if (!summary) return 'missing';
  if (summary.contractComplete) return 'done';
  if (summary.contractStatus === 'missing') return 'missing';
  return 'pending';
}

function idStepStatus(
  summary?: AdminBusinessVerificationSummary | null
): VerificationStepStatus {
  if (!summary) return 'missing';
  if (summary.idDocumentStatus === 'approved') return 'done';
  if (summary.idDocumentStatus === 'rejected') return 'rejected';
  if (summary.idDocumentStatus === 'pending') return 'pending';
  return 'missing';
}

function chipColor(
  status: VerificationStepStatus
): 'success' | 'warning' | 'error' | 'default' {
  if (status === 'done') return 'success';
  if (status === 'rejected') return 'error';
  if (status === 'pending') return 'warning';
  return 'default';
}

export const AdminBusinessVerificationSteps: React.FC<
  AdminBusinessVerificationStepsProps
> = ({ summary, dense = false }) => {
  const { t } = useTranslation();
  const contractStatus = contractStepStatus(summary);
  const identityStatus = idStepStatus(summary);

  const contractLabel =
    contractStatus === 'done'
      ? t('admin.businesses.steps.contractDone', 'Contract signed')
      : contractStatus === 'pending'
        ? t('admin.businesses.steps.contractPending', 'Contract pending')
        : t('admin.businesses.steps.contractMissing', 'Contract missing');

  const idLabel =
    identityStatus === 'done'
      ? t('admin.businesses.steps.idDone', 'ID approved')
      : identityStatus === 'pending'
        ? t('admin.businesses.steps.idPending', 'ID pending review')
        : identityStatus === 'rejected'
          ? t('admin.businesses.steps.idRejected', 'ID rejected')
          : t('admin.businesses.steps.idMissing', 'ID not uploaded');

  return (
    <Stack
      direction="row"
      spacing={dense ? 0.75 : 1}
      flexWrap="wrap"
      useFlexGap
    >
      <Chip
        size="small"
        color={chipColor(contractStatus)}
        variant={contractStatus === 'done' ? 'filled' : 'outlined'}
        icon={
          contractStatus === 'done' ? (
            <CheckCircleIcon />
          ) : (
            <RadioButtonUncheckedIcon />
          )
        }
        label={contractLabel}
      />
      <Chip
        size="small"
        color={chipColor(identityStatus)}
        variant={identityStatus === 'done' ? 'filled' : 'outlined'}
        icon={
          identityStatus === 'done' ? (
            <CheckCircleIcon />
          ) : (
            <RadioButtonUncheckedIcon />
          )
        }
        label={idLabel}
      />
    </Stack>
  );
};
