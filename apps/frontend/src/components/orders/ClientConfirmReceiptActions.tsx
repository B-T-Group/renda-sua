import { Box, Button, Stack, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeliveryConfirmationState } from '../../types/deliveryConfirmation';
import { clientShowPendingAutoCompleteNotice } from '../../utils/deliveryConfirmationUi';
import ReportDeliveryProblemDialog from '../dialogs/ReportDeliveryProblemDialog';

type Props = {
  state: DeliveryConfirmationState | null;
  busy?: boolean;
  onConfirm: () => void;
  onReportProblem: (description?: string) => void;
};

const ClientConfirmReceiptActions: React.FC<Props> = ({
  state,
  busy,
  onConfirm,
  onReportProblem,
}) => {
  const { t } = useTranslation();
  const [problemOpen, setProblemOpen] = useState(false);
  const hours = state?.autoCompleteHours ?? 2;
  const showNotice = clientShowPendingAutoCompleteNotice(state);
  const photo = state?.photos[0];

  return (
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      <Typography variant="subtitle1">
        {t('orders.clientConfirm.push.title', 'Your order has arrived')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {showNotice
          ? t('orders.clientConfirm.clientFallbackNotice', {
              defaultValue:
                'Your courier marked this order delivered with a photo. Confirm or report a problem within {{h}}h.',
              h: hours,
            })
          : t('orders.clientConfirm.push.body', 'Tap to confirm you received it.')}
      </Typography>
      {photo ? (
        <Box
          component="img"
          src={photo.photoUrl}
          alt={t('orders.clientConfirm.proofPhoto', 'Delivery photo')}
          sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 1 }}
        />
      ) : null}
      <Button variant="contained" color="success" onClick={onConfirm} disabled={busy}>
        {t('orders.clientConfirm.cta.confirm', 'Confirm receipt')}
      </Button>
      <Button variant="outlined" color="error" onClick={() => setProblemOpen(true)} disabled={busy}>
        {t('orders.clientConfirm.cta.problem', 'Report a problem')}
      </Button>
      <ReportDeliveryProblemDialog
        open={problemOpen}
        submitting={busy}
        onClose={() => setProblemOpen(false)}
        onSubmit={(description) => {
          setProblemOpen(false);
          onReportProblem(description);
        }}
      />
    </Stack>
  );
};

export default ClientConfirmReceiptActions;
