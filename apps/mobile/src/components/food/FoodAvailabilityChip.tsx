import { useTranslation } from 'react-i18next';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import type { FoodAvailability } from '../../types/food';
import {
  formatNextOpening,
  resolveFoodAvailabilityStatus,
} from '../../utils/foodAvailability';

interface FoodAvailabilityChipProps {
  availability?: FoodAvailability | null;
}

/**
 * Serving status for a dish. Hidden for non-food rows and for dishes that
 * stay on the menu at all times.
 */
export function FoodAvailabilityChip({ availability }: FoodAvailabilityChipProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const status = resolveFoodAvailabilityStatus(availability);

  if (!status) return null;
  if (status === 'available' && !availability?.has_schedule) return null;

  if (status === 'sold_out') {
    return (
      <StatusPill
        label={t('foods.status.soldOutToday', 'Sold out today')}
        backgroundColor={colors.error.light + '30'}
        textColor={colors.error.dark}
        icon="cart-off"
        compact
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
      <StatusPill
        label={
          nextOpening
            ? t('foods.status.opensAt', 'Opens {{when}}', { when: nextOpening })
            : t('foods.status.closed', 'Not being served now')
        }
        backgroundColor={colors.warning.light + '30'}
        textColor={colors.warning.dark}
        icon="clock-outline"
        compact
      />
    );
  }

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
