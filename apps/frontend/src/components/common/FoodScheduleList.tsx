import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodAvailabilitySlot } from '../../types/food';
import {
  formatSlotRange,
  groupFoodSlotsByDay,
  weekdayInTimezone,
} from '../../utils/foodAvailability';
import { useFoodWeekdayNames } from '../../hooks/useFoodWeekdayNames';

interface FoodScheduleListProps {
  slots: FoodAvailabilitySlot[];
  timezone?: string;
}

/** Read-only weekly serving hours. Collapsed to today until opened. */
const FoodScheduleList: React.FC<FoodScheduleListProps> = ({
  slots,
  timezone,
}) => {
  const { t } = useTranslation();
  const weekdayNames = useFoodWeekdayNames();
  const [open, setOpen] = useState(false);
  const byDay = groupFoodSlotsByDay(slots);

  if (byDay.size === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('foods.schedule.alwaysAvailable', 'Available at any time')}
      </Typography>
    );
  }

  const today = weekdayInTimezone(timezone);
  const days = open ? [...byDay.keys()] : [today];

  return (
    <Box sx={{ display: 'grid', gap: 0.75 }}>
      <ScheduleToggle open={open} onToggle={() => setOpen((value) => !value)} />
      {days.map((day) => (
        <DayHours
          key={day}
          name={weekdayNames[day] ?? ''}
          ranges={rangesForDay(byDay.get(day)) ?? t('foods.schedule.closedToday', 'Closed')}
          emphasize={day === today}
        />
      ))}
    </Box>
  );
};

function rangesForDay(slots: FoodAvailabilitySlot[] | undefined): string | null {
  if (!slots?.length) return null;
  return slots.map(formatSlotRange).join(', ');
}

function ScheduleToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const label = t('foods.schedule.title', 'Serving hours');
  return (
    <ButtonBase
      onClick={onToggle}
      aria-expanded={open}
      aria-label={label}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        borderRadius: 1,
        py: 0.25,
      }}
    >
      <Typography variant="subtitle2">{label}</Typography>
      {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
    </ButtonBase>
  );
}

function DayHours({
  name,
  ranges,
  emphasize,
}: {
  name: string;
  ranges: string;
  emphasize: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: emphasize ? 700 : 500 }}>
        {name}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {ranges}
      </Typography>
    </Box>
  );
}

export default FoodScheduleList;
