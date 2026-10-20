import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Stack,
  Avatar,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import type {
  AdminAgentPickerItem,
  AdminLocationSearchItem,
  SlotKey,
} from '../../../types/dedicatedAgents';

interface AdminDedicatedAssignDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AdminDedicatedAssignDialog: React.FC<AdminDedicatedAssignDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const dedicatedApi = useDedicatedAgents();

  const [activeStep, setActiveStep] = useState(0);
  const [locationQuery, setLocationQuery] = useState('');
  const [locations, setLocations] = useState<AdminLocationSearchItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<AdminLocationSearchItem | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>([]);
  const [agents, setAgents] = useState<AdminAgentPickerItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AdminAgentPickerItem | null>(null);
  const [agentFilter, setAgentFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = ['Store', 'Slots', 'Agent'];

  useEffect(() => {
    if (!open) {
      setActiveStep(0);
      setLocationQuery('');
      setLocations([]);
      setSelectedLocation(null);
      setSelectedSlots([]);
      setAgents([]);
      setSelectedAgent(null);
      setAgentFilter('');
      setError(null);
    }
  }, [open]);

  const searchLocations = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setLocations([]);
        return;
      }

      try {
        setLoading(true);
        const response = await dedicatedApi.getAdminLocations(query);
        setLocations(response.locations);
      } catch (err: any) {
        console.error('Error searching locations:', err);
        setError(t('dedicatedAgents.generic', 'Something went wrong'));
      } finally {
        setLoading(false);
      }
    },
    [dedicatedApi, t]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (locationQuery) {
        searchLocations(locationQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [locationQuery, searchLocations]);

  useEffect(() => {
    if (selectedLocation && activeStep === 2) {
      loadAgents();
    }
  }, [selectedLocation, activeStep]);

  const loadAgents = async () => {
    if (!selectedLocation) return;

    try {
      setLoading(true);
      const response = await dedicatedApi.getAdminAgentPicker(selectedLocation.id);
      setAgents(response.agents);
    } catch (err: any) {
      console.error('Error loading agents:', err);
      setError(t('dedicatedAgents.generic', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setError(null);
    if (activeStep === 0 && !selectedLocation) {
      setError(t('common.required', 'Required'));
      return;
    }
    if (activeStep === 1 && selectedSlots.length === 0) {
      setError(t('common.required', 'Required'));
      return;
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!selectedLocation || !selectedAgent || selectedSlots.length === 0) {
      setError(t('common.required', 'Required'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await dedicatedApi.createAdminAssignment({
        locationId: selectedLocation.id,
        agentId: selectedAgent.id,
        slotKeys: selectedSlots,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating assignment:', err);
      setError(err.response?.data?.message || t('dedicatedAgents.generic', 'Something went wrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAgents = agents.filter(
    (agent) =>
      !agentFilter ||
      `${agent.firstName} ${agent.lastName}`
        .toLowerCase()
        .includes(agentFilter.toLowerCase())
  );

  const allSlots: SlotKey[] = ['morning', 'afternoon', 'evening'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('dedicatedAgents.admin.assign', 'Assign')}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel>{t(`dedicatedAgents.admin.steps.${label.toLowerCase()}`, label)}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Stack spacing={2}>
              <TextField
                label="Search store / city"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                autoFocus
                fullWidth
              />

              {loading && (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              )}

              <Stack spacing={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
                {locations.map((loc) => (
                  <Box
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc)}
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: selectedLocation?.id === loc.id ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: selectedLocation?.id === loc.id ? 'action.selected' : 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography variant="body1" fontWeight={600}>
                      {loc.businessName} · {loc.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {loc.address.city}, {loc.address.state}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          )}

          {activeStep === 1 && (
            <Stack spacing={2}>
              <Typography variant="body2">Select one or more slots</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {allSlots.map((slot) => (
                  <Chip
                    key={slot}
                    label={t(`dedicatedAgents.slots.${slot}`, slot)}
                    onClick={() => {
                      setSelectedSlots((prev) =>
                        prev.includes(slot)
                          ? prev.filter((s) => s !== slot)
                          : [...prev, slot]
                      );
                    }}
                    color={selectedSlots.includes(slot) ? 'primary' : 'default'}
                  />
                ))}
              </Stack>
            </Stack>
          )}

          {activeStep === 2 && (
            <Stack spacing={2}>
              <TextField
                label="Filter agents"
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                size="small"
                fullWidth
              />

              {loading && (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              )}

              <Stack spacing={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
                {filteredAgents.map((agent) => (
                  <Box
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    sx={{
                      p: 2,
                      border: 1,
                      borderColor: selectedAgent?.id === agent.id ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: selectedAgent?.id === agent.id ? 'action.selected' : 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' },
                      opacity: agent.assignmentCount >= 3 ? 0.5 : 1,
                    }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar src={agent.photoUrl || undefined}>
                        {agent.firstName[0]}
                      </Avatar>
                      <Stack flex={1}>
                        <Typography variant="body1" fontWeight={600}>
                          {agent.firstName} {agent.lastName}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={agent.isInternal ? 'Internal' : 'Independent'}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption">
                            📦 {agent.activeOrders} · 🏪 {agent.assignmentCount}/3
                            {!agent.isInternal && agent.balanceCoversOrders !== null && (
                              <> · 💰 ~{agent.balanceCoversOrders}</>
                            )}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Stack>
          )}

          {error && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel', 'Cancel')}
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={submitting}>
            {t('common.back', 'Back')}
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} variant="contained">
            {t('common.next', 'Next')}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!selectedAgent || submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {t('dedicatedAgents.admin.assign', 'Assign')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AdminDedicatedAssignDialog;
