import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemCondition } from '../../../types/itemRejectionRecovery';
import { validateWearNote } from '../../../utils/itemRejectionRecovery';

type Props = {
  open: boolean;
  initialCondition: ItemCondition;
  initialWearNote?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (condition: ItemCondition, wearNote: string) => Promise<void>;
};

export function ChangeConditionDialog({
  open,
  initialCondition,
  initialWearNote,
  saving,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [condition, setCondition] = useState<ItemCondition>(initialCondition);
  const [wearNote, setWearNote] = useState(initialWearNote ?? '');
  const validation = validateWearNote(condition, wearNote);

  const handleSave = async () => {
    if (!validation.valid) return;
    await onSave(condition, wearNote.trim());
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('business.items.recovery.action.condition', 'Change condition')}
      </DialogTitle>
      <DialogContent>
        <FormControl sx={{ mt: 1 }}>
          <RadioGroup
            value={condition}
            onChange={(event) =>
              setCondition(event.target.value as ItemCondition)
            }
          >
            <FormControlLabel
              value="new"
              control={<Radio />}
              label={t('business.items.recovery.condition.new', 'New')}
            />
            <FormControlLabel
              value="used"
              control={<Radio />}
              label={t('business.items.recovery.condition.used', 'Used')}
            />
            <FormControlLabel
              value="refurbished"
              control={<Radio />}
              label={t('business.items.recovery.condition.refurb', 'Refurbished')}
            />
          </RadioGroup>
        </FormControl>
        {condition !== 'new' ? (
          <TextField
            fullWidth
            multiline
            minRows={3}
            sx={{ mt: 2 }}
            value={wearNote}
            onChange={(event) => setWearNote(event.target.value)}
            label={t(
              'business.items.recovery.condition.wearNote',
              'Describe the wear'
            )}
            error={!validation.valid && wearNote.length > 0}
            helperText={
              validation.valid
                ? null
                : t(validation.errorKey ?? '', validation.defaultMessage ?? '')
            }
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button
          variant="contained"
          disabled={!validation.valid || saving}
          onClick={() => void handleSave()}
        >
          {t('business.items.recovery.condition.save', 'Save condition')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
