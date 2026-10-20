import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Delete as DeleteIcon,
  LocalShipping as OrdersIcon,
  CheckCircle as DeliveriesIcon,
  Cancel as MissedIcon,
  AccountBalance as BalanceIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { DedicatedAgentCard as Agent } from '../../../types/dedicatedAgents';

interface DedicatedAgentCardProps {
  agent: Agent;
  onPauseResume: (assignmentId: string, status: 'active' | 'paused') => void;
  onRemove: (assignmentId: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

const DedicatedAgentCard: React.FC<DedicatedAgentCardProps> = ({
  agent,
  onPauseResume,
  onRemove,
  disabled = false,
  loading = false,
}) => {
  const { t } = useTranslation();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const initials =
    agent.agent.firstName[0] + (agent.agent.lastName?.[0] || '');

  const getStatusChip = () => {
    if (agent.offToday) {
      return (
        <Chip
          label={t('dedicatedAgents.chips.status.offToday', 'Off today')}
          size="small"
          color="warning"
        />
      );
    }
    if (agent.status === 'paused') {
      return (
        <Chip
          label={t('dedicatedAgents.chips.status.paused', 'Paused')}
          size="small"
          color="default"
        />
      );
    }
    return (
      <Chip
        label={t('dedicatedAgents.chips.status.active', 'Active')}
        size="small"
        color="success"
      />
    );
  };

  return (
    <>
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar src={agent.agent.photoUrl || undefined} sx={{ width: 40, height: 40 }}>
            {initials}
          </Avatar>

          <Stack flex={1} spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="body1" fontWeight={600}>
                {agent.agent.firstName} {agent.agent.lastName}
              </Typography>
              
              <Chip
                label={
                  agent.agent.isInternal
                    ? t('dedicatedAgents.chips.type.internal', 'Internal')
                    : t('dedicatedAgents.chips.type.independent', 'Independent')
                }
                size="small"
                variant="outlined"
              />
              
              {getStatusChip()}
              
              {agent.assignedByRendasua && (
                <Chip
                  label={t('dedicatedAgents.assignedChip', 'Assigned by RendaSua')}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>

            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Tooltip title={t('dedicatedAgents.load', '{{active}}/{{max}} orders', {
                active: agent.activeOrders,
                max: agent.maxActiveOrders,
              })}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <OrdersIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {agent.activeOrders}/{agent.maxActiveOrders}
                  </Typography>
                </Stack>
              </Tooltip>

              {!agent.agent.isInternal && agent.balanceCoversOrders !== null && (
                <Tooltip title={t('dedicatedAgents.balanceShort', '~{{n}} more', {
                  n: agent.balanceCoversOrders,
                })}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <BalanceIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      ~{agent.balanceCoversOrders}
                    </Typography>
                  </Stack>
                </Tooltip>
              )}

              <Tooltip title={t('dedicatedAgents.metrics.deliveries', '{{n}} deliveries', { n: agent.deliveries })}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <DeliveriesIcon fontSize="small" color="success" />
                  <Typography variant="body2">{agent.deliveries}</Typography>
                </Stack>
              </Tooltip>

              <Tooltip title={t('dedicatedAgents.metrics.missed', '{{n}} missed', { n: agent.missedDeliveries })}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MissedIcon fontSize="small" color="error" />
                  <Typography variant="body2">{agent.missedDeliveries}</Typography>
                </Stack>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1}>
              {agent.status === 'active' ? (
                <Tooltip title={t('dedicatedAgents.actions.pause', 'Pause')}>
                  <IconButton
                    size="small"
                    onClick={() => onPauseResume(agent.assignmentId, 'paused')}
                    disabled={disabled || loading}
                    aria-label={t('dedicatedAgents.ariaLabels.pauseAgent', 'Pause agent {{name}}', {
                      name: `${agent.agent.firstName} ${agent.agent.lastName}`,
                    })}
                  >
                    <PauseIcon />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title={t('dedicatedAgents.actions.resume', 'Resume')}>
                  <IconButton
                    size="small"
                    onClick={() => onPauseResume(agent.assignmentId, 'active')}
                    disabled={disabled || loading}
                    aria-label={t('dedicatedAgents.ariaLabels.resumeAgent', 'Resume agent {{name}}', {
                      name: `${agent.agent.firstName} ${agent.agent.lastName}`,
                    })}
                  >
                    <ResumeIcon />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title={t('dedicatedAgents.actions.remove', 'Remove')}>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setConfirmRemove(true)}
                  disabled={disabled || loading}
                  aria-label={t('dedicatedAgents.ariaLabels.removeAgent', 'Remove agent {{name}}', {
                    name: `${agent.agent.firstName} ${agent.agent.lastName}`,
                  })}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)}>
        <DialogTitle>
          {t('dedicatedAgents.removeConfirm', 'Remove {{name}} from {{slot}}?', {
            name: agent.agent.firstName,
            slot: agent.slotKey,
          })}
        </DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmRemove(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              onRemove(agent.assignmentId);
              setConfirmRemove(false);
            }}
          >
            {t('dedicatedAgents.actions.remove', 'Remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DedicatedAgentCard;
