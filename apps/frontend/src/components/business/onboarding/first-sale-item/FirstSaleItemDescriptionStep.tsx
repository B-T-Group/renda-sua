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
  price: string;
  currency: string;
  onChange: (hint: string) => void;
  onPriceChange: (price: string) => void;
  onContinue: () => void;
}

function isValidPrice(price: string): boolean {
  const n = Number.parseFloat(price.replace(',', '.'));
  return price.trim().length > 0 && !Number.isNaN(n) && n > 0;
}

const FirstSaleItemDescriptionStep: React.FC<
  FirstSaleItemDescriptionStepProps
> = ({ hint, price, currency, onChange, onPriceChange, onContinue }) => {
  const { t } = useTranslation();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [phKey, phDefault] = PLACEHOLDERS[placeholderIndex];
  const priceOk = isValidPrice(price);
  const canContinue = hint.trim().length > 0 && priceOk;

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
          'Add a short name and the selling price. We’ll fill the rest — you only review next.'
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
          'business.onboarding.firstSale.description.productLabel',
          'Product'
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canContinue) onContinue();
        }}
      />
      <TextField
        fullWidth
        required
        value={price}
        onChange={(e) => onPriceChange(e.target.value)}
        label={t('business.onboarding.firstSale.create.price', 'Price')}
        placeholder={t(
          'business.onboarding.firstSale.create.priceHelper',
          'e.g. 5000'
        )}
        type="number"
        inputProps={{ min: 0, step: 'any', inputMode: 'decimal' }}
        InputProps={{ endAdornment: currency }}
        error={price.trim().length > 0 && !priceOk}
        helperText={
          price.trim().length > 0 && !priceOk
            ? t(
                'business.onboarding.firstSale.create.priceInvalid',
                'Must be a positive number'
              )
            : t(
                'business.onboarding.firstSale.description.priceHint',
                'This is the price customers will see. You can still edit it later.'
              )
        }
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
