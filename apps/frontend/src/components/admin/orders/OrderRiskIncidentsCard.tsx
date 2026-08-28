import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminOrderRiskIncident } from '../../../hooks/useAdminOrders';
import {
  formatMinutes,
  nextActionLabel,
  riskTypeLabel,
  severityColor,
  severityLabel,
} from './orderRiskLabels';
import type { AdminOrderNextAction } from '../../../hooks/useAdminOrders';
import {
  ResolveEscalationDialog,
  type ResolveEscalationPayload,
} from './ResolveEscalationDialog';

interface OrderRiskIncidentsCardProps {
  incidents: AdminOrderRiskIncident[];
  nextAction: AdminOrderNextAction;
  isAcknowledging: boolean;
  onAcknowledge: (incidentId: string) => void | Promise<void>;
  onResolve: (
    incidentId: string,
    payload: ResolveEscalationPayload
  ) => void | Promise<void>;
}

export const OrderRiskIncidentsCard: React.FC<OrderRiskIncidentsCardProps> = ({
  incidents,
  nextAction,
  isAcknowledging,
  onAcknowledge,
  onResolve,
}) => {
  const { t } = useTranslation();
  const recommendation = nextActionLabel(t, nextAction);
  const [resolveId, setResolveId] = useState<string | null>(null);

  if (incidents.length === 0) {
    return (
      <Alert severity="success">
        {t('admin.orders.noOpenRisk', 'No open risk on this order.')}
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t('admin.orders.openRisk', 'Why this order needs attention')}
        </Typography>
        {recommendation && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {recommendation}
          </Alert>
        )}
        <Stack spacing={2}>
          {incidents.map((incident) => (
            <Box key={incident.id}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                <Chip
                  size="small"
                  color={severityColor(incident.severity)}
                  label={severityLabel(t, incident.severity)}
                />
                <Typography variant="body2" fontWeight={600}>
                  {riskTypeLabel(t, incident.risk_type)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('admin.orders.overdueBy', 'overdue by {{duration}}', {
                    duration: formatMinutes(t, incident.overdue_minutes),
                  })}
                </Typography>
              </Stack>
              {incident.reason && (
                <Typography variant="body2" color="text.secondary">
                  {incident.reason}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {t('admin.orders.detectedAt', 'Detected {{when}}', {
                  when: new Date(incident.detected_at).toLocaleString(),
                })}
                {' · '}
                {t('admin.orders.alertsSent', '{{count}} alert(s) sent', {
                  count: incident.notified_count,
                })}
              </Typography>
              {incident.acknowledged_at ? (
                <Typography variant="caption" color="success.main" display="block">
                  {t(
                    'admin.orders.acknowledged',
                    'Acknowledged — repeat alerts paused'
                  )}
                  {incident.acknowledged_note
                    ? ` · ${incident.acknowledged_note}`
                    : ''}
                </Typography>
              ) : null}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {!incident.acknowledged_at ? (
                  <Button
                    size="small"
                    disabled={isAcknowledging}
                    onClick={() => void onAcknowledge(incident.id)}
                  >
                    {t('admin.orders.acknowledgeAction', "I'm on it")}
                  </Button>
                ) : null}
                <Button
                  size="small"
                  color="success"
                  variant="contained"
                  disabled={isAcknowledging}
                  onClick={() => setResolveId(incident.id)}
                >
                  {t('admin.credits.resolveAction', 'Resolve')}
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </CardContent>

      <ResolveEscalationDialog
        open={!!resolveId}
        submitting={isAcknowledging}
        onClose={() => {
          if (!isAcknowledging) setResolveId(null);
        }}
        onSubmit={async (payload) => {
          if (!resolveId) return;
          await onResolve(resolveId, payload);
          setResolveId(null);
        }}
      />
    </Card>
  );
};
