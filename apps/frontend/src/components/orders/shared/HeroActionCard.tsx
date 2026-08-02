import {
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Countdown } from './Countdown';

export interface HeroActionCardProps {
  title: string;
  subtitle?: string | null;
  deadlineAt?: string | null;
  deadlineLabel?: string | null;
  accent?: 'primary' | 'warning' | 'secondary' | 'success';
  children?: React.ReactNode;
}

export const HeroActionCard: React.FC<HeroActionCardProps> = ({
  title,
  subtitle,
  deadlineAt,
  deadlineLabel,
  accent = 'primary',
  children,
}) => {
  const { t } = useTranslation();
  return (
    <Card
      sx={{
        mb: 3,
        borderLeft: 6,
        borderColor: `${accent}.main`,
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'background.paper'
            : `${accent}.50`,
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>
            {t('orders.nextStep.label', 'Next step')}
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
          {deadlineAt ? (
            <Countdown
              deadlineAt={deadlineAt}
              label={deadlineLabel ?? undefined}
            />
          ) : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default HeroActionCard;
