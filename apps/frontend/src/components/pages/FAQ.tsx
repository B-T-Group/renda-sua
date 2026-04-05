import AssignmentReturnOutlinedIcon from '@mui/icons-material/AssignmentReturnOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  Chip,
  Container,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  buildFaqSections,
  FaqItem,
  FaqSectionId,
  FaqSectionModel,
} from './faqPageData';

const SECTION_ICONS: Record<FaqSectionId, React.ReactElement> = {
  clients: <PersonOutlineOutlinedIcon />,
  refund: <AssignmentReturnOutlinedIcon />,
  agents: <LocalShippingOutlinedIcon />,
  business: <StorefrontOutlinedIcon />,
};

function filterSections(
  sections: FaqSectionModel[],
  query: string
): FaqSectionModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

const FAQ: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [search, setSearch] = useState('');

  const sections = useMemo(() => buildFaqSections(t), [t]);
  const visibleSections = useMemo(
    () => filterSections(sections, search),
    [sections, search]
  );

  const scrollTo = (id: FaqSectionId) => {
    document.getElementById(`faq-section-${id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const primarySoft = alpha(theme.palette.primary.main, 0.08);
  const primaryBorder = alpha(theme.palette.primary.main, 0.12);

  return (
    <Box
      sx={{
        minHeight: '100%',
        background: (muiTheme) =>
          `linear-gradient(180deg, ${alpha(muiTheme.palette.primary.main, 0.06)} 0%, ${muiTheme.palette.background.default} 28%)`,
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3, md: 4 },
            mb: 3,
            borderRadius: 3,
            border: `1px solid ${primaryBorder}`,
            background: `linear-gradient(135deg, ${primarySoft} 0%, ${theme.palette.background.paper} 55%)`,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: 'primary.main',
                  display: 'flex',
                }}
              >
                <HelpOutlineIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    fontSize: { xs: '1.5rem', sm: '2rem' },
                  }}
                >
                  {t('faq.title', 'Frequently Asked Questions')}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mt: 0.75, maxWidth: 560, lineHeight: 1.6 }}
                >
                  {t('faq.subtitle', 'Find answers to common questions')}
                </Typography>
              </Box>
            </Stack>
          </Stack>

          <TextField
            fullWidth
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('faq.searchPlaceholder', 'Search questions and answers…')}
            sx={{ mt: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1.5, mb: 0.5 }}
          >
            {t('faq.jumpToSection', 'Jump to section')}
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
            {sections.map((section) => (
              <Chip
                key={section.id}
                icon={SECTION_ICONS[section.id]}
                label={t(section.titleKey, section.titleDefault)}
                onClick={() => scrollTo(section.id)}
                variant="outlined"
                color="primary"
                sx={{
                  borderRadius: 2,
                  fontWeight: 500,
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            ))}
          </Stack>
        </Paper>

        {visibleSections.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              textAlign: 'center',
              borderRadius: 3,
              borderStyle: 'dashed',
            }}
          >
            <Typography color="text.secondary">
              {t('faq.noResults', 'No questions match your search. Try different keywords.')}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={3}>
            {visibleSections.map((section) => (
              <FaqSectionBlock
                key={section.id}
                section={section}
                icon={SECTION_ICONS[section.id]}
                theme={theme}
              />
            ))}
          </Stack>
        )}

        <Paper
          variant="outlined"
          sx={{
            mt: 4,
            p: { xs: 2.5, sm: 3 },
            borderRadius: 3,
            textAlign: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderColor: primaryBorder,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {t('faq.needMoreHelp', 'Still need help?')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'support.seo.description',
              'Get help with orders, deliveries, payments, and account issues. Contact our support team 24/7.'
            )}
          </Typography>
          <Button
            component={RouterLink}
            to="/support"
            variant="contained"
            size="medium"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            {t('faq.visitSupport', 'Visit support center')}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
};

interface FaqSectionBlockProps {
  section: FaqSectionModel;
  icon: React.ReactElement;
  theme: ReturnType<typeof useTheme>;
}

function FaqSectionBlock({ section, icon, theme }: FaqSectionBlockProps) {
  const { t } = useTranslation();
  const divider = alpha(theme.palette.divider, 0.9);

  return (
    <Paper
      id={`faq-section-${section.id}`}
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `1px solid ${divider}`,
        overflow: 'hidden',
        scrollMarginTop: 96,
      }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          borderBottom: `1px solid ${divider}`,
        }}
      >
        <Box
          sx={{
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            '& svg': { fontSize: 26 },
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" component="h2" fontWeight={700}>
          {t(section.titleKey, section.titleDefault)}
        </Typography>
      </Box>
      <Box sx={{ px: { xs: 1, sm: 1.5 }, py: 1 }}>
        {section.items.map((item: FaqItem) => (
          <Accordion
            key={`${section.id}-${item.key}`}
            disableGutters
            elevation={0}
            sx={{
              '&:before': { display: 'none' },
              borderRadius: '12px !important',
              mb: 1,
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              overflow: 'hidden',
              '&:last-of-type': { mb: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                px: 2,
                minHeight: 56,
                '& .MuiAccordionSummary-content': { my: 1.25 },
              }}
            >
              <Typography variant="subtitle1" fontWeight={600} component="span">
                {item.q}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 2.5 }}>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.75 }}
              >
                {item.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Paper>
  );
}

export default FAQ;
