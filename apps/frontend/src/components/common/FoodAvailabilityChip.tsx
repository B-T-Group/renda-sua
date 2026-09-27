import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Chip from '@mui/material/Chip';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodAvailability } from '../../types/food';
import { isFoodServingNow } from '../../utils/foodAvailability';

interface FoodAvailabilityChipProps {
  availability?: FoodAvailability | null;
  size?: 'small' | 'medium';
}

/**
 * "Serving now" for a dish. Hidden unless the restaurant is inside a
 * scheduled serving window, so closed and sold-out rows stay quiet.
 */
const FoodAvailabilityChip: React.FC<FoodAvailabilityChipProps> = ({
  availability,
  size = 'small',
}) => {
  const { t } = useTranslation();
  if (!isFoodServingNow(availability)) return null;

  return (
    <Chip
      size={size}
      color="success"
      variant="outlined"
      icon={<CheckCircleIcon />}
      label={t('foods.status.openNow', 'Serving now')}
    />
  );
};

export default FoodAvailabilityChip;
