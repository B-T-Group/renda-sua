import { Box, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

function StepCircle({ n }: { n: number }) {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        display: 'grid',
        placeItems: 'center',
        fontSize: '0.85rem',
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {n}
    </Box>
  );
}

export function ItemDetailHowItWorks() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));

  const steps = [
    { key: 'pay', title: t('items.detail.howItWorks.pay', 'Pay MoMo') },
    { key: 'ship', title: t('items.detail.howItWorks.ship', 'We deliver') },
    { key: 'confirm', title: t('items.detail.howItWorks.confirm', 'You confirm') },
  ];

  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
        {steps.map((s, i) => (
          <Stack key={s.key} alignItems="center" spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <StepCircle n={i + 1} />
            <Typography variant="caption" fontWeight={700} textAlign="center" noWrap={isNarrow}>
              {s.title}
            </Typography>
            {!isNarrow ? (
              <Typography variant="caption" color="text.secondary" textAlign="center">
                {s.key === 'pay'
                  ? t(
                      'items.detail.howItWorks.payBody',
                      'Pay with mobile money at checkout in a few taps.'
                    )
                  : s.key === 'ship'
                    ? t(
                        'items.detail.howItWorks.shipBody',
                        'The seller prepares your order and a courier delivers it to you.'
                      )
                    : t(
                        'items.detail.howItWorks.confirmBody',
                        'Confirm receipt so the seller knows everything went well.'
                      )}
              </Typography>
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
