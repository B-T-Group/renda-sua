import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Chip,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Tabs,
  Tab,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Email as EmailIcon,
  Sms as SmsIcon,
  Message as MessageIcon,
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  NoteAdd as NoteAddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  OrderWithRisk,
  useUnassignRedispatch,
  useUpdateOrderStatus,
  useAddAdminNote,
  useSendOrderMessage,
  useSendOrderEmail,
  useSendOrderSms,
} from '../../../hooks/useAdminOrders';

interface OrderDetailDialogProps {
  open: boolean;
  order: OrderWithRisk;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

export const OrderDetailDialog: React.FC<OrderDetailDialogProps> = ({ open, order, onClose }) => {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState(0);

  const [recipientType, setRecipientType] = useState<'client' | 'business' | 'agent'>('client');
  const [messageText, setMessageText] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsText, setSmsText] = useState('');
  const [unassignReason, setUnassignReason] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const unassignRedispatch = useUnassignRedispatch();
  const updateStatus = useUpdateOrderStatus();
  const addNote = useAddAdminNote();
  const sendMessage = useSendOrderMessage();
  const sendEmail = useSendOrderEmail();
  const sendSms = useSendOrderSms();

  const handleSendMessage = async () => {
    try {
      await sendMessage.mutateAsync({
        orderId: order.id,
        message: messageText,
        recipientType,
      });
      enqueueSnackbar(t('admin.orders.messageSent', 'Message sent successfully'), {
        variant: 'success',
      });
      setMessageText('');
    } catch (error: any) {
      enqueueSnackbar(
        error.message || t('admin.orders.messageFailed', 'Failed to send message'),
        { variant: 'error' }
      );
    }
  };

  const handleSendEmail = async () => {
    try {
      await sendEmail.mutateAsync({
        orderId: order.id,
        subject: emailSubject,
        message: emailBody,
        recipientType,
      });
      enqueueSnackbar(t('admin.orders.emailSent', 'Email sent successfully'), {
        variant: 'success',
      });
      setEmailSubject('');
      setEmailBody('');
    } catch (error: any) {
      enqueueSnackbar(
        error.message || t('admin.orders.emailFailed', 'Failed to send email'),
        { variant: 'error' }
      );
    }
  };

  const handleSendSms = async () => {
    try {
      await sendSms.mutateAsync({
        orderId: order.id,
        message: smsText,
        recipientType,
      });
      enqueueSnackbar(t('admin.orders.smsSent', 'SMS sent successfully'), { variant: 'success' });
      setSmsText('');
    } catch (error: any) {
      enqueueSnackbar(error.message || t('admin.orders.smsFailed', 'Failed to send SMS'), {
        variant: 'error',
      });
    }
  };

  const handleUnassignRedispatch = async () => {
    try {
      await unassignRedispatch.mutateAsync({
        orderId: order.id,
        reason: unassignReason,
      });
      enqueueSnackbar(
        t('admin.orders.unassignSuccess', 'Order unassigned and redispatched successfully'),
        { variant: 'success' }
      );
      setUnassignReason('');
      setRefreshKey((k) => k + 1);
      onClose();
    } catch (error: any) {
      enqueueSnackbar(
        error.message || t('admin.orders.unassignFailed', 'Failed to unassign and redispatch'),
        { variant: 'error' }
      );
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) {
      enqueueSnackbar(t('admin.orders.selectStatus', 'Please select a status'), {
        variant: 'warning',
      });
      return;
    }

    try {
      await updateStatus.mutateAsync({
        orderId: order.id,
        status: newStatus,
        notes: statusNotes,
      });
      enqueueSnackbar(t('admin.orders.statusUpdated', 'Status updated successfully'), {
        variant: 'success',
      });
      setNewStatus('');
      setStatusNotes('');
      setRefreshKey((k) => k + 1);
      onClose();
    } catch (error: any) {
      enqueueSnackbar(
        error.message || t('admin.orders.statusUpdateFailed', 'Failed to update status'),
        { variant: 'error' }
      );
    }
  };

