import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart';
import Chip from '@mui/material/Chip';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodAvailability } from '../../types/food';
import {
  formatNextOpening,
  resolveFoodAvailabilityStatus,
} from '../../utils/foodAvailability';

interface FoodAvailabilityChipProps {
  availability?: FoodAvailability | null;
  size?: 'small' | 'medium';
}

/**
 * Serving status for a dish. Renders nothing for items that are not cooked
 * food, or for dishes on the menu at all times, so the chip only appears when
 * it tells the shopper something.
 */
const FoodAvailabilityChip: React.FC<FoodAvailabilityChipProps> = ({
  availability,
  size = 'small',
}) => {
  const { t, i18n } = useTranslation();
  const status = resolveFoodAvailabilityStatus(availability);

  if (!status) return null;
  if (status === 'available' && !availability?.has_schedule) return null;

  if (status === 'sold_out') {
    return (
      <Chip
        size={size}
        color="default"
        variant="outlined"
        icon={<RemoveShoppingCartIcon />}
        label={t('foods.status.soldOutToday', 'Sold out today')}
      />
    );
  }

  if (status === 'closed') {
    const nextOpening = formatNextOpening(
      availability?.next_opening_at,
      availability?.timezone,
      i18n.language
    );
    return (
      <Chip
        size={size}
        color="warning"
        variant="outlined"
        icon={<AccessTimeIcon />}
        label={
          nextOpening
            ? t('foods.status.opensAt', 'Opens {{when}}', { when: nextOpening })
            : t('foods.status.closed', 'Not being served now')
        }
      />
    );
  }

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
