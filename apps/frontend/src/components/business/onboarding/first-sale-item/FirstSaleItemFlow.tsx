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
import FirstSaleItemCreateStep, {
  type CreatedSaleItemSummary,
} from './FirstSaleItemCreateStep';
import FirstSaleItemLocationStep from './FirstSaleItemLocationStep';
import FirstSaleItemSuccessStep from './FirstSaleItemSuccessStep';
import FirstSaleItemUploadStep from './FirstSaleItemUploadStep';

const FirstSaleItemFlow: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const [step, setStep] = useState(0);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [primaryImagePreviewUrl, setPrimaryImagePreviewUrl] = useState<
    string | null
  >(null);
  const [item, setItem] = useState<CreatedSaleItemSummary | null>(null);

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
    t('business.onboarding.firstSale.steps.upload', 'Photos'),
    t('business.onboarding.firstSale.steps.create', 'Product details'),
    t('business.onboarding.firstSale.steps.location', 'Location'),
    t('business.onboarding.firstSale.steps.done', 'Done'),
  ];

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Button
        startIcon={<BackIcon />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 2 }}
      >
        {t('business.onboarding.firstSale.back', 'Back')}
      </Button>
      <Typography variant="h4" gutterBottom>
        {t(
          'business.onboarding.firstSale.title',
          'Add your first product'
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
          <FirstSaleItemUploadStep
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
          <FirstSaleItemCreateStep
            imageIds={imageIds}
            primaryImagePreviewUrl={primaryImagePreviewUrl}
            onComplete={(s) => {
              setItem(s);
              setStep(2);
            }}
          />
        )}
        {step === 2 && item && (
          <FirstSaleItemLocationStep
            item={item}
            onComplete={() => setStep(3)}
          />
        )}
        {step === 3 && item && <FirstSaleItemSuccessStep item={item} />}
      </Paper>
    </Container>
  );
};

export default FirstSaleItemFlow;
