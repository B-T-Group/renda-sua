import { Business as BusinessIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  InputAdornment,
  MenuItem,
  Radio,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PERSONA_HEADER_COLORS } from '../../../constants/personaTheme';
import ReferralCodeEntryButton from '../../common/ReferralCodeEntryButton';
import { PersonaBenefitBullets } from '../../onboarding/PersonaBenefitBullets';
import { PersonaPickIllustration } from '../../onboarding/PersonaPickIllustration';
import type { PersonaId, SignupFormValues } from '../wizard/types';

const PERSONA_OPTIONS: Array<{
  id: PersonaId;
  titleKey: string;
  titleDefault: string;
}> = [
  {
    id: 'client',
    titleKey: 'signupPage.personas.client.title',
    titleDefault: 'Client',
  },
  {
    id: 'agent',
    titleKey: 'signupPage.personas.agent.title',
    titleDefault: 'Agent',
  },
  {
    id: 'business',
    titleKey: 'signupPage.personas.business.title',
    titleDefault: 'Business',
  },
];

export const PersonasStep: React.FC = () => {
  const { t } = useTranslation();
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<SignupFormValues>();
  const personas = useWatch({ control, name: 'personas' }) ?? [];

  const togglePersona = (id: PersonaId) => {
    // Signup allows exactly one persona; additional roles can be enrolled later.
    if (personas.length === 1 && personas[0] === id) return;
    setValue('personas', [id], { shouldDirty: true, shouldValidate: true });
  };

  const hasBusiness = personas.includes('business');

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t('signupPage.whyAccount', 'Why create an account?')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
        {t(
          'signupPage.goalSectionHintMulti',
          'Choose how you want to start. You can add other modes later.'
        )}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: { xs: 1.25, sm: 1.5 },
        }}
      >
        {PERSONA_OPTIONS.map((opt) => {
          const selected = personas.includes(opt.id);
          const accent = PERSONA_HEADER_COLORS[opt.id].main;
          return (
            <Card
              key={opt.id}
              elevation={selected ? 2 : 0}
              sx={{
                position: 'relative',
                cursor: 'pointer',
                border: selected ? 2 : 1,
                borderColor: selected ? accent : 'divider',
                borderRadius: 0,
                transition: 'transform 0.15s ease, box-shadow 0.2s, border-color 0.2s',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                minHeight: { xs: 132, sm: 'auto' },
                '&:hover': { borderColor: accent, boxShadow: 2 },
                '&:active': { transform: { xs: 'scale(0.98)', sm: 'none' } },
              }}
              onClick={() => togglePersona(opt.id)}
            >
              <CardContent sx={{ py: { xs: 2, sm: 2 }, px: { xs: 2, sm: 1.5 } }}>
                <Radio
                  checked={selected}
                  size="small"
                  onChange={() => togglePersona(opt.id)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ position: 'absolute', top: 6, right: 6, zIndex: 1, p: 0.5 }}
                  inputProps={{ 'aria-label': t(opt.titleKey, opt.titleDefault) }}
                />
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: { xs: 80, sm: 92 },
                    mb: { xs: 1, sm: 1 },
                    mx: 'auto',
                  }}
                >
                  <PersonaPickIllustration
                    persona={opt.id}
                    accent={accent}
                    compact
                  />
                </Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  textAlign="center"
                  gutterBottom
                  sx={{ lineHeight: 1.3 }}
                >
                  {t(opt.titleKey, opt.titleDefault)}
                </Typography>
                {selected ? (
                  <Box
                    sx={{
                      mt: 0.5,
                      pt: 1,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <PersonaBenefitBullets
                      persona={opt.id}
                      compact
                      align="center"
                    />
                    {(opt.id === 'agent' || opt.id === 'business') && (
                      <Box
                        sx={{ mt: 1.5, textAlign: 'left' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Controller
                          name="business.referralAgentCode"
                          control={control}
                          render={({ field }) => (
                            <ReferralCodeEntryButton
                              value={field.value}
                              onChange={field.onChange}
                              labelKey="referrals.referralCodeLabel"
                              labelDefault="Agent referral code (optional)"
                              helpKey="referrals.referralCodeHelp"
                              helpDefault="Enter the 6-character code of the Rendasua agent who referred you."
                            />
                          )}
                        />
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    textAlign="center"
                    sx={{ lineHeight: 1.35, display: 'block' }}
                  >
                    {t(
                      `signup.benefits.${opt.id}.tagline`,
                      opt.id === 'client'
                        ? 'Shop nearby · track every order'
                        : opt.id === 'agent'
                          ? 'Deliver on your schedule · get paid'
                          : 'List products · manage orders'
                    )}
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
      {errors.personas && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {errors.personas.message ||
            t('signupPage.personasRequired', 'Select at least one persona.')}
        </Alert>
      )}
      {hasBusiness && (
        <>
          <Controller
            name="business.name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                label={t('signupPage.businessName', 'Business name')}
                required
                autoComplete="organization"
                error={Boolean(errors.business?.name)}
                helperText={errors.business?.name?.message || ' '}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <BusinessIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            )}
          />
          <Controller
            name="business.mainInterest"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                fullWidth
                required
                label={t(
                  'signupPage.primaryBusinessFocus',
                  'Primary business focus'
                )}
              >
                <MenuItem value="sell_items">
                  {t(
                    'completeProfile.mainInterest.sellItems',
                    'Selling products'
                  )}
                </MenuItem>
                <MenuItem value="rent_items">
                  {t(
                    'completeProfile.mainInterest.rentItems',
                    'Renting out items'
                  )}
                </MenuItem>
              </TextField>
            )}
          />
        </>
      )}
    </Stack>
  );
};
