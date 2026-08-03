import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAgentReferralLookup } from '../../../hooks/useAgentReferralLookup';
import { useSignupWizardUi } from '../wizard/SignupWizardUiContext';
import type { SignupFormValues } from '../wizard/types';

const PERSONA_LABELS: Record<string, { key: string; def: string }> = {
  client: { key: 'signupPage.personas.client.title', def: 'Client' },
  agent: { key: 'signupPage.personas.agent.title', def: 'Agent' },
  business: { key: 'signupPage.personas.business.title', def: 'Business' },
};

export const ReviewStep: React.FC = () => {
  const { t } = useTranslation();
  const { countries } = useSignupWizardUi();
  const { control } = useFormContext<SignupFormValues>();
  const values = useWatch({ control }) as SignupFormValues;
  const referralCode = values.business?.referralAgentCode ?? '';
  const { result: referralLookup } = useAgentReferralLookup(referralCode);

  const countryLabel = useMemo(() => {
    const code = values.country;
    const found = countries.find((c) => c.code === code);
    return (
      found?.name || (code ? t(`completeProfile.countries.${code}`, code) : '')
    );
  }, [countries, t, values.country]);

  const reviewRow = (label: string, value: string) => (
    <Box sx={{ py: { xs: 1.25, sm: 1 } }}>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={600}
        sx={{ display: 'block', mb: 0.25 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ lineHeight: 1.45, wordBreak: 'break-word' }}
      >
        {value}
      </Typography>
    </Box>
  );

  const personasLabel = (values.personas || [])
    .map((p) => t(PERSONA_LABELS[p]?.key, PERSONA_LABELS[p]?.def || p))
    .join(', ');

  const hasBusiness = (values.personas || []).includes('business');
  const trimmedReferral = referralCode.trim().toUpperCase();

  return (
    <Stack spacing={{ xs: 2, sm: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t('signupPage.reviewTitle', 'Review your details')}
      </Typography>
      <Paper variant="outlined" sx={{ p: 0, borderRadius: 0, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, sm: 2 }, pt: 1.5, pb: 2 }}>
          {reviewRow(
            t('signupPage.review.name', 'Name'),
            `${values.contact?.firstName || ''} ${values.contact?.lastName || ''}`.trim()
          )}
          <Divider />
          {reviewRow(
            t('signupPage.review.email', 'Email'),
            values.contact?.email || ''
          )}
          <Divider />
          {reviewRow(
            t('signupPage.review.phone', 'Phone'),
            values.contact?.phone || ''
          )}
          <Divider />
          {reviewRow(t('signupPage.review.personas', 'Personas'), personasLabel)}
          <Divider />
          {reviewRow(t('signupPage.review.country', 'Country'), countryLabel)}
          {hasBusiness && (
            <>
              <Divider />
              {reviewRow(
                t('signupPage.review.business', 'Business'),
                `${values.business?.name || ''} (${
                  values.business?.mainInterest === 'rent_items'
                    ? t(
                        'completeProfile.mainInterest.rentItems',
                        'Renting out items'
                      )
                    : t(
                        'completeProfile.mainInterest.sellItems',
                        'Selling products'
                      )
                })`
              )}
              {trimmedReferral.length === 6 &&
                referralLookup &&
                referralLookup.agentCode === trimmedReferral && (
                  <>
                    <Divider />
                    {reviewRow(
                      t(
                        'business.referrals.referralCodeLabel',
                        'Agent referral code (optional)'
                      ),
                      t('agent.referrals.lookupSuccess', 'Referred by {{name}}', {
                        name:
                          referralLookup.firstName || referralLookup.fullName,
                      })
                    )}
                  </>
                )}
              <Divider />
              {reviewRow(
                t('signupPage.review.storeLocation', 'Store location'),
                [
                  values.storeLocation?.street,
                  values.storeLocation?.city,
                  values.storeLocation?.region,
                  values.storeLocation?.postalCode,
                  countryLabel,
                ]
                  .filter(Boolean)
                  .join(', ')
              )}
            </>
          )}
        </Box>
      </Paper>
    </Stack>
  );
};
