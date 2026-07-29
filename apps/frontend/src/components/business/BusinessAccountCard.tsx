import { Box, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessAccountType } from '../../hooks/useBusinessAccountType';

export const BusinessAccountCard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { plan, isLocked, lockedUntilLabel } = useBusinessAccountType();
  const planLabel = t(plan.labelKey, plan.defaultLabel);

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `1px solid`,
        borderColor: 'divider',
        borderLeft: `4px solid ${plan.color}`,
        bgcolor: plan.softColor,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 3 },
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Typography sx={{ color: plan.color, letterSpacing: 1, fontSize: 14 }}>
            {'★'.repeat(plan.stars)}
          </Typography>
          <Chip
            label={planLabel}
            size="small"
            sx={{ bgcolor: plan.color, color: '#fff', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        <Typography variant="h6" fontWeight={700} sx={{ color: plan.color }}>
          {t('business.accountType.commissionLabel', '{{percent}}% Commission', {
            percent: plan.commissionPercent,
          })}
        </Typography>

        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {t(plan.taglineKey, plan.defaultTagline)}
        </Typography>

        {isLocked ? (
          <Typography variant="caption" color="warning.main" display="block" mt={1}>
            {t('business.accountType.lockedUntil', 'Plan locked until {{date}}', {
              date: lockedUntilLabel,
            })}
          </Typography>
        ) : null}
      </CardContent>

      <Box px={2} pb={2}>
        <Button
          size="small"
          variant="contained"
          sx={{
            bgcolor: plan.color,
            '&:hover': { bgcolor: plan.color, filter: 'brightness(0.92)' },
          }}
          onClick={() => navigate('/business/account-type')}
        >
          {isLocked
            ? t('business.accountType.viewPlan', 'View Plan')
            : t('business.accountType.changePlan', 'Upgrade / Change Plan')}
        </Button>
      </Box>
    </Card>
  );
};
