import { ArrowBack as BackIcon } from '@mui/icons-material';
import {
  Button,
  Container,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../../../contexts/UserProfileContext';
import FirstRentalItemCreateStep, {
  type CreatedRentalItemSummary,
} from './FirstRentalItemCreateStep';
import FirstRentalItemLocationStep from './FirstRentalItemLocationStep';
import FirstRentalItemSuccessStep from './FirstRentalItemSuccessStep';
import FirstRentalItemUploadStep from './FirstRentalItemUploadStep';

const FirstRentalItemFlow: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const [step, setStep] = useState(0);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [primaryImagePreviewUrl, setPrimaryImagePreviewUrl] = useState<
    string | null
  >(null);
  const [item, setItem] = useState<CreatedRentalItemSummary | null>(null);

  useEffect(() => {
    return () => {
      if (primaryImagePreviewUrl) {
        URL.revokeObjectURL(primaryImagePreviewUrl);
      }
    };
  }, [primaryImagePreviewUrl]);

  if (!profile?.business) {
    return <Navigate to="/dashboard" replace />;
  }

  const labels = [
    t('business.onboarding.firstRental.steps.upload', 'Photos'),
    t('business.onboarding.firstRental.steps.create', 'Rental details'),
    t('business.onboarding.firstRental.steps.location', 'Location & price'),
    t('business.onboarding.firstRental.steps.done', 'Done'),
  ];

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2 }}
      >
        {t('business.onboarding.firstRental.back', 'Back')}
      </Button>
      <Typography variant="h4" gutterBottom>
        {t(
          'business.onboarding.firstRental.title',
          'Add your first rental'
        )}
      </Typography>
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
        {labels.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Paper sx={{ p: 3 }}>
        {step === 0 && (
          <FirstRentalItemUploadStep
            onComplete={(ids, primaryFile) => {
              setPrimaryImagePreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return URL.createObjectURL(primaryFile);
              });
              setImageIds(ids);
              setStep(1);
            }}
          />
        )}
        {step === 1 && (
          <FirstRentalItemCreateStep
            imageIds={imageIds}
            primaryImagePreviewUrl={primaryImagePreviewUrl}
            onComplete={(s) => {
              setItem(s);
              setStep(2);
            }}
          />
        )}
        {step === 2 && item && (
          <FirstRentalItemLocationStep
            item={item}
            onComplete={() => setStep(3)}
          />
        )}
        {step === 3 && item && <FirstRentalItemSuccessStep item={item} />}
      </Paper>
    </Container>
  );
};

export default FirstRentalItemFlow;
