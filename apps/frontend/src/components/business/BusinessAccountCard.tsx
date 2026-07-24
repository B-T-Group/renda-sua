import { Box, Button, Card, CardContent, Chip, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessAccountType } from '../../hooks/useBusinessAccountType';

export const BusinessAccountCard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { plan, isLocked, lockedUntilLabel } = useBusinessAccountType();

  return (
    <Card
      elevation={2}
      sx={{
        borderRadius: 3,
        borderLeft: `4px solid ${plan.color}`,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 6 },
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {Array.from({ length: plan.stars }).map((_, i) => (
            <StarIcon key={i} sx={{ color: plan.color, fontSize: 18 }} />
          ))}
          <Chip
            label={t(plan.labelKey, plan.defaultLabel)}
            size="small"
            sx={{ bgcolor: plan.color, color: '#fff', fontWeight: 700, fontSize: 11 }}
          />
        </Box>

        <Typography variant="h6" fontWeight={700}>
          {t('business.accountType.commissionLabel', '{{percent}}% Commission', {
            percent: plan.commissionPercent,
          })}
        </Typography>

        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {t('business.accountType.cardDescription', 'Your current plan — commission applies to every order.')}
        </Typography>

        {isLocked && (
          <Typography variant="caption" color="warning.main" display="block" mt={1}>
            {t(
              'business.accountType.lockedUntil',
              'Plan locked until {{date}}',
              { date: lockedUntilLabel }
            )}
          </Typography>
        )}
      </CardContent>

      <Box px={2} pb={2}>
        <Button
          size="small"
          variant="outlined"
          sx={{ borderColor: plan.color, color: plan.color }}
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
