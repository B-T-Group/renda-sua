import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  alpha,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CheckCross from './CheckCross';
import SectionCTA from './SectionCTA';
import SectionShell from './SectionShell';
import { FB_ACCENT } from './forBusinessTheme';

const rows = [
  { key: 'storefront', label: 'Online storefront' },
  { key: 'inventory', label: 'Inventory management' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'payments', label: 'Secure payments' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'ai', label: 'AI-generated descriptions' },
  { key: 'messaging', label: 'Customer messaging' },
  { key: 'profile', label: 'Professional business profile' },
] as const;

/** Facebook / WhatsApp / Rendasua: only Rendasua has full support for all rows. */
const matrix: Record<(typeof rows)[number]['key'], [boolean, boolean, boolean]> = {
  storefront: [false, false, true],
  inventory: [false, false, true],
  delivery: [false, false, true],
  payments: [false, false, true],
  analytics: [false, false, true],
  ai: [false, false, true],
  messaging: [true, true, true],
  profile: [false, false, true],
};

const ComparisonTable: React.FC = () => {
  const { t } = useTranslation();
  const cols = [
    t('forBusiness.compare.facebook', 'Facebook Marketplace'),
    t('forBusiness.compare.whatsapp', 'WhatsApp'),
    t('forBusiness.compare.rendasua', 'Rendasua'),
  ];

  return (
    <SectionShell
      title={t('forBusiness.compare.title', 'Why merchants switch to Rendasua')}
      subtitle={t(
        'forBusiness.compare.subtitle',
        'Keep chatting with customers — add the tools informal selling lacks.'
      )}
    >
      <TableContainer
        sx={{
          display: { xs: 'none', md: 'block' },
          borderRadius: 3,
          border: '1.5px solid',
          borderColor: 'divider',
        }}
      >
        <Table size="medium" aria-label={t('forBusiness.compare.title', 'Comparison')}>
          <TableHead>
            <TableRow>
              <TableCell />
              {cols.map((c, i) => (
                <TableCell
                  key={c}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    bgcolor: i === 2 ? alpha(FB_ACCENT, 0.08) : undefined,
                    color: i === 2 ? FB_ACCENT : 'text.primary',
                  }}
                >
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell sx={{ fontWeight: 600 }}>
                  {t(`forBusiness.compare.rows.${r.key}`, r.label)}
                </TableCell>
                {matrix[r.key].map((ok, i) => (
                  <TableCell
                    key={i}
                    align="center"
                    sx={{ bgcolor: i === 2 ? alpha(FB_ACCENT, 0.04) : undefined }}
                  >
                    <CheckCross available={ok} emphasize={i === 2 && ok} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
        {rows.map((r) => (
          <Box
            key={r.key}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1.5px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              {t(`forBusiness.compare.rows.${r.key}`, r.label)}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              {cols.map((c, i) => (
                <Box key={c} sx={{ textAlign: 'center', flex: 1 }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.75, color: i === 2 ? FB_ACCENT : 'text.secondary', fontWeight: 600 }}>
                    {i === 2 ? 'Rendasua' : c.split(' ')[0]}
                  </Typography>
                  <CheckCross available={matrix[r.key][i]} emphasize={i === 2} />
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      <SectionCTA
        primaryLabel={t('forBusiness.cta.sellOn', 'Sell on Rendasua')}
      />
    </SectionShell>
  );
};

export default ComparisonTable;
