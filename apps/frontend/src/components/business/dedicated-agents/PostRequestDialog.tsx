import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import type {
  DayOfWeek,
  DedicatedPostingView,
  PickupSlot,
  SlotKey,
} from '../../../types/dedicatedAgents';

interface PostRequestDialogProps {
  open: boolean;
  locationId: string;
  enabledSlots: PickupSlot[];
  existingPostings: DedicatedPostingView[];
  selectedSlot: SlotKey | null;
  onClose: () => void;
  onSuccess: (postingId: string) => void;
}

const PostRequestDialog: React.FC<PostRequestDialogProps> = ({
  open,
  locationId,
  enabledSlots,
  existingPostings,
  selectedSlot,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const dedicatedApi = useDedicatedAgents();

  const [headcount, setHeadcount] = useState(1);
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>(
    selectedSlot ? [selectedSlot] : []
  );
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5, 6, 7]);
  const [terms, setTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (selectedSlots.length === 0 || selectedDays.length === 0) {
      setError(t('common.required', 'Required'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await dedicatedApi.createPosting(locationId, {
        headcount,
        slotKeys: selectedSlots,
        daysOfWeek: selectedDays,
        terms: terms.trim() || null,
      });

      onSuccess(response.posting.id);
    } catch (err: any) {
      console.error('Error creating posting:', err);
      setError(err.response?.data?.message || t('dedicatedAgents.generic', 'Something went wrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const isSlotDisabled = (slotKey: SlotKey) =>
    existingPostings.some((p) => p.slotKeys.includes(slotKey));

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('dedicatedAgents.post', 'Post a request')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Box>
            <Typography variant="body2" gutterBottom>
              {t('dedicatedAgents.form.agentsNeeded', 'Agents needed')}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                size="small"
                onClick={() => setHeadcount(Math.max(1, headcount - 1))}
                disabled={headcount <= 1}
              >
                <RemoveIcon />
              </IconButton>
              <Typography variant="h6">{headcount}</Typography>
              <IconButton
                size="small"
                onClick={() => setHeadcount(Math.min(10, headcount + 1))}
                disabled={headcount >= 10}
              >
                <AddIcon />
              </IconButton>
            </Stack>
          </Box>

          <Box>
            <Typography variant="body2" gutterBottom>
              Slots
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {enabledSlots.map((slot) => (
                <Chip
                  key={slot.slotKey}
                  label={t(`dedicatedAgents.slots.${slot.slotKey}`, slot.slotKey)}
                  onClick={() => {
                    if (!isSlotDisabled(slot.slotKey)) {
                      setSelectedSlots((prev) =>
                        prev.includes(slot.slotKey)
                          ? prev.filter((s) => s !== slot.slotKey)
                          : [...prev, slot.slotKey]
                      );
                    }
                  }}
                  color={selectedSlots.includes(slot.slotKey) ? 'primary' : 'default'}
                  disabled={isSlotDisabled(slot.slotKey)}
                />
              ))}
            </Stack>
            {enabledSlots.some((s) => isSlotDisabled(s.slotKey)) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('dedicatedAgents.form.alreadyPosted', 'Already posted')}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="body2" gutterBottom>
              {t('dedicatedAgents.form.days', 'Days')}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {([1, 2, 3, 4, 5, 6, 7] as DayOfWeek[]).map((day, idx) => (
                <Chip
                  key={day}
                  label={dayLabels[idx]}
                  size="small"
                  onClick={() => {
                    setSelectedDays((prev) =>
                      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                    );
                  }}
                  color={selectedDays.includes(day) ? 'primary' : 'default'}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="body2" gutterBottom>
              {t('dedicatedAgents.form.payLine', 'Standard delivery pay')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              (fixed)
            </Typography>
          </Box>

          <TextField
            label={t('dedicatedAgents.form.termsField', 'Terms / notes')}
            multiline
            rows={4}
            value={terms}
            onChange={(e) => setTerms(e.target.value.slice(0, 1000))}
            helperText={`${terms.length}/1000 · ${t(
              'dedicatedAgents.form.termsHelper',
              'Hours, dress code, what to expect.'
            )}`}
            fullWidth
          />

          <Typography variant="caption" color="text.secondary">
            {t('dedicatedAgents.form.termsStrip', 'Links and phone numbers are removed.')}
          </Typography>

          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
          {t('dedicatedAgents.form.publish', 'Publish')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PostRequestDialog;
