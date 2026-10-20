import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
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
import { useNavigate } from 'react-router-dom';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import { useDedicatedAgentsAnalytics } from '../../../hooks/useDedicatedAgentsAnalytics';
import {
  extractDedicatedAgentsError,
  mapDedicatedAgentsErrorCode,
} from '../../../utils/dedicatedAgentsErrors';
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
  onSuccess: () => void;
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dedicatedApi = useDedicatedAgents();
  const { track } = useDedicatedAgentsAnalytics();

  const [headcount, setHeadcount] = useState(1);
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>(
    selectedSlot ? [selectedSlot] : []
  );
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5, 6, 7]);
  const [terms, setTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setHeadcount(1);
      setSelectedSlots(selectedSlot ? [selectedSlot] : []);
      setSelectedDays([1, 2, 3, 4, 5, 6, 7]);
      setTerms('');
      setError(null);
      setFieldErrors({});
      
      track('posting_form_opened', {
        role: 'business',
        locationId,
      });
    }
  }, [open, selectedSlot, locationId, track]);

  const handleSubmit = async () => {
    setFieldErrors({});
    setError(null);

    if (selectedSlots.length === 0) {
      setFieldErrors({ slots: t('dedicatedAgents.errors.invalid_slot_keys', 'Please select at least one slot') });
      return;
    }

    if (selectedDays.length === 0) {
      setFieldErrors({ days: t('dedicatedAgents.errors.invalid_days_of_week', 'Please select at least one day') });
      return;
    }

    if (headcount < 1 || headcount > 10) {
      setFieldErrors({ headcount: t('dedicatedAgents.errors.invalid_headcount', 'Headcount must be between 1 and 10') });
      return;
    }

    try {
      setSubmitting(true);

      const response = await dedicatedApi.createPosting(locationId, {
        headcount,
        slotKeys: selectedSlots,
        daysOfWeek: selectedDays,
        terms: terms.trim() || null,
      });

      track('posting_created', {
        role: 'business',
        locationId,
        headcount,
        slots: selectedSlots.length,
        days: selectedDays.length,
        termsLength: terms.trim().length,
      });

      onSuccess();
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);

      if (code === 'posting_already_open') {
        const existingPostingId = err.response?.data?.posting?.id;
        if (existingPostingId) {
          navigate(`/business/locations/${locationId}/dedicated-agents/postings/${existingPostingId}`);
          onClose();
          return;
        }
      }

      if (code === 'invalid_headcount') {
        setFieldErrors({ headcount: t(mapDedicatedAgentsErrorCode(code), 'Headcount must be between 1 and 10') });
      } else if (code === 'invalid_slot_keys') {
        setFieldErrors({ slots: t(mapDedicatedAgentsErrorCode(code), 'Please select at least one slot') });
      } else if (code === 'invalid_days_of_week') {
        setFieldErrors({ days: t(mapDedicatedAgentsErrorCode(code), 'Please select at least one day') });
      } else if (code === 'terms_too_long') {
        setFieldErrors({ terms: t(mapDedicatedAgentsErrorCode(code), 'Terms must be 1000 characters or less') });
      } else if (code === 'slot_disabled') {
        setFieldErrors({ slots: t(mapDedicatedAgentsErrorCode(code), 'Turn slot back on first') });
      } else {
        const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
        setError(t(errorKey, 'Something went wrong'));
      }

      track('action_conflict', {
        role: 'business',
        endpoint: 'createPosting',
        code: code || 'unknown',
      });

      console.error('Error creating posting:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const isSlotDisabled = (slotKey: SlotKey) =>
    existingPostings.some((p) => p.slotKeys.includes(slotKey));

  const dayLabels = i18n.language === 'fr' 
    ? ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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
                disabled={headcount <= 1 || submitting}
              >
                <RemoveIcon />
              </IconButton>
              <Typography variant="h6">{headcount}</Typography>
              <IconButton
                size="small"
                onClick={() => setHeadcount(Math.min(10, headcount + 1))}
                disabled={headcount >= 10 || submitting}
              >
                <AddIcon />
              </IconButton>
            </Stack>
            {fieldErrors.headcount && (
              <FormHelperText error>{fieldErrors.headcount}</FormHelperText>
            )}
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
                    if (!isSlotDisabled(slot.slotKey) && !submitting) {
                      setSelectedSlots((prev) =>
                        prev.includes(slot.slotKey)
                          ? prev.filter((s) => s !== slot.slotKey)
                          : [...prev, slot.slotKey]
                      );
                    }
                  }}
                  color={selectedSlots.includes(slot.slotKey) ? 'primary' : 'default'}
                  disabled={isSlotDisabled(slot.slotKey) || submitting}
                />
              ))}
            </Stack>
            {enabledSlots.some((s) => isSlotDisabled(s.slotKey)) && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {t('dedicatedAgents.form.alreadyPosted', 'Already posted')}
              </Typography>
            )}
            {fieldErrors.slots && (
              <FormHelperText error>{fieldErrors.slots}</FormHelperText>
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
                    if (!submitting) {
                      setSelectedDays((prev) =>
                        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                      );
                    }
                  }}
                  color={selectedDays.includes(day) ? 'primary' : 'default'}
                  disabled={submitting}
                />
              ))}
            </Stack>
            {fieldErrors.days && (
              <FormHelperText error>{fieldErrors.days}</FormHelperText>
            )}
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
            helperText={fieldErrors.terms || `${terms.length}/1000 · ${t(
              'dedicatedAgents.form.termsHelper',
              'Hours, dress code, what to expect.'
            )}`}
            error={!!fieldErrors.terms}
            disabled={submitting}
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
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          {t('dedicatedAgents.form.publish', 'Publish')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PostRequestDialog;
