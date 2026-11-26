import { CheckCircle, RadioButtonChecked, RadioButtonUnchecked } from '@mui/icons-material';
import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { rentalJourney, type JourneyInput } from '../../utils/rentalJourney';

export function RentalJourneyList(input: JourneyInput & { accent?: string }) {
  const { t } = useTranslation();
  const steps = rentalJourney(input);
  return (
    <Stack spacing={0.5}>
      {steps.map((step) => (
        <Stack key={step.key} direction="row" spacing={1} alignItems="center">
          <JourneyIcon state={step.state} accent={input.accent} />
          <Stack sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={step.state === 'current' ? 700 : 400} color={step.state === 'upcoming' ? 'text.disabled' : 'text.primary'}>
              {t(step.labelKey, step.label)}
            </Typography>
            {step.sub ? <Typography variant="caption" color="text.secondary">{step.sub}</Typography> : null}
          </Stack>
          {step.aside ? <Typography variant="caption" color="text.secondary">{step.aside}</Typography> : null}
        </Stack>
      ))}
    </Stack>
  );
}

function JourneyIcon({ state, accent }: { state: 'done' | 'current' | 'upcoming'; accent?: string }) {
  if (state === 'done') return <CheckCircle sx={{ fontSize: 18, color: 'success.main' }} />;
  if (state === 'current') return <RadioButtonChecked sx={{ fontSize: 18, color: accent ?? 'primary.main' }} />;
  return <RadioButtonUnchecked sx={{ fontSize: 18, color: 'text.disabled' }} />;
}
