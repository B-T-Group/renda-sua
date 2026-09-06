import { BusinessCenter, DirectionsBike, ShoppingBag } from '@mui/icons-material';
import { Box, Card, CardContent, Container, Grid, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HOME_ACCENTS } from './homeTheme';

interface PersonaCard {
  icon: React.ReactNode;
  titleKey: string;
  defaultTitle: string;
  descKey: string;
  defaultDesc: string;
  color: string;
  anchor: string;
}

const MarketplaceOverviewSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  const personas: PersonaCard[] = [
    {
      icon: <ShoppingBag sx={{ fontSize: 32, color: HOME_ACCENTS.primary }} />,
      titleKey: 'home.overview.client.title',
      defaultTitle: 'Shoppers',
      descKey: 'home.overview.client.desc',
      defaultDesc: 'Buy what you want to own, or rent what you only need for a while — delivered from local businesses to your door.',
      color: HOME_ACCENTS.primary,
      anchor: '#persona-client',
    },
    {
      icon: <BusinessCenter sx={{ fontSize: 32, color: HOME_ACCENTS.business }} />,
      titleKey: 'home.overview.business.title',
      defaultTitle: 'Businesses',
      descKey: 'home.overview.business.desc',
      defaultDesc: 'Create a storefront, list products and rentals, and reach customers in your city.',
      color: HOME_ACCENTS.business,
      anchor: '#persona-business',
    },
    {
      icon: <DirectionsBike sx={{ fontSize: 32, color: HOME_ACCENTS.delivery }} />,
      titleKey: 'home.overview.agent.title',
      defaultTitle: 'Delivery Agents',
      descKey: 'home.overview.agent.desc',
      defaultDesc: 'Earn money by delivering orders on your own schedule.',
      color: HOME_ACCENTS.delivery,
      anchor: '#persona-agent',
    },
  ];

  return (
    <Box
      component="section"
      id="overview"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Typography
              variant="overline"
              sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.12em', mb: 2, display: 'block' }}
            >
              {t('home.overview.eyebrow', 'One platform. Three roles. One great experience.')}
            </Typography>
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '2rem', md: '2.75rem' },
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                color: 'text.primary',
                mb: 2,
              }}
            >
              {t('home.overview.title', 'A marketplace built for everyone')}
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', maxWidth: 560, mx: 'auto', fontSize: { xs: '1rem', md: '1.1rem' } }}
            >
              {t('home.overview.subtitle', 'Rendasua connects shoppers, local businesses, and delivery agents into one seamless ecosystem — for buying and renting.')}
            </Typography>
          </motion.div>
        </Box>

        {/* Ecosystem diagram */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              width: '100%',
              maxWidth: 560,
            }}
          >
            <svg viewBox="0 0 560 220" style={{ width: '100%', maxWidth: 560 }} aria-hidden="true">
              {/* Center Rendasua hub */}
              <circle cx="280" cy="110" r="52" fill={alpha(HOME_ACCENTS.primary, 0.08)} stroke={HOME_ACCENTS.primary} strokeWidth="2" />
              <text x="280" y="105" textAnchor="middle" fill={HOME_ACCENTS.primary} fontSize="13" fontWeight="bold">Rendasua</text>
              <text x="280" y="122" textAnchor="middle" fill="#64748b" fontSize="10">Marketplace</text>

              {/* Client node */}
              <circle cx="80" cy="110" r="38" fill={alpha(HOME_ACCENTS.primary, 0.07)} stroke={HOME_ACCENTS.primary} strokeWidth="1.5" />
              <text x="80" y="105" textAnchor="middle" fill={HOME_ACCENTS.primary} fontSize="11" fontWeight="bold">Shopper</text>
              <text x="80" y="120" textAnchor="middle" fill="#64748b" fontSize="9">Places order</text>
              {/* Client → Hub */}
              <path d="M 118 110 L 228 110" stroke={HOME_ACCENTS.primary} strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arrowBlue)" />

              {/* Business node */}
              <circle cx="480" cy="60" r="38" fill={alpha(HOME_ACCENTS.business, 0.07)} stroke={HOME_ACCENTS.business} strokeWidth="1.5" />
              <text x="480" y="55" textAnchor="middle" fill={HOME_ACCENTS.business} fontSize="11" fontWeight="bold">Business</text>
              <text x="480" y="70" textAnchor="middle" fill="#64748b" fontSize="9">Fulfils order</text>
              {/* Business → Hub */}
              <path d="M 444 72 L 326 98" stroke={HOME_ACCENTS.business} strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arrowGreen)" />

              {/* Agent node */}
              <circle cx="480" cy="160" r="38" fill={alpha(HOME_ACCENTS.delivery, 0.07)} stroke={HOME_ACCENTS.delivery} strokeWidth="1.5" />
              <text x="480" y="155" textAnchor="middle" fill={HOME_ACCENTS.delivery} fontSize="11" fontWeight="bold">Agent</text>
              <text x="480" y="170" textAnchor="middle" fill="#64748b" fontSize="9">Delivers</text>
              {/* Agent → Hub */}
              <path d="M 444 148 L 326 122" stroke={HOME_ACCENTS.delivery} strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#arrowCyan)" />

              <defs>
                <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={HOME_ACCENTS.primary} />
                </marker>
                <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={HOME_ACCENTS.business} />
                </marker>
                <marker id="arrowCyan" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={HOME_ACCENTS.delivery} />
                </marker>
              </defs>
            </svg>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {personas.map((p, i) => (
            <Grid key={p.anchor} size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: shouldReduce ? 0 : 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
              >
                <Card
                  component="a"
                  href={p.anchor}
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: `1.5px solid ${alpha(p.color, 0.18)}`,
                    borderRadius: 3,
                    textDecoration: 'none',
                    display: 'block',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      borderColor: p.color,
                      transform: 'translateY(-4px)',
                      boxShadow: `0 12px 32px ${alpha(p.color, 0.15)}`,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        borderRadius: 2.5,
                        bgcolor: alpha(p.color, 0.1),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                      }}
                    >
                      {p.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                      {t(p.titleKey, p.defaultTitle)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                      {t(p.descKey, p.defaultDesc)}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default MarketplaceOverviewSection;
