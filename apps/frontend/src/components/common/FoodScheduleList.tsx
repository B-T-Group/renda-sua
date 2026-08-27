import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodAvailabilitySlot } from '../../types/food';
import { formatSlotRange, groupFoodSlotsByDay } from '../../utils/foodAvailability';
import { useFoodWeekdayNames } from '../../hooks/useFoodWeekdayNames';

interface FoodScheduleListProps {
  slots: FoodAvailabilitySlot[];
  highlightDayOfWeek?: number;
}

/** Read-only weekly serving hours for a dish. */
const FoodScheduleList: React.FC<FoodScheduleListProps> = ({
  slots,
  highlightDayOfWeek,
}) => {
  const { t } = useTranslation();
  const weekdayNames = useFoodWeekdayNames();
  const byDay = groupFoodSlotsByDay(slots);

  if (byDay.size === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('foods.schedule.alwaysAvailable', 'Available at any time')}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      {[...byDay.entries()].map(([day, daySlots]) => (
        <Box
          key={day}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: day === highlightDayOfWeek ? 700 : 500 }}
          >
            {weekdayNames[day]}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {daySlots.map(formatSlotRange).join(', ')}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default FoodScheduleList;
