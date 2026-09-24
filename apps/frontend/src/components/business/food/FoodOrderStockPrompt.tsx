import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FoodConfirmationStockUpdate } from '../../../types/food';

export interface FoodOrderLine {
  order_item_id: string;
  name: string;
  quantity: number;
}

interface FoodOrderStockPromptProps {
  lines: FoodOrderLine[];
  updates: Record<string, FoodConfirmationStockUpdate>;
  onChange: (updates: Record<string, FoodConfirmationStockUpdate>) => void;
  disabled?: boolean;
}

/**
 * Optional sold-out flag while confirming a food order. Stock counts are not
 * tracked for cooked food; merchants mark a dish unavailable for the day.
 */
const FoodOrderStockPrompt: React.FC<FoodOrderStockPromptProps> = ({
  lines,
  updates,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  if (lines.length === 0) return null;

  const patch = (
    orderItemId: string,
    change: Partial<FoodConfirmationStockUpdate>
  ) => {
    const next = { ...updates };
    const current = next[orderItemId] ?? { order_item_id: orderItemId };
    const merged = { ...current, ...change };
    if (merged.last_one !== true) delete next[orderItemId];
    else next[orderItemId] = { order_item_id: orderItemId, last_one: true };
    onChange(next);
  };

  return (
    <Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2">
        {t('business.food.soldOutTitle', 'Still serving these dishes?')}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        {t(
          'business.food.soldOutHelp',
          'Optional. Mark a dish sold out for the rest of today when this was the last order.'
        )}
      </Typography>

      <Stack spacing={1.5}>
        {lines.map((line) => {
          const lastOne = updates[line.order_item_id]?.last_one === true;
          return (
            <Box key={line.order_item_id}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {line.name}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={lastOne}
                    onChange={(event) =>
                      patch(line.order_item_id, {
                        last_one: event.target.checked || undefined,
                      })
                    }
                    disabled={disabled}
                  />
                }
                label={t('business.food.lastOne', 'This was the last one')}
              />
              {lastOne && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {t(
                    'business.food.lastOneHelp',
                    'Marks the dish sold out for the rest of today.'
                  )}
                </Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

export default FoodOrderStockPrompt;
