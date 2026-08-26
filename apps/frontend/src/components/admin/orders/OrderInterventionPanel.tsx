import EmailIcon from '@mui/icons-material/Email';
import MessageIcon from '@mui/icons-material/Message';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SmsIcon from '@mui/icons-material/Sms';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAddAdminNote,
  useSendOrderEmail,
  useSendOrderMessage,
  useSendOrderSms,
  useUnassignRedispatch,
  useUpdateOrderStatus,
  type AdminOrderDetail,
  type OrderContactRole,
} from '../../../hooks/useAdminOrders';

const CORRECTABLE_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'in_delivery',
  'delivered',
  'complete',
  'cancelled',
  'failed',
];

interface OrderInterventionPanelProps {
  order: AdminOrderDetail;
  initialRecipient: OrderContactRole;
  onChanged: () => void;
}

export const OrderInterventionPanel: React.FC<OrderInterventionPanelProps> = ({
  order,
  initialRecipient,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [channel, setChannel] = useState(0);
  const [recipient, setRecipient] = useState<OrderContactRole>(initialRecipient);
  const [message, setMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sms, setSms] = useState('');

  const sendMessage = useSendOrderMessage();
  const sendEmail = useSendOrderEmail();
  const sendSms = useSendOrderSms();

  React.useEffect(() => setRecipient(initialRecipient), [initialRecipient]);

  const run = async (action: () => Promise<unknown>, successKey: string) => {
    try {
      await action();
      enqueueSnackbar(t(successKey, 'Done'), { variant: 'success' });
      onChanged();
      return true;
    } catch (error: any) {
      enqueueSnackbar(
        error?.response?.data?.message ||
          error?.message ||
          t('admin.orders.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
      return false;
    }
  };

  const handleMessage = async () => {
    const ok = await run(
      () =>
        sendMessage.mutateAsync({
          orderId: order.id,
          message,
          recipientType: recipient,
        }),
      'admin.orders.messageSent'
    );
    if (ok) setMessage('');
  };

  const handleEmail = async () => {
    const ok = await run(
      () =>
        sendEmail.mutateAsync({
          orderId: order.id,
          subject: emailSubject,
          message: emailBody,
          recipientType: recipient,
        }),
      'admin.orders.emailSent'
    );
    if (ok) {
      setEmailSubject('');
      setEmailBody('');
    }
  };

  const handleSms = async () => {
    const ok = await run(
      () =>
        sendSms.mutateAsync({
          orderId: order.id,
          message: sms,
          recipientType: recipient,
        }),
      'admin.orders.smsSent'
    );
    if (ok) setSms('');
  };

  const selectedContact = order.contacts.find((c) => c.role === recipient);

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t('admin.orders.intervene', 'Intervene')}
        </Typography>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>{t('admin.orders.recipient', 'Recipient')}</InputLabel>
          <Select
            value={recipient}
            label={t('admin.orders.recipient', 'Recipient')}
            onChange={(e) => setRecipient(e.target.value as OrderContactRole)}
          >
            {order.contacts.map((contact) => (
              <MenuItem key={contact.role} value={contact.role}>
                {contact.name || contact.role}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tabs
          value={channel}
          onChange={(_e, value) => setChannel(value)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab icon={<MessageIcon />} label={t('admin.orders.inApp', 'In-app')} />
          <Tab icon={<EmailIcon />} label={t('admin.orders.email', 'Email')} />
          <Tab icon={<SmsIcon />} label={t('admin.orders.sms', 'SMS')} />
        </Tabs>

        <Box sx={{ py: 2 }} hidden={channel !== 0}>
          {!selectedContact?.can_message && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {t(
                'admin.orders.messageUnavailable',
                'In-app messaging needs a linked account.'
              )}
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t(
              'admin.orders.messagePlaceholder',
              'Type your message...'
            )}
            sx={{ mb: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<MessageIcon />}
            onClick={handleMessage}
            disabled={
              sendMessage.isPending ||
              !message.trim() ||
              !selectedContact?.can_message
            }
          >
            {t('admin.orders.sendMessage', 'Send message')}
          </Button>
        </Box>

        <Box sx={{ py: 2 }} hidden={channel !== 1}>
          {!selectedContact?.can_email && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {t('admin.orders.noEmail', 'This participant has no email on file.')}
            </Alert>
          )}
          <TextField
            fullWidth
            size="small"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder={t('admin.orders.emailSubject', 'Subject')}
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder={t('admin.orders.emailBody', 'Email content...')}
            sx={{ mb: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            onClick={handleEmail}
            disabled={
              sendEmail.isPending ||
              !emailSubject.trim() ||
              !emailBody.trim() ||
              !selectedContact?.can_email
            }
          >
            {t('admin.orders.sendEmail', 'Send email')}
          </Button>
        </Box>

        <Box sx={{ py: 2 }} hidden={channel !== 2}>
          {!selectedContact?.can_sms && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {t('admin.orders.noPhone', 'This participant has no phone on file.')}
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            rows={2}
            value={sms}
            onChange={(e) => setSms(e.target.value)}
            placeholder={t('admin.orders.smsPlaceholder', 'SMS message...')}
            sx={{ mb: 1 }}
          />
          <Button
            variant="contained"
            startIcon={<SmsIcon />}
            onClick={handleSms}
            disabled={sendSms.isPending || !sms.trim() || !selectedContact?.can_sms}
          >
            {t('admin.orders.sendSms', 'Send SMS')}
          </Button>
        </Box>

        <RedispatchSection order={order} run={run} />
        <NoteSection orderId={order.id} run={run} />
        {order.capabilities.can_force_status && (
          <StatusCorrectionSection order={order} run={run} />
        )}
      </CardContent>
    </Card>
  );
};

type RunAction = (
  action: () => Promise<unknown>,
  successKey: string
) => Promise<boolean>;

const RedispatchSection: React.FC<{
  order: AdminOrderDetail;
  run: RunAction;
}> = ({ order, run }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const unassign = useUnassignRedispatch();

  if (!order.capabilities.can_redispatch) return null;

  const hasAgent = order.current_status === 'assigned_to_agent';
  const title = hasAgent
    ? t('admin.orders.unassignRedispatch', 'Unassign & redispatch')
    : t('admin.orders.redispatch', 'Redispatch to agents');

  return (
    <Accordion disableGutters sx={{ mt: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PersonAddIcon fontSize="small" />
          <Typography variant="body2">{title}</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Alert severity="info" sx={{ mb: 2 }}>
          {hasAgent
            ? t(
                'admin.orders.unassignInfo',
                'Releases the current agent and their hold, then redispatches to nearby agents. If none accept, the client is offered store pickup.'
              )
            : t(
                'admin.orders.redispatchInfo',
                'Re-opens the dispatch rounds so nearby agents are offered this order again. If none accept, the client is offered store pickup.'
              )}
        </Alert>
        <TextField
          fullWidth
          multiline
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          label={t('admin.orders.unassignReason', 'Reason (optional)')}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          disabled={unassign.isPending}
          onClick={() =>
            run(
              () => unassign.mutateAsync({ orderId: order.id, reason }),
              'admin.orders.unassignSuccess'
            )
          }
        >
          {title}
        </Button>
      </AccordionDetails>
    </Accordion>
  );
};

const NoteSection: React.FC<{
  orderId: string;
  run: RunAction;
}> = ({ orderId, run }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const addNote = useAddAdminNote();

  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <NoteAddIcon fontSize="small" />
          <Typography variant="body2">
            {t('admin.orders.addNote', 'Add note')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          label={t('admin.orders.adminNote', 'Support note')}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          disabled={addNote.isPending || !note.trim()}
          onClick={async () => {
            const ok = await run(
              () => addNote.mutateAsync({ orderId, note }),
              'admin.orders.noteAdded'
            );
            if (ok) setNote('');
          }}
        >
          {t('admin.orders.addNote', 'Add note')}
        </Button>
      </AccordionDetails>
    </Accordion>
  );
};

const StatusCorrectionSection: React.FC<{
  order: AdminOrderDetail;
  run: RunAction;
}> = ({ order, run }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const updateStatus = useUpdateOrderStatus();

  return (
    <Accordion disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TuneIcon fontSize="small" />
          <Typography variant="body2">
            {t('admin.orders.correctStatus', 'Correct status (last resort)')}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t(
            'admin.orders.statusWarning',
            'Manual corrections bypass the fulfillment workflow. Use only when the order is stuck, and always say why.'
          )}
        </Alert>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>{t('admin.orders.newStatus', 'New status')}</InputLabel>
          <Select
            value={status}
            label={t('admin.orders.newStatus', 'New status')}
            onChange={(e) => setStatus(e.target.value)}
          >
            {CORRECTABLE_STATUSES.filter(
              (option) => option !== order.current_status
            ).map((option) => (
              <MenuItem key={option} value={option}>
                {option.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          multiline
          rows={2}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          label={t('admin.orders.statusReason', 'Why this correction is needed')}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          color="warning"
          disabled={updateStatus.isPending || !status || !reason.trim()}
          onClick={async () => {
            const ok = await run(
              () =>
                updateStatus.mutateAsync({
                  orderId: order.id,
                  status,
                  reason,
                }),
              'admin.orders.statusUpdated'
            );
            if (ok) {
              setStatus('');
              setReason('');
            }
          }}
        >
          {t('admin.orders.updateStatusButton', 'Correct status')}
        </Button>
      </AccordionDetails>
    </Accordion>
  );
};
