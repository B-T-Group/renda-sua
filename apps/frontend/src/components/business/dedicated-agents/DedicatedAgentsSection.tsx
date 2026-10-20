import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDedicatedAgents } from '../../../hooks/useDedicatedAgents';
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [agents, setAgents] = useState<DedicatedAgentCard[]>([]);
  const [postings, setPostings] = useState<DedicatedPostingView[]>([]);
  const [maxActiveOrders, setMaxActiveOrders] = useState(10);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [selectedSlotForPost, setSelectedSlotForPost] = useState<SlotKey | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [slotsRes, agentsRes, postingsRes] = await Promise.all([
        dedicatedApi.getPickupSlots(locationId).catch(() => null),
        dedicatedApi.getDedicatedAgents(locationId).catch(() => null),
        dedicatedApi.getPostings(locationId).catch(() => null),
      ]);

      if (!slotsRes) {
        return;
      }

      setSlots(slotsRes.slots);
      if (agentsRes) {
        setAgents(agentsRes.assignments);
        setMaxActiveOrders(agentsRes.maxActiveOrders);
      }
      if (postingsRes) {
        setPostings(postingsRes.postings);
      }
    } catch (err: any) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        return;
      }
      console.error('Error loading dedicated agents:', err);
      setError(t('dedicatedAgents.generic', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  }, [locationId, dedicatedApi, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSlotToggle = async (slotKey: SlotKey, enabled: boolean) => {
    try {
      await dedicatedApi.updatePickupSlots(locationId, {
        slots: [{ slotKey, isEnabled: enabled }],
      });
      await loadData();
    } catch (err: any) {
      console.error('Error toggling slot:', err);
    }
  };

  const handlePickupTimeChange = async (slotKey: SlotKey, pickupTime: string) => {
    try {
      await dedicatedApi.updatePickupSlots(locationId, {
        slots: [{ slotKey, pickupTime }],
      });
      await loadData();
    } catch (err: any) {
      console.error('Error updating pickup time:', err);
    }
  };

  const handlePauseResume = async (assignmentId: string, status: 'active' | 'paused') => {
    try {
      await dedicatedApi.updateAssignment(locationId, assignmentId, { status });
      await loadData();
    } catch (err: any) {
      console.error('Error updating assignment:', err);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await dedicatedApi.deleteAssignment(locationId, assignmentId);
      await loadData();
    } catch (err: any) {
      console.error('Error removing assignment:', err);
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
              <Button variant="contained" onClick={() => handleOpenPostDialog()}>
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
    </>
  );
};

export default DedicatedAgentsSection;
