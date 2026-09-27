import { useTranslation } from 'react-i18next';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import type { FoodAvailability } from '../../types/food';
import { isFoodServingNow } from '../../utils/foodAvailability';

interface FoodAvailabilityChipProps {
  availability?: FoodAvailability | null;
}

/**
 * "Serving now" for a dish. Hidden unless the restaurant is inside a
 * scheduled serving window, so closed and sold-out rows stay quiet.
 */
export function FoodAvailabilityChip({ availability }: FoodAvailabilityChipProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!isFoodServingNow(availability)) return null;

  return (
    <StatusPill
      label={t('foods.status.openNow', 'Serving now')}
      backgroundColor={colors.success.light + '30'}
      textColor={colors.success.dark}
      icon="check-circle-outline"
      compact
    />
  );
}
