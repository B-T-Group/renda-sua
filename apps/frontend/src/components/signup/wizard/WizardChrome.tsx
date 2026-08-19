import {
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { WizardStepDefinition } from './stepRegistry';

export interface WizardChromeProps {
  steps: WizardStepDefinition[];
  activeIndex: number;
  isFirst: boolean;
  isLast: boolean;
  saving?: boolean;
  nextDisabled?: boolean;
  onBack: () => void;
  onNext: () => void;
  onCreate: () => void;
  children: React.ReactNode;
  hideProgress?: boolean;
  primaryOnly?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

export const WizardChrome: React.FC<WizardChromeProps> = ({
  steps,
  activeIndex,
  isFirst,
  isLast,
  saving,
  nextDisabled,
  onBack,
  onNext,
  onCreate,
  children,
  hideProgress,
  primaryOnly,
}) => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const labels = steps.map((s) => t(s.labelKey, s.labelDefault));
  const stepProgressPercent =
    ((activeIndex + 1) / Math.max(steps.length, 1)) * 100;

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      {!hideProgress &&
        (isNarrow ? (
          <Box sx={{ mt: 0.5 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="baseline"
              spacing={1}
              sx={{ mb: 1 }}
            >
              <Box
                component="span"
                sx={{
                  typography: 'caption',
                  color: 'text.secondary',
                  fontWeight: 700,
                }}
              >
                {t('signupPage.stepProgress', 'Step {{current}} of {{total}}', {
                  current: activeIndex + 1,
                  total: steps.length,
                })}
              </Box>
              <Box
                component="span"
                sx={{
                  typography: 'caption',
                  color: 'primary.main',
                  fontWeight: 700,
                  textAlign: 'right',
                  maxWidth: '58%',
                }}
              >
                {labels[activeIndex]}
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={stepProgressPercent}
              sx={{
                height: 8,
                borderRadius: 0,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                '& .MuiLinearProgress-bar': { borderRadius: 0 },
              }}
            />
          </Box>
        ) : (
          <Stepper activeStep={activeIndex} alternativeLabel sx={{ py: 1.5 }}>
            {labels.map((label) => (
              <Step key={label}>
                <StepLabel
                  sx={{ '& .MuiStepLabel-label': { fontSize: '0.75rem' } }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        ))}

      {children}

      <Box
        sx={{
          position: { xs: 'sticky', sm: 'static' },
          bottom: 0,
          zIndex: 8,
          mx: { xs: -2, sm: 0 },
          mt: { xs: 1, sm: 0 },
          pt: { xs: 2, sm: 0 },
          pb: {
            xs: 'max(12px, env(safe-area-inset-bottom, 0px))',
            sm: 0,
          },
          px: { xs: 2, sm: 0 },
          bgcolor: {
            xs: alpha(theme.palette.background.paper, 0.92),
            sm: 'transparent',
          },
          backdropFilter: { xs: 'saturate(180%) blur(12px)', sm: 'none' },
          borderTop: { xs: 1, sm: 0 },
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          {primaryOnly ? (
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={primaryOnly.onClick}
              disabled={primaryOnly.loading}
              startIcon={
                primaryOnly.loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : undefined
              }
              sx={{ py: 1.25, borderRadius: 0, fontWeight: 700 }}
            >
              {primaryOnly.label}
            </Button>
          ) : (
            <>
              <Button
                variant="outlined"
                size="large"
                onClick={onBack}
                disabled={isFirst || saving}
                sx={{
                  minWidth: { xs: 96, sm: 'auto' },
                  flexShrink: 0,
                  py: 1.25,
                  borderRadius: 0,
                }}
              >
                {t('signupPage.back', 'Back')}
              </Button>
              {!isLast ? (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={onNext}
                  disabled={nextDisabled || saving}
                  sx={{
                    py: 1.25,
                    borderRadius: 0,
                    fontWeight: 700,
                    '&.Mui-disabled': { boxShadow: 'none' },
                  }}
                >
                  {t('signupPage.next', 'Next')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={onCreate}
                  disabled={nextDisabled || saving}
                  startIcon={
                    saving ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : undefined
                  }
                  sx={{ py: 1.25, borderRadius: 0, fontWeight: 700 }}
                >
                  {saving
                    ? t('signupPage.creating', 'Creating...')
                    : t('signupPage.createAccount', 'Create account')}
                </Button>
              )}
            </>
          )}
        </Stack>
      </Box>
    </Stack>
  );
};
