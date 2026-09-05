import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFoodSettings } from '../../../hooks/useFoodSettings';

interface FoodSoldOutToggleProps {
  itemId: string;
  businessLocationId: string;
  /** Sold out for today when true. */
  initialSoldOut: boolean;
}

/**
 * One tap to take a dish off today's menu, for a kitchen mid-service. Lives on
 * the item card so it does not need a dialog.
 */
const FoodSoldOutToggle: React.FC<FoodSoldOutToggleProps> = ({
  itemId,
  businessLocationId,
  initialSoldOut,
}) => {
  const { t } = useTranslation();
  const { setAvailableToday, saving } = useFoodSettings();
  const [soldOut, setSoldOut] = useState(initialSoldOut);

  const handleChange = useCallback(
    async (available: boolean) => {
      const previous = soldOut;
      setSoldOut(!available);
      try {
        await setAvailableToday(itemId, businessLocationId, available);
      } catch {
        setSoldOut(previous);
      }
    },
    [businessLocationId, itemId, setAvailableToday, soldOut]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        flex: '1 1 45%',
        minWidth: 140,
      }}
    >
      <Switch
        size="small"
        checked={!soldOut}
        disabled={saving}
        onChange={(_event, checked) => void handleChange(checked)}
      />
      <Typography variant="caption">
        {soldOut
          ? t('business.food.soldOutToday', 'Sold out for today')
          : t('business.food.onTheMenu', 'On the menu today')}
      </Typography>
    </Box>
  );
};

export default FoodSoldOutToggle;
