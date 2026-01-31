import {
  Close as CloseIcon,
  NavigateBefore,
  NavigateNext,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogContent,
  IconButton,
  MobileStepper,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Import onboarding images
import step1Image from '../../assets/agent_onboarding/step - 1.png';
import step2Image from '../../assets/agent_onboarding/step - 2.png';
import step3Image from '../../assets/agent_onboarding/step - 3.png';
import step3_2Image from '../../assets/agent_onboarding/step - 3 - 2.png';
import step4Image from '../../assets/agent_onboarding/step - 4.png';
import step5Image from '../../assets/agent_onboarding/step - 5.png';
import step6Image from '../../assets/agent_onboarding/step - 6.png';
import step7Image from '../../assets/agent_onboarding/step - 7.png';
import step8Image from '../../assets/agent_onboarding/step - 8.png';

interface OnboardingStep {
  image: string;
  titleKey: string;
  descriptionKey: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    image: step1Image,
    titleKey: 'agentOnboarding.step1.title',
    descriptionKey: 'agentOnboarding.step1.description',
  },
  {
    image: step2Image,
    titleKey: 'agentOnboarding.step2.title',
    descriptionKey: 'agentOnboarding.step2.description',
  },
  {
    image: step3Image,
    titleKey: 'agentOnboarding.step3.title',
    descriptionKey: 'agentOnboarding.step3.description',
  },
  {
    image: step3_2Image,
    titleKey: 'agentOnboarding.step3_2.title',
    descriptionKey: 'agentOnboarding.step3_2.description',
  },
  {
    image: step4Image,
    titleKey: 'agentOnboarding.step4.title',
    descriptionKey: 'agentOnboarding.step4.description',
  },
  {
    image: step5Image,
    titleKey: 'agentOnboarding.step5.title',
    descriptionKey: 'agentOnboarding.step5.description',
  },
  {
    image: step6Image,
    titleKey: 'agentOnboarding.step6.title',
    descriptionKey: 'agentOnboarding.step6.description',
  },
  {
    image: step7Image,
    titleKey: 'agentOnboarding.step7.title',
    descriptionKey: 'agentOnboarding.step7.description',
  },
  {
    image: step8Image,
    titleKey: 'agentOnboarding.step8.title',
    descriptionKey: 'agentOnboarding.step8.description',
  },
];

interface AgentOnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  loading?: boolean;
}

/**
 * Shared onboarding content used by both mobile dialog and desktop page
 */
const OnboardingContent: React.FC<{
  activeStep: number;
  maxSteps: number;
  currentStep: OnboardingStep;
  isLastStep: boolean;
  loading: boolean;
  isMobile: boolean;
  onNext: () => void;
  onBack: () => void;
  onQuit: () => void;
}> = ({
  activeStep,
  maxSteps,
  currentStep,
  isLastStep,
  loading,
  isMobile,
  onNext,
  onBack,
  onQuit,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header with quit button */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="h2">
          {t('agentOnboarding.title', 'How Deliveries Work')}
        </Typography>
        <IconButton
          onClick={onQuit}
          disabled={loading}
          size="small"
          aria-label={t('agentOnboarding.quit', 'Skip Guide')}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Step indicator */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {t('agentOnboarding.stepOf', 'Step {{current}} of {{total}}', {
            current: activeStep + 1,
            total: maxSteps,
          })}
        </Typography>
      </Box>

      {/* Main content area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        {/* Image container */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2,
            minHeight: 300,
            maxHeight: isMobile ? '40vh' : '50vh',
          }}
        >
          <Box
            component="img"
            src={currentStep.image}
            alt={t(currentStep.titleKey)}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 2,
              boxShadow: 2,
            }}
          />
        </Box>

        {/* Text content */}
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography
            variant="h6"
            gutterBottom
            textAlign="center"
            fontWeight="bold"
          >
            {t(currentStep.titleKey)}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            textAlign="center"
            sx={{ lineHeight: 1.6, maxWidth: 600, mx: 'auto' }}
          >
            {t(currentStep.descriptionKey)}
          </Typography>
        </Box>
      </Box>

      {/* Navigation stepper */}
      <MobileStepper
        variant="dots"
        steps={maxSteps}
        position="static"
        activeStep={activeStep}
        sx={{
          flexGrow: 0,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
        nextButton={
          <Button
            size="large"
            onClick={onNext}
            disabled={loading}
            variant={isLastStep ? 'contained' : 'text'}
            endIcon={!isLastStep && <NavigateNext />}
          >
            {loading
              ? '...'
              : isLastStep
                ? t('agentOnboarding.complete', 'Get Started')
                : t('agentOnboarding.next', 'Next')}
          </Button>
        }
        backButton={
          <Button
            size="large"
            onClick={onBack}
            disabled={activeStep === 0 || loading}
            startIcon={<NavigateBefore />}
          >
            {t('agentOnboarding.previous', 'Previous')}
          </Button>
        }
      />
    </Box>
  );
};

const AgentOnboardingModal: React.FC<AgentOnboardingModalProps> = ({
  open,
  onComplete,
  loading = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStep, setActiveStep] = useState(0);

  const maxSteps = onboardingSteps.length;
  const currentStep = onboardingSteps[activeStep];
  const isLastStep = activeStep === maxSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleQuit = () => {
    onComplete();
  };

  if (!open) {
    return null;
  }

  // Mobile: Render as fullscreen dialog
  if (isMobile) {
    return (
      <Dialog open={open} fullScreen>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            p: 0,
            overflow: 'hidden',
          }}
        >
          <OnboardingContent
            activeStep={activeStep}
            maxSteps={maxSteps}
            currentStep={currentStep}
            isLastStep={isLastStep}
            loading={loading}
            isMobile={isMobile}
            onNext={handleNext}
            onBack={handleBack}
            onQuit={handleQuit}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop: Render as fullscreen page overlay
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.modal,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: 4,
          overflow: 'hidden',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 2,
          }}
        >
          <OnboardingContent
            activeStep={activeStep}
            maxSteps={maxSteps}
            currentStep={currentStep}
            isLastStep={isLastStep}
            loading={loading}
            isMobile={isMobile}
            onNext={handleNext}
            onBack={handleBack}
            onQuit={handleQuit}
          />
        </Paper>
      </Container>
    </Box>
  );
};

export default AgentOnboardingModal;
