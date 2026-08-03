import { Button, Stack, TextField, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const PLACEHOLDERS = [
  ['business.onboarding.firstSale.hint.example1', 'Coca-Cola Zero 1.5L'],
  ['business.onboarding.firstSale.hint.example2', 'Fresh tomatoes'],
  ['business.onboarding.firstSale.hint.example3', "Women's leather handbag"],
  ['business.onboarding.firstSale.hint.example4', 'Samsung Galaxy A35'],
] as const;

export interface FirstSaleItemDescriptionStepProps {
  hint: string;
  onChange: (hint: string) => void;
  onContinue: () => void;
}

const FirstSaleItemDescriptionStep: React.FC<
  FirstSaleItemDescriptionStepProps
> = ({ hint, onChange, onContinue }) => {
  const { t } = useTranslation();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [phKey, phDefault] = PLACEHOLDERS[placeholderIndex];
  const canContinue = hint.trim().length > 0;

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h6" fontWeight={600}>
        {t(
          'business.onboarding.firstSale.description.title',
          'What did you photograph?'
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.onboarding.firstSale.description.body',
          'A short description helps us fill the listing. You can edit everything on the next screens.'
        )}
      </Typography>
      <TextField
        fullWidth
        required
        autoFocus
        value={hint}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(phKey, phDefault)}
        label={t(
          'business.onboarding.firstSale.description.title',
          'What did you photograph?'
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canContinue) onContinue();
        }}
      />
      <Button
        variant="contained"
        size="large"
        disabled={!canContinue}
        onClick={onContinue}
        sx={{ minHeight: 48 }}
      >
        {t('business.onboarding.firstSale.upload.continue', 'Continue')}
      </Button>
    </Stack>
  );
};

export default FirstSaleItemDescriptionStep;