  const handleAddNote = async () => {
    if (!adminNote.trim()) {
      enqueueSnackbar(t('admin.orders.enterNote', 'Please enter a note'), {
        variant: 'warning',
      });
      return;
    }

    try {
      await addNote.mutateAsync({
        orderId: order.id,
        note: adminNote,
      });
      enqueueSnackbar(t('admin.orders.noteAdded', 'Note added successfully'), {
        variant: 'success',
      });
      setAdminNote('');
    } catch (error: any) {
      enqueueSnackbar(error.message || t('admin.orders.noteFailed', 'Failed to add note'), {
        variant: 'error',
      });
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'XAF',
    }).format(amount);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{t('admin.orders.orderDetails', 'Order Details')}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {t('admin.orders.basicInfo', 'Basic Information')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>{t('admin.orders.orderNumber', 'Order #')}:</strong> {order.order_number}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>{t('admin.orders.status', 'Status')}:</strong>{' '}
                    <Chip label={order.current_status.replace(/_/g, ' ')} size="small" />
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>{t('admin.orders.amount', 'Amount')}:</strong>{' '}
                    {formatCurrency(order.total_amount, order.currency)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>{t('admin.orders.fulfillment', 'Fulfillment')}:</strong>{' '}
                    {order.fulfillment_method}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 2, bgcolor: order.risk_level === 'critical' ? 'error.light' : order.risk_level === 'high' ? 'warning.light' : 'inherit' }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('admin.orders.riskAssessment', 'Risk Assessment')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Chip
                  label={`${t('admin.orders.riskScore', 'Risk Score')}: ${order.risk_score}`}
                  color={order.risk_level === 'critical' ? 'error' : order.risk_level === 'high' ? 'warning' : 'success'}
                />
                <Chip label={order.risk_level.toUpperCase()} />
              </Box>
              {order.risk_factors.length > 0 && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', mt: 1 }}>
                    {t('admin.orders.riskFactors', 'Risk Factors')}:
                  </Typography>
                  {order.risk_factors.map((factor, idx) => (
                    <Typography key={idx} variant="body2">
                      • {factor}
                    </Typography>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('admin.orders.client', 'Client')}
              </Typography>
              {order.client?.user && (
                <>
                  <Typography variant="body2">
                    {order.client.user.first_name} {order.client.user.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.client.user.email}
                  </Typography>
                  {order.client.user.phone_number && (
                    <Typography variant="body2" color="text.secondary">
                      {order.client.user.phone_number}
                    </Typography>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('admin.orders.business', 'Business')}
              </Typography>
              {order.business_location && (
                <>
                  <Typography variant="body2">{order.business_location.name}</Typography>
                  {order.business_location.email && (
                    <Typography variant="body2" color="text.secondary">
                      {order.business_location.email}
                    </Typography>
                  )}
                  {order.business_location.phone && (
                    <Typography variant="body2" color="text.secondary">
                      {order.business_location.phone}
                    </Typography>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('admin.orders.agent', 'Agent')}
              </Typography>
              {order.assigned_agent?.user ? (
                <>
                  <Typography variant="body2">
                    {order.assigned_agent.user.first_name} {order.assigned_agent.user.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {order.assigned_agent.user.email}
                  </Typography>
                  {order.assigned_agent.user.phone_number && (
                    <Typography variant="body2" color="text.secondary">
                      {order.assigned_agent.user.phone_number}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('admin.orders.noAgent', 'No agent assigned')}
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Tabs value={activeTab} onChange={(_e, newValue) => setActiveTab(newValue)}>
            <Tab icon={<MessageIcon />} label={t('admin.orders.contact', 'Contact')} />
            <Tab icon={<PersonAddIcon />} label={t('admin.orders.unassign', 'Unassign & Redispatch')} />
            <Tab icon={<EditIcon />} label={t('admin.orders.updateStatus', 'Update Status')} />
            <Tab icon={<NoteAddIcon />} label={t('admin.orders.notes', 'Notes')} />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>{t('admin.orders.recipient', 'Recipient')}</InputLabel>
              <Select
                value={recipientType}
                label={t('admin.orders.recipient', 'Recipient')}
                onChange={(e) => setRecipientType(e.target.value as any)}
              >
                <MenuItem value="client">{t('admin.orders.client', 'Client')}</MenuItem>
                <MenuItem value="business">{t('admin.orders.business', 'Business')}</MenuItem>
                <MenuItem value="agent">{t('admin.orders.agent', 'Agent')}</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                <MessageIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('admin.orders.inAppMessage', 'In-App Message')}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={t('admin.orders.messagePlaceholder', 'Type your message...')}
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                startIcon={<MessageIcon />}
                onClick={handleSendMessage}
                disabled={sendMessage.isPending || !messageText.trim()}
              >
                {t('admin.orders.sendMessage', 'Send Message')}
              </Button>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                <EmailIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('admin.orders.email', 'Email')}
              </Typography>
              <TextField
                fullWidth
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={t('admin.orders.emailSubject', 'Subject')}
                sx={{ mb: 1 }}
                size="small"
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
                onClick={handleSendEmail}
                disabled={sendEmail.isPending || !emailSubject.trim() || !emailBody.trim()}
              >
                {t('admin.orders.sendEmail', 'Send Email')}
              </Button>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                <SmsIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('admin.orders.sms', 'SMS')}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={2}
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder={t('admin.orders.smsPlaceholder', 'SMS message...')}
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                startIcon={<SmsIcon />}
                onClick={handleSendSms}
                disabled={sendSms.isPending || !smsText.trim()}
              >
                {t('admin.orders.sendSms', 'Send SMS')}
              </Button>
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Alert severity="info" sx={{ mb: 2 }}>
              {t(
                'admin.orders.unassignInfo',
                'Unassigns the current agent and automatically redispatches to nearby available agents. If no agents are found after exhausting dispatch rounds, the client will be notified with the option to switch to store pickup.'
              )}
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={unassignReason}
              onChange={(e) => setUnassignReason(e.target.value)}
              label={t('admin.orders.unassignReason', 'Reason for unassigning (optional)')}
              placeholder={t(
                'admin.orders.unassignReasonPlaceholder',
                'E.g., Current agent is unable to complete delivery...'
              )}
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              onClick={handleUnassignRedispatch}
              disabled={unassignRedispatch.isPending}
            >
              {t('admin.orders.unassignRedispatch', 'Unassign & Redispatch')}
            </Button>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t(
                'admin.orders.statusWarning',
                'Cancel releases payment holds and restores inventory. Pickup, delivery, and refund statuses must use their dedicated flows so money is not skipped.'
              )}
            </Alert>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t('admin.orders.newStatus', 'New Status')}</InputLabel>
              <Select
                value={newStatus}
                label={t('admin.orders.newStatus', 'New Status')}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="preparing">Preparing</MenuItem>
                <MenuItem value="ready_for_pickup">Ready for Pickup</MenuItem>
                <MenuItem value="assigned_to_agent">Assigned to Agent</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              label={t('admin.orders.statusNotes', 'Notes (optional)')}
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              onClick={handleUpdateStatus}
              disabled={updateStatus.isPending || !newStatus}
            >
              {t('admin.orders.updateStatusButton', 'Update Status')}
            </Button>
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              label={t('admin.orders.adminNote', 'Admin Note')}
              placeholder={t('admin.orders.notePlaceholder', 'Add internal note about this order...')}
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              onClick={handleAddNote}
              disabled={addNote.isPending || !adminNote.trim()}
            >
              {t('admin.orders.addNote', 'Add Note')}
            </Button>
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('common.close', 'Close')}</Button>
      </DialogActions>
    </Dialog>
  );
};
