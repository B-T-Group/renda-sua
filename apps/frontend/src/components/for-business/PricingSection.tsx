import { CheckCircle, Star } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  BUSINESS_ACCOUNT_TYPE_PLANS,
  getPlanById,
} from '../../constants/businessAccountTypes';
import SectionCTA from './SectionCTA';
import SectionShell from './SectionShell';
import { SIGNUP_SELL } from './forBusinessTheme';

const PricingSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SectionShell
      id="pricing"
      title={t('forBusiness.plans.title', 'Simple, transparent pricing')}
      subtitle={t(
        'forBusiness.plans.subtitle',
        'Every business starts on Standard for free and can upgrade anytime as it grows. No subscriptions — you only pay a commission when you make a sale.'
      )}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        justifyContent="center"
        sx={{ mb: 4 }}
        useFlexGap
        flexWrap="wrap"
      >
        {[
          t('forBusiness.plans.badge.noSub', 'No subscription'),
          t('forBusiness.plans.badge.payOnSale', 'You only pay when you make a sale'),
          t('forBusiness.plans.badge.noHidden', 'No hidden fees'),
        ].map((label) => (
          <Chip
            key={label}
            label={label}
            color="success"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        ))}
      </Stack>

      <Grid container spacing={3}>
        {BUSINESS_ACCOUNT_TYPE_PLANS.map((plan) => (
          <Grid key={plan.id} size={{ xs: 12, md: 4 }}>
            <Card
              elevation={plan.id === 'PREMIUM' ? 6 : 2}
              sx={{
                height: '100%',
                borderRadius: 3,
                borderTop: `4px solid ${plan.color}`,
                bgcolor: plan.softColor,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardContent sx={{ flex: 1, p: 3 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  {Array.from({ length: plan.stars }).map((_, si) => (
                    <Star key={si} sx={{ color: plan.color, fontSize: 18 }} />
                  ))}
                  {plan.id === 'PREMIUM' && (
                    <Chip
                      label={t('forBusiness.plans.popular', 'Popular')}
                      size="small"
                      sx={{
                        bgcolor: plan.color,
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 10,
                      }}
                    />
                  )}
                </Box>

                <Typography variant="h6" fontWeight={800} sx={{ color: plan.color }}>
                  {t(plan.labelKey, plan.defaultLabel)}
                </Typography>

                <Box display="flex" alignItems="baseline" gap={0.5} mt={1} mb={2}>
                  <Typography variant="h3" fontWeight={900}>
                    {plan.commissionPercent}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    {t('forBusiness.plans.commission', 'commission per sale')}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 2 }} />

                {plan.includesFromId ? (
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ color: plan.color, mb: 1 }}
                  >
                    {t('business.accountType.everythingIn', 'Everything in {{plan}}, plus:', {
                      plan: t(
                        getPlanById(plan.includesFromId).labelKey,
                        getPlanById(plan.includesFromId).defaultLabel
                      ),
                    })}
                  </Typography>
                ) : null}

                <List dense disablePadding>
                  {plan.defaultBenefits.map((benefit, bi) => (
                    <ListItem key={bi} disableGutters sx={{ py: 0.3 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <CheckCircle sx={{ color: plan.color, fontSize: 16 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            {t(plan.benefitKeys[bi] ?? benefit, benefit)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>

              <Box px={3} pb={3}>
                <Button
                  component={RouterLink}
                  to={SIGNUP_SELL}
                  variant={plan.id === 'PREMIUM' ? 'contained' : 'outlined'}
                  fullWidth
                  sx={{
                    borderColor: plan.color,
                    color: plan.id === 'PREMIUM' ? '#fff' : plan.color,
                    bgcolor: plan.id === 'PREMIUM' ? plan.color : 'transparent',
                    fontWeight: 700,
                    '&:hover': { bgcolor: alpha(plan.color, 0.08) },
                  }}
                >
                  {t('forBusiness.cta.primary', 'Create my store for free')}
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
        {t(
          'forBusiness.plans.note',
          'All plans start free. Commission is only charged when you make a sale. You can change your plan anytime from your dashboard.'
        )}
      </Typography>

      <SectionCTA
        primaryLabel={t('forBusiness.cta.primary', 'Create my store for free')}
      />
    </SectionShell>
  );
};

export default PricingSection;
