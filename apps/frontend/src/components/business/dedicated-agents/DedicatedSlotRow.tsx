import React, { useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tooltip,
  Typography,
  Button,
} from '@mui/material';
import {
  WbTwilight as MorningIcon,
  WbSunny as AfternoonIcon,
  NightsStay as EveningIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { PickupSlot, SlotKey } from '../../../types/dedicatedAgents';

interface DedicatedSlotRowProps {
  slot: PickupSlot;
  onToggle: (slotKey: SlotKey, enabled: boolean) => Promise<void>;
  onPickupTimeChange: (slotKey: SlotKey, pickupTime: string) => void;
  disabled?: boolean;
}

const SlotIcon: React.FC<{ slotKey: SlotKey }> = ({ slotKey }) => {
  switch (slotKey) {
    case 'morning':
      return <MorningIcon />;
    case 'afternoon':
      return <AfternoonIcon />;
    case 'evening':
      return <EveningIcon />;
  }
};

const DedicatedSlotRow: React.FC<DedicatedSlotRowProps> = ({
  slot,
  onToggle,
  onPickupTimeChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [agentsToPause, setAgentsToPause] = useState(0);
  const [toggling, setToggling] = useState(false);

  const slotLabel = t(`dedicatedAgents.slots.${slot.slotKey}`, slot.slotKey);

  const generateTimeOptions = () => {
    const options: string[] = [];
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    for (let min = startMinutes; min < endMinutes; min += 15) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    
    return options;
  };

  const handleToggle = async (checked: boolean) => {
    if (disabled || toggling) return;

    if (!checked && slot.liveAgents > 0) {
      setAgentsToPause(slot.liveAgents);
      setConfirmDisable(true);
      return;
    }

    setToggling(true);
    try {
      await onToggle(slot.slotKey, checked);
    } catch (error: any) {
      const agentsToPauseCount = error?.response?.data?.agentsToPause;
      if (agentsToPauseCount) {
        setAgentsToPause(agentsToPauseCount);
        setConfirmDisable(true);
      }
    } finally {
      setToggling(false);
    }
  };

  const handleConfirmDisable = async () => {
    setConfirmDisable(false);
    setToggling(true);
    try {
      await onToggle(slot.slotKey, false);
    } finally {
      setToggling(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flex={1}>
          <SlotIcon slotKey={slot.slotKey} />
          <Stack spacing={0.25}>
            <Typography variant="body1" fontWeight={600}>
              {slotLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {slot.startTime}–{slot.endTime}
            </Typography>
          </Stack>

          {slot.isEnabled && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ScheduleIcon fontSize="small" color="action" />
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={slot.pickupTime}
                  onChange={(e) => onPickupTimeChange(slot.slotKey, e.target.value)}
                  sx={{ fontSize: '0.875rem' }}
                >
                  {generateTimeOptions().map((time) => (
                    <MenuItem key={time} value={time}>
                      {time}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </Stack>

        <Switch
          checked={slot.isEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
          disabled={disabled || toggling}
        />
      </Box>

      <Dialog open={confirmDisable} onClose={() => setConfirmDisable(false)}>
        <DialogTitle>
          {t('dedicatedAgents.slots.offConfirm', 'Turn off {{slot}}? {{n}} dedicated agents will be paused.', {
            slot: slotLabel,
            n: agentsToPause,
          })}
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmDisable(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleConfirmDisable} disabled={toggling}>
            {t('common.confirm', 'Confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DedicatedSlotRow;
