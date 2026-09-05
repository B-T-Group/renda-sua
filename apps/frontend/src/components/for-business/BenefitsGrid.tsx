import {
  Inventory2,
  LocalShipping,
  Payments,
  People,
  Schedule,
  Storefront,
  TrendingUp,
} from '@mui/icons-material';
import { Box, Card, CardContent, Grid, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionShell from './SectionShell';
import { FB_ACCENT } from './forBusinessTheme';

const BenefitsGrid: React.FC = () => {
  const { t } = useTranslation();
  const items = [
    { icon: <TrendingUp />, key: 'sales', title: 'More sales', desc: 'Reach shoppers already looking near you.' },
    { icon: <People />, key: 'customers', title: 'New customers', desc: 'Get discovered beyond your WhatsApp contacts.' },
    { icon: <Schedule />, key: 'time', title: 'Save time', desc: 'AI listings and one dashboard for everything.' },
    { icon: <Storefront />, key: 'storefront', title: 'Professional storefront', desc: 'Look established — no website build needed.' },
    { icon: <LocalShipping />, key: 'delivery', title: 'Integrated delivery', desc: 'Agents pick up and deliver for you.' },
    { icon: <Payments />, key: 'payments', title: 'Secure payments', desc: 'Get paid with Mobile Money or cards.' },
    { icon: <Inventory2 />, key: 'inventory', title: 'Inventory control', desc: 'Know what is in stock across locations.' },
  ];

  return (
    <SectionShell
      title={t('forBusiness.benefits.title', 'Outcomes that grow your business')}
      subtitle={t(
        'forBusiness.benefits.subtitle',
        'Not just features — results merchants care about.'
      )}
      bgcolor="background.paper"
    >
      <Grid container spacing={2.5}>
        {items.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                border: '1.5px solid',
                borderColor: 'divider',
                borderRadius: 3,
                '&:hover': { borderColor: FB_ACCENT },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(FB_ACCENT, 0.1),
                    color: FB_ACCENT,
                    mb: 1.5,
                  }}
                  aria-hidden
                >
                  {item.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75, fontSize: '1.05rem' }}>
                  {t(`forBusiness.benefits.${item.key}.title`, item.title)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>
                  {t(`forBusiness.benefits.${item.key}.desc`, item.desc)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </SectionShell>
  );
};

export default BenefitsGrid;
