import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
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
 * Optional stock correction while confirming a food order. Skipping it leaves
 * stock untouched, so confirming stays a single tap when nothing has changed.
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
    const isEmpty =
      merged.remaining_quantity == null && merged.last_one !== true;
    if (isEmpty) delete next[orderItemId];
    else next[orderItemId] = merged;
    onChange(next);
  };

  return (
    <Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2">
        {t('business.food.remainingTitle', 'How many portions are left?')}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
        {t(
          'business.food.remainingHelp',
          'Optional. Only needed when this order changes what you can still sell today.'
        )}
      </Typography>

      <Stack spacing={1.5}>
        {lines.map((line) => {
          const update = updates[line.order_item_id];
          const lastOne = update?.last_one === true;
          return (
            <Box key={line.order_item_id}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {line.name}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <TextField
                  type="number"
                  size="small"
                  label={t(
                    'business.food.remainingLabel',
                    'Portions left after this order'
                  )}
                  value={update?.remaining_quantity ?? ''}
                  onChange={(event) =>
                    patch(line.order_item_id, {
                      remaining_quantity:
                        event.target.value === ''
                          ? undefined
                          : Math.max(0, parseInt(event.target.value, 10) || 0),
                    })
                  }
                  disabled={disabled || lastOne}
                  inputProps={{ min: 0, step: 1 }}
                  sx={{ maxWidth: 240 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={lastOne}
                      onChange={(event) =>
                        patch(line.order_item_id, {
                          last_one: event.target.checked || undefined,
                          ...(event.target.checked
                            ? { remaining_quantity: undefined }
                            : {}),
                        })
                      }
                      disabled={disabled}
                    />
                  }
                  label={t('business.food.lastOne', 'This was the last one')}
                />
              </Box>
              {lastOne && (
                <Typography variant="caption" color="text.secondary">
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
