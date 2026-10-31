import { Alert, Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DeliveryConfirmationState } from '../../types/deliveryConfirmation';
import { agentWaitingCopy } from '../../utils/deliveryConfirmationUi';

type Props = {
  state: DeliveryConfirmationState;
  payAtDeliveryPaid?: boolean;
};

const AgentWaitingForClient: React.FC<Props> = ({ state, payAtDeliveryPaid }) => {
  const { t } = useTranslation();
  const waiting = agentWaitingCopy(state.agentMessageKey);
  const hours = state.autoCompleteHours || 2;
  const body =
    state.status === 'pending_auto_complete'
      ? t('orders.clientConfirm.agentFallbackDone', {
          defaultValue:
            'Submitted. Order completes automatically in {{h}}h unless the client reports a problem.',
          h: hours,
        })
      : payAtDeliveryPaid
        ? t(
            'orders.clientConfirm.payReceivedNext',
            'Payment received. Ask the client to confirm receipt in the app.'
          )
        : t(waiting.i18nKey, waiting.fallback);

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <Typography variant="body2">{body}</Typography>
      {state.status === 'pending_auto_complete' && state.photos[0] ? (
        <Box
          component="img"
          src={state.photos[0].photoUrl}
          alt={t('orders.clientConfirm.proofPhoto', 'Delivery photo')}
          sx={{ mt: 1, width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 1 }}
        />
      ) : null}
    </Alert>
  );
};

export default AgentWaitingForClient;
