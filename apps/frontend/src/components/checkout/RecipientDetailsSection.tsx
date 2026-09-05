import { Lock, Person, Add } from '@mui/icons-material';
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
import type { RecipientDraft } from '../../utils/diasporaCheckout';
import RecipientPickerDialog from '../dialogs/RecipientPickerDialog';
import RecipientFormDialog from '../dialogs/RecipientFormDialog';
import type { SavedRecipient, CreateRecipientDto } from '../../hooks/useRecipients';
import { useCreateRecipient } from '../../hooks/useRecipients';

interface RecipientDetailsSectionProps {
  recipient: RecipientDraft;
  onChange: (recipient: RecipientDraft & { recipient_id?: string }) => void;
  /** Delivery country, used to default the phone country selector. */
  fulfillmentCountry?: string | null;
  /** Server-side blocker for the recipient block, when preflight rejected it. */
  errorMessage?: string | null;
  disabled?: boolean;
}

/**
 * Picker-first recipient selector for diaspora orders.
 * User must select from saved recipients OR add new before placing order.
 */
const RecipientDetailsSection: React.FC<RecipientDetailsSectionProps> = ({
  recipient,
  onChange,
  fulfillmentCountry,
  errorMessage,
  disabled,
}) => {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const createMutation = useCreateRecipient();

  const hasSelectedRecipient = Boolean(
    recipient.name.trim() && recipient.phone.trim()
  );

  const handleSelectRecipient = (saved: SavedRecipient | null) => {
    if (saved) {
      // User selected an existing saved recipient
      onChange({
        name: saved.name,
        phone: saved.phone,
        notifyWhatsapp: saved.notify_whatsapp,
        recipient_id: saved.id,
      });
    } else {
      // User wants to add a new recipient
      setFormDialogOpen(true);
    }
  };

  const handleSaveNewRecipient = async (data: CreateRecipientDto) => {
    try {
      const saved = await createMutation.mutateAsync(data);
      // After creating, select the newly saved recipient
      onChange({
        name: saved.name,
        phone: saved.phone,
        notifyWhatsapp: saved.notify_whatsapp,
        recipient_id: saved.id,
      });
      setFormDialogOpen(false);
    } catch (error) {
      console.error('Failed to create recipient:', error);
    }
  };

  const handleChangeRecipient = () => {
    setPickerOpen(true);
  };

  return (
    <Card variant="outlined" sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
          {t('checkout.recipient.title', 'Who is receiving this order?')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'checkout.recipient.subtitle',
            'They get tracking updates and the delivery code by text — no Rendasua account needed.'
          )}
        </Typography>

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {!hasSelectedRecipient ? (
          // No recipient selected yet - show selection prompt
          <Box textAlign="center" py={3}>
            <Person sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" fontWeight={500} gutterBottom>
              {t('checkout.recipient.selectPrompt', 'Select a recipient for this order')}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              {t(
                'checkout.recipient.selectRequired',
                'Required before you can place your order'
              )}
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<Person />}
                onClick={() => setPickerOpen(true)}
                disabled={disabled}
              >
                {t('checkout.recipient.selectSaved', 'Select saved recipient')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setFormDialogOpen(true)}
                disabled={disabled}
              >
                {t('checkout.recipient.addNew', 'Add new')}
              </Button>
            </Stack>
          </Box>
        ) : (
          // Recipient selected - show summary with change option
          <Box>
            <Card variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    {recipient.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {recipient.phone}
                  </Typography>
                  {recipient.notifyWhatsapp && (
                    <Chip
                      label={t('checkout.recipient.whatsappEnabled', 'WhatsApp')}
                      size="small"
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
                <Button
                  size="small"
                  onClick={handleChangeRecipient}
                  disabled={disabled}
                >
                  {t('common.change', 'Change')}
                </Button>
              </Stack>
            </Card>
            <Alert severity="info" icon={<Lock fontSize="inherit" />}>
              {t(
                'checkout.recipient.pinNotice',
                'The recipient receives their own delivery code and gives it to the agent at handover. You can still see it in your order.'
              )}
            </Alert>
          </Box>
        )}
      </CardContent>

      <RecipientPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectRecipient}
        fulfillmentCountry={fulfillmentCountry}
      />

      <RecipientFormDialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        onSave={handleSaveNewRecipient}
        recipient={null}
        loading={createMutation.isPending}
      />
    </Card>
  );
};

export default RecipientDetailsSection;
