import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
import { useDedicatedAgentsAnalytics } from '../../../hooks/useDedicatedAgentsAnalytics';
import {
  extractDedicatedAgentsError,
  isDedicatedAgentsFeatureHidden,
  mapDedicatedAgentsErrorCode,
} from '../../../utils/dedicatedAgentsErrors';
import type {
  DedicatedAgentCard,
  DedicatedPostingView,
  PickupSlot,
  SlotKey,
} from '../../../types/dedicatedAgents';
import DedicatedSlotRow from './DedicatedSlotRow';
import DedicatedAgentCardComponent from './DedicatedAgentCard';
import DedicatedPostingRow from './DedicatedPostingRow';
import PostRequestDialog from './PostRequestDialog';

interface DedicatedAgentsSectionProps {
  locationId: string;
}

const DedicatedAgentsSection: React.FC<DedicatedAgentsSectionProps> = ({ locationId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dedicatedApi = useDedicatedAgents();
  const { track } = useDedicatedAgentsAnalytics();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [agents, setAgents] = useState<DedicatedAgentCard[]>([]);
  const [postings, setPostings] = useState<DedicatedPostingView[]>([]);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [selectedSlotForPost, setSelectedSlotForPost] = useState<SlotKey | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [mutating, setMutating] = useState<string | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [slotsRes, agentsRes, postingsRes] = await Promise.all([
        dedicatedApi.getPickupSlots(locationId).catch((err) => {
          if (isDedicatedAgentsFeatureHidden(err)) {
            return null;
          }
          throw err;
        }),
        dedicatedApi.getDedicatedAgents(locationId).catch(() => null),
        dedicatedApi.getPostings(locationId).catch(() => null),
      ]);

      if (!slotsRes) {
        return;
      }

      setSlots(slotsRes.slots);
      if (agentsRes) {
        setAgents(agentsRes.assignments);
      }
      if (postingsRes) {
        setPostings(postingsRes.postings);
      }

      if (slotsRes.slots.length > 0 && agentsRes) {
        track('section_viewed', {
          role: 'business',
          locationId,
          slotsEnabled: slotsRes.slots.filter((s) => s.isEnabled).length,
          agents: agentsRes.assignments.length,
          openPostings: postingsRes?.postings.filter((p) => p.status === 'open').length || 0,
        });
      }
    } catch (err: any) {
      if (isDedicatedAgentsFeatureHidden(err)) {
        return;
      }
      console.error('Error loading dedicated agents:', err);
      setError(t('dedicatedAgents.generic', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  }, [locationId, dedicatedApi, t, track]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSlotToggle = async (slotKey: SlotKey, enabled: boolean) => {
    if (offline) return;

    try {
      setMutating(`slot-${slotKey}`);
      await dedicatedApi.updatePickupSlots(locationId, {
        slots: [{ slotKey, isEnabled: enabled }],
      });
      
      track('slot_toggled', {
        role: 'business',
        locationId,
        slotKey,
        enabled,
        agentsPaused: 0,
      });

      await loadData();
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      if (code === 'slot_has_dedicated_agents') {
        throw err;
      }

      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      setSnackbarMessage(t(errorKey, 'An error occurred'));
      
      track('action_conflict', {
        role: 'business',
        endpoint: 'updatePickupSlots',
        code: code || 'unknown',
      });

      console.error('Error toggling slot:', err);
    } finally {
      setMutating(null);
    }
  };

  const handlePickupTimeChange = async (slotKey: SlotKey, pickupTime: string) => {
    if (offline) return;

    try {
      setMutating(`pickup-${slotKey}`);
      await dedicatedApi.updatePickupSlots(locationId, {
        slots: [{ slotKey, pickupTime }],
      });
      
      track('pickup_time_changed', {
        role: 'business',
        locationId,
        slotKey,
        time: pickupTime,
      });

      setSnackbarMessage(t('common.saved', 'Saved'));
      await loadData();
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      setSnackbarMessage(t(errorKey, 'An error occurred'));

      track('action_conflict', {
        role: 'business',
        endpoint: 'updatePickupSlots',
        code: code || 'unknown',
      });

      console.error('Error updating pickup time:', err);
      await loadData();
    } finally {
      setMutating(null);
    }
  };

  const handlePauseResume = async (assignmentId: string, status: 'active' | 'paused') => {
    if (offline) return;

    const agent = agents.find((a) => a.assignmentId === assignmentId);
    if (!agent) return;

    try {
      setMutating(`assignment-${assignmentId}`);
      await dedicatedApi.updateAssignment(locationId, assignmentId, { status });

      const eventName = status === 'paused' ? 'agent_paused' : 'agent_resumed';
      track(eventName, {
        role: 'business',
        locationId,
        slotKey: agent.slotKey,
        source: agent.source,
        isInternal: agent.agent.isInternal,
      });

      setSnackbarMessage(t('common.saved', 'Saved'));
      await loadData();
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      setSnackbarMessage(t(errorKey, 'An error occurred'));

      track('action_conflict', {
        role: 'business',
        endpoint: 'updateAssignment',
        code: code || 'unknown',
      });

      console.error('Error updating assignment:', err);
      await loadData();
    } finally {
      setMutating(null);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (offline) return;

    const agent = agents.find((a) => a.assignmentId === assignmentId);
    if (!agent) return;

    try {
      setMutating(`assignment-${assignmentId}`);
      await dedicatedApi.deleteAssignment(locationId, assignmentId);

      track('agent_removed', {
        role: 'business',
        locationId,
        slotKey: agent.slotKey,
        source: agent.source,
        isInternal: agent.agent.isInternal,
      });

      setSnackbarMessage(t('common.removed', 'Removed'));
      await loadData();
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);
      const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
      setSnackbarMessage(t(errorKey, 'An error occurred'));

      track('action_conflict', {
        role: 'business',
        endpoint: 'deleteAssignment',
        code: code || 'unknown',
      });

      console.error('Error removing assignment:', err);
    } finally {
      setMutating(null);
    }
  };

  const handleOpenPostDialog = (slotKey?: SlotKey) => {
    setSelectedSlotForPost(slotKey || null);
    setPostDialogOpen(true);
  };

  const handleClosePostDialog = () => {
    setPostDialogOpen(false);
    setSelectedSlotForPost(null);
  };

  const handlePostSuccess = async (postingId: string) => {
    await loadData();
    handleClosePostDialog();
    setSnackbarMessage(t('dedicatedAgents.form.posted', 'Request posted'));
    navigate(`/business/locations/${locationId}/dedicated-agents/postings/${postingId}`);
  };

  if (loading && slots.length === 0) {
    return (
      <Paper id="dedicated-agents" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      </Paper>
    );
  }

  if (error || slots.length === 0) {
    if (error) {
      return (
        <Paper id="dedicated-agents" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720 }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="body2" color="error">
              {error}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              aria-label={t('dedicatedAgents.retry', 'Retry')}
            >
              {t('dedicatedAgents.retry', 'Retry')}
            </Button>
          </Stack>
        </Paper>
      );
    }
    return null;
  }

  const enabledSlots = slots.filter((s) => s.isEnabled);
  const hasOpenPostingForAllSlots = enabledSlots.every((slot) =>
    postings.some((p) => p.status === 'open' && p.slotKeys.includes(slot.slotKey))
  );
  const canPost = enabledSlots.length > 0 && !hasOpenPostingForAllSlots;

  const getAgentsForSlot = (slotKey: SlotKey) =>
    agents.filter((a) => a.slotKey === slotKey);

  const getOpenPostingForSlot = (slotKey: SlotKey) =>
    postings.find((p) => p.status === 'open' && p.slotKeys.includes(slotKey));

  const calculateSlotCapacity = (slotKey: SlotKey) => {
    const slotAgents = getAgentsForSlot(slotKey).filter(
      (a) => a.status === 'active' && !a.offToday
    );
    const capacity = slotAgents.reduce((sum, agent) => {
      const available = Math.max(
        0,
        agent.maxActiveOrders - agent.activeOrders - agent.outstandingDedicatedOffers
      );
      const capped =
        agent.balanceCoversOrders !== null
          ? Math.min(available, agent.balanceCoversOrders)
          : available;
      return sum + capped;
    }, 0);
    return capacity;
  };

  return (
    <>
      <Paper id="dedicated-agents" variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720 }}>
        <Stack spacing={2}>
          {offline && (
            <Alert severity="warning">
              {t('dedicatedAgents.offline', 'Offline · showing last update')}
            </Alert>
          )}

          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('dedicatedAgents.section.title', 'Dedicated agents')}
          </Typography>

          <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                {t(
                  'dedicatedAgents.section.explainer',
                  'Dedicated agents get orders when no nearby agent takes them.'
                )}
              </Typography>
              <Typography variant="body2">
                {t('dedicatedAgents.section.scheduledOnly', 'Scheduled orders only.')}
              </Typography>
            </Stack>
          </Alert>

          {slots.map((slot) => {
            const slotAgents = getAgentsForSlot(slot.slotKey);
            const openPosting = getOpenPostingForSlot(slot.slotKey);
            const capacity = calculateSlotCapacity(slot.slotKey);
            const showWarning = slot.isEnabled && slotAgents.length > 0 && capacity === 0;

            return (
              <Stack key={slot.slotKey} spacing={1}>
                <DedicatedSlotRow
                  slot={slot}
                  onToggle={handleSlotToggle}
                  onPickupTimeChange={handlePickupTimeChange}
                  disabled={offline || mutating === `slot-${slot.slotKey}` || mutating === `pickup-${slot.slotKey}`}
                />

                {slot.isEnabled && (
                  <Box sx={{ pl: 2 }}>
                    {showWarning && (
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        {t(
                          'dedicatedAgents.fullWarning',
                          'No dedicated agent can take orders right now. Delivery follows normal rules.'
                        )}
                      </Alert>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('dedicatedAgents.slotHeader', '{{n}} agents · up to {{max}} orders', {
                        n: slotAgents.length,
                        max: capacity,
                      })}
                    </Typography>

                    {slotAgents.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        👤 {t('dedicatedAgents.empty', 'No dedicated agent')}
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {slotAgents.map((agent) => (
                          <DedicatedAgentCardComponent
                            key={agent.assignmentId}
                            agent={agent}
                            onPauseResume={handlePauseResume}
                            onRemove={handleRemove}
                            disabled={offline || mutating === `assignment-${agent.assignmentId}`}
                            loading={mutating === `assignment-${agent.assignmentId}`}
                          />
                        ))}
                      </Stack>
                    )}

                    {openPosting && (
                      <Box sx={{ mt: 1 }}>
                        <DedicatedPostingRow
                          posting={openPosting}
                          onClick={() =>
                            navigate(
                              `/business/locations/${locationId}/dedicated-agents/postings/${openPosting.id}`
                            )
                          }
                        />
                      </Box>
                    )}
                  </Box>
                )}
              </Stack>
            );
          })}

          {canPost && (
            <Box display="flex" justifyContent="center" pt={2}>
              <Button
                variant="contained"
                onClick={() => handleOpenPostDialog()}
                disabled={offline}
                aria-label={t('dedicatedAgents.post', 'Post a request')}
              >
                📣 {t('dedicatedAgents.post', 'Post a request')}
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>

      <PostRequestDialog
        open={postDialogOpen}
        locationId={locationId}
        enabledSlots={enabledSlots}
        existingPostings={postings.filter((p) => p.status === 'open')}
        selectedSlot={selectedSlotForPost}
        onClose={handleClosePostDialog}
        onSuccess={handlePostSuccess}
      />

      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage(null)}
        message={snackbarMessage}
      />
    </>
  );
};

export default DedicatedAgentsSection;
