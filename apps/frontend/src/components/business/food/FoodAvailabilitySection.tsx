import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFoodSettings } from '../../../hooks/useFoodSettings';
import type { FoodAvailabilitySlot, FoodSettings } from '../../../types/food';
import FoodAvailabilityEditor from './FoodAvailabilityEditor';

interface FoodAvailabilitySectionProps {
  itemId: string;
  businessLocationId: string;
}

/**
 * Loads and saves the serving schedule for one dish at one location, plus the
 * sold-out-for-today switch. Self-contained so any dialog can drop it in.
 */
const FoodAvailabilitySection: React.FC<FoodAvailabilitySectionProps> = ({
  itemId,
  businessLocationId,
}) => {
  const { t } = useTranslation();
  const { loading, saving, error, fetchSettings, saveSlots, setAvailableToday } =
    useFoodSettings();
  const [settings, setSettings] = useState<FoodSettings | null>(null);
  const [slots, setSlots] = useState<FoodAvailabilitySlot[]>([]);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (!itemId || !businessLocationId) return;
    void (async () => {
      const loaded = await fetchSettings(itemId, businessLocationId);
      if (!active || !loaded) return;
      setSettings(loaded);
      setSlots(loaded.slots);
      setDirty(false);
    })();
    return () => {
      active = false;
    };
  }, [itemId, businessLocationId, fetchSettings]);

  const handleSlotsChange = useCallback((next: FoodAvailabilitySlot[]) => {
    setSlots(next);
    setDirty(true);
    setSavedAt(null);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const updated = await saveSlots(itemId, businessLocationId, slots);
      setSettings(updated);
      setSlots(updated.slots);
      setDirty(false);
      setSavedAt(Date.now());
    } catch {
      // useFoodSettings surfaces the message through `error`.
    }
  }, [businessLocationId, itemId, saveSlots, slots]);

  const handleAvailableToggle = useCallback(
    async (available: boolean) => {
      try {
        const updated = await setAvailableToday(
          itemId,
          businessLocationId,
          available
        );
        setSettings(updated);
      } catch {
        // useFoodSettings surfaces the message through `error`.
      }
    },
    [businessLocationId, itemId, setAvailableToday]
  );

  if (loading && !settings) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  const soldOutToday = Boolean(settings?.marked_unavailable_at) &&
    settings?.is_available_now === false;

  return (
    <Box>
      <Divider sx={{ mb: 2 }} />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={!soldOutToday}
            onChange={(_event, checked) => void handleAvailableToggle(checked)}
            disabled={saving}
          />
        }
        label={
          soldOutToday
            ? t('business.food.soldOutToday', 'Sold out for today')
            : t('business.food.onTheMenu', 'On the menu today')
        }
      />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        {t(
          'business.food.soldOutHelp',
          'Turning this off hides the dish for the rest of the day. It comes back automatically the next day you serve it.'
        )}
      </Typography>

      <FoodAvailabilityEditor
        slots={slots}
        onChange={handleSlotsChange}
        disabled={saving}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
        <Button
          variant="outlined"
          onClick={() => void handleSave()}
          disabled={!dirty || saving}
        >
          {saving
            ? t('common.saving', 'Saving...')
            : t('business.food.saveHours', 'Save serving hours')}
        </Button>
        {savedAt && !dirty && (
          <Typography variant="body2" color="success.main">
            {t('business.food.hoursSaved', 'Serving hours saved')}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default FoodAvailabilitySection;
