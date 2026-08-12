import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { AgentFocus, SignupFormValues } from '../wizard/types';

const OPTIONS: Array<{
  id: AgentFocus;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
}> = [
  {
    id: 'delivery',
    titleKey: 'agent.focus.deliveryTitle',
    titleDefault: 'Delivery',
    bodyKey: 'agent.focus.deliveryBody',
    bodyDefault: 'Pick up and deliver orders to customers.',
  },
  {
    id: 'commercial',
    titleKey: 'agent.focus.commercialTitle',
    titleDefault: 'Recruit businesses',
    bodyKey: 'agent.focus.commercialBody',
    bodyDefault: 'Help local shops join Rendasua and follow them through setup.',
  },
  {
    id: 'both',
    titleKey: 'agent.focus.bothTitle',
    titleDefault: 'Both',
    bodyKey: 'agent.focus.bothBody',
    bodyDefault: 'Deliver orders and recruit businesses.',
  },
];

export const AgentFocusStep: React.FC = () => {
  const { t } = useTranslation();
  const { control } = useFormContext<SignupFormValues>();

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" fontWeight={700}>
        {t('signupPage.agentFocusTitle', 'What will you focus on?')}
      </Typography>
      <Controller
        name="agentFocus"
        control={control}
        render={({ field, fieldState }) => (
          <>
            {OPTIONS.map((opt) => {
              const selected = field.value === opt.id;
              return (
                <Card
                  key={opt.id}
                  variant="outlined"
                  sx={{
                    borderColor: selected ? 'primary.main' : 'divider',
                    bgcolor: selected ? 'action.selected' : 'background.paper',
                  }}
                >
                  <CardActionArea onClick={() => field.onChange(opt.id)}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {t(opt.titleKey, opt.titleDefault)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(opt.bodyKey, opt.bodyDefault)}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
            {fieldState.error ? (
              <Box>
                <Typography variant="caption" color="error">
                  {t('signupPage.agentFocusRequired', 'Select a focus to continue.')}
                </Typography>
              </Box>
            ) : null}
          </>
        )}
      />
    </Stack>
  );
};
