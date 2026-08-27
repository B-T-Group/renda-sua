import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceHoursEditor } from '../../admin/ServiceHoursEditor';
import type { FoodAvailabilitySlot } from '../../../types/food';
import {
  editorValueToFoodSlots,
  foodSlotsHaveMultipleWindowsPerDay,
  foodSlotsToEditorValue,
} from '../../../utils/foodHoursEditor';

interface FoodAvailabilityEditorProps {
  slots: FoodAvailabilitySlot[];
  onChange: (slots: FoodAvailabilitySlot[]) => void;
  disabled?: boolean;
}

/**
 * Weekly serving hours using the same day/time control as location hours.
 * Every day off keeps the dish on the menu at all times.
 */
const FoodAvailabilityEditor: React.FC<FoodAvailabilityEditorProps> = ({
  slots,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <Box>
      <ServiceHoursEditor
        value={foodSlotsToEditorValue(slots)}
        onChange={(value) => onChange(editorValueToFoodSlots(value))}
        disabled={disabled}
        title={t('business.food.servingHours', 'Serving hours')}
        description={t(
          'business.food.servingHoursHelp',
          'Set the times this dish is served. Leave every day empty to keep it on the menu at all times.'
        )}
        offDayLabel={t('business.food.notAvailable', 'Not available')}
      />
      {foodSlotsHaveMultipleWindowsPerDay(slots) ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t(
            'business.food.extraWindowsWillBeDropped',
            'This dish had more than one serving window on some days. Saving keeps one window per day.'
          )}
        </Alert>
      ) : null}
      {slots.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t(
            'business.food.noHoursSet',
            'No hours set, so this dish can be ordered at any time.'
          )}
        </Alert>
      )}
    </Box>
  );
};

export default FoodAvailabilityEditor;
