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
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import {
  useTrackSiteEvent,
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_STARTED,
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_STEP,
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_SUCCEEDED,
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_FAILED,
} from '../../../hooks/useTrackSiteEvent';
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
  const { enqueueSnackbar } = useSnackbar();
  const dedicatedApi = useDedicatedAgents();
  const { trackSiteEvent } = useTrackSiteEvent();
  const isOnline = useOnlineStatus();

  const [activeStep, setActiveStep] = useState(0);
  const [locationQuery, setLocationQuery] = useState('');
  const [locations, setLocations] = useState<AdminLocationSearchItem[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<AdminLocationSearchItem | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>([]);
  const [agents, setAgents] = useState<AdminAgentPickerItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AdminAgentPickerItem | null>(null);
  const [agentFilter, setAgentFilter] = useState('');
  const [agentsTruncated, setAgentsTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    t('dedicatedAgents.admin.steps.store', 'Store'),
    t('dedicatedAgents.admin.steps.slots', 'Slots'),
    t('dedicatedAgents.admin.steps.agent', 'Agent'),
  ];

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
    } else {
      // Track dialog opened
      void trackSiteEvent({
        eventType: SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_STARTED,
        metadata: { platform: 'web' },
      });
    }
  }, [open, trackSiteEvent]);

  const searchLocations = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setLocations([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await dedicatedApi.getAdminLocations(query);
        setLocations(response.locations);
      } catch (err: any) {
        console.error('Error searching locations:', err);
        const status = err.response?.status;
        if (status === 403) {
          setError(t('dedicatedAgents.errors.geo_scope', 'Outside your admin scope'));
        } else {
          setError(t('dedicatedAgents.generic', 'Something went wrong'));
        }
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
      setError(null);
      const response = await dedicatedApi.getAdminAgentPicker(selectedLocation.id);
      setAgents(response.agents);
      setAgentsTruncated(response.truncated);
    } catch (err: any) {
      console.error('Error loading agents:', err);
      const status = err.response?.status;
      if (status === 403) {
        setError(t('dedicatedAgents.errors.geo_scope', 'Outside your admin scope'));
      } else {
        setError(t('dedicatedAgents.generic', 'Something went wrong'));
      }
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
    const nextStep = activeStep + 1;
    setActiveStep(nextStep);
    
    // Track step progression
    void trackSiteEvent({
      eventType: SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_STEP,
      metadata: { step: nextStep, platform: 'web' },
    });
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const mapErrorToMessage = (err: any): { message: string; step: number | null } => {
    const code = err.response?.data?.code;
    const status = err.response?.status;
    
    // Map error codes from the backend
    if (code === 'slot_disabled') {
      const slotNames = selectedSlots.map(slot => t(`dedicatedAgents.slots.${slot}`, slot)).join(', ');
      return {
        message: t('dedicatedAgents.errors.slot_disabled', 'Turn {{slot}} back on first').replace('{{slot}}', slotNames),
        step: 1
      };
    }
    if (code === 'dedicated_agent_assignment_cap_exceeded' || code === 'cap_exceeded') {
      return {
        message: t('dedicatedAgents.errors.cap_exceeded', 'This agent already has the maximum number of stores'),
        step: 2
      };
    }
    if (code === 'dedicated_agent_assignment_duplicate' || code === 'duplicate') {
      return {
        message: t('dedicatedAgents.errors.duplicate', 'This agent is already assigned to this slot'),
        step: 2
      };
    }
    if (code === 'agent_not_verified') {
      return {
        message: t('dedicatedAgents.errors.agent_not_verified', 'This agent is not verified'),
        step: 2
      };
    }
    if (code === 'agent_suspended') {
      return {
        message: t('dedicatedAgents.errors.agent_suspended', 'This agent is suspended'),
        step: 2
      };
    }
    if (code === 'invalid_slot_keys') {
      return {
        message: t('dedicatedAgents.errors.invalid_slot_keys', 'Invalid slots selected'),
        step: 1
      };
    }
    if (status === 403) {
      return {
        message: t('dedicatedAgents.errors.geo_scope', 'Outside your admin scope'),
        step: 0
      };
    }
    if (status === 404) {
      return {
        message: t('dedicatedAgents.errors.not_found', 'Resource not found'),
        step: 0
      };
    }
    
    return {
      message: t('dedicatedAgents.generic', 'Something went wrong'),
      step: null
    };
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

      enqueueSnackbar(
        t('dedicatedAgents.admin.assigned', 'Assigned. The store and agent were notified.'),
        { variant: 'success' }
      );
      
      // Track success
      void trackSiteEvent({
        eventType: SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_SUCCEEDED,
        metadata: {
          slots: selectedSlots.length,
          isInternal: selectedAgent.isInternal,
          platform: 'web',
          role: 'superuser',
        },
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating assignment:', err);
      const { message, step } = mapErrorToMessage(err);
      setError(message);
      if (step !== null && step !== activeStep) {
        setActiveStep(step);
      }
      
      // Track failure
      void trackSiteEvent({
        eventType: SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_FAILED,
        metadata: {
          code: err.response?.data?.code,
          step: activeStep,
          jumpedToStep: step !== null ? step : undefined,
          platform: 'web',
          role: 'superuser',
        },
      });
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
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Stack spacing={2}>
              <TextField
                label={t('dedicatedAgents.admin.searchStoreCity', 'Search store / city')}
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

              {!loading && locationQuery.length >= 2 && locations.length === 0 && (
                <Box py={4} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    {t('dedicatedAgents.admin.noLocationsFound', 'No locations found')}
                  </Typography>
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
              <Typography variant="body2">{t('dedicatedAgents.admin.selectSlots', 'Select one or more slots')}</Typography>
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
                label={t('dedicatedAgents.admin.filterAgents', 'Filter agents')}
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                size="small"
                fullWidth
              />

              {agentsTruncated && (
                <Alert severity="info">
                  {t('dedicatedAgents.admin.truncated', 'Showing the first results; refine the search')}
                </Alert>
              )}

              {loading && (
                <Box display="flex" justifyContent="center" py={2}>
                  <CircularProgress size={24} />
                </Box>
              )}

              {!loading && filteredAgents.length === 0 && (
                <Box py={4} textAlign="center">
                  <Typography variant="body2" color="text.secondary">
                    {t('dedicatedAgents.admin.noAgentsFound', 'No agents found')}
                  </Typography>
                </Box>
              )}

              <Stack spacing={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
                {filteredAgents.map((agent) => {
                  const atCapacity = agent.assignmentCount >= 3;
                  return (
                    <Box
                      key={agent.id}
                      onClick={() => !atCapacity && setSelectedAgent(agent)}
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: selectedAgent?.id === agent.id ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        cursor: atCapacity ? 'not-allowed' : 'pointer',
                        bgcolor: selectedAgent?.id === agent.id ? 'action.selected' : 'background.paper',
                        '&:hover': atCapacity ? {} : { bgcolor: 'action.hover' },
                        opacity: atCapacity ? 0.5 : 1,
                      }}
                      aria-disabled={atCapacity}
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
                              label={agent.isInternal ? t('dedicatedAgents.chips.type.internal', 'Internal') : t('dedicatedAgents.chips.type.independent', 'Independent')}
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
                  );
                })}
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
        <Button onClick={onClose} disabled={submitting} aria-label={t('common.cancel', 'Cancel')}>
          {t('common.cancel', 'Cancel')}
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={submitting}>
            {t('common.back', 'Back')}
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button 
            onClick={handleNext} 
            variant="contained"
            disabled={
              (activeStep === 0 && !selectedLocation) ||
              (activeStep === 1 && selectedSlots.length === 0)
            }
            aria-label={t('common.next', 'Next')}
          >
            {t('common.next', 'Next')}
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!selectedAgent || submitting || !isOnline}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
            aria-label={t('dedicatedAgents.admin.assign', 'Assign')}
          >
            {t('dedicatedAgents.admin.assign', 'Assign')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AdminDedicatedAssignDialog;

