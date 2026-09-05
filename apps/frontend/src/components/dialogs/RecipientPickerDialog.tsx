import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { Add, Person } from '@mui/icons-material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecipients, type SavedRecipient } from '../../hooks/useRecipients';

interface RecipientPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (recipient: SavedRecipient | null) => void;
  fulfillmentCountry?: string | null;
}

const RecipientPickerDialog: React.FC<RecipientPickerDialogProps> = ({
  open,
  onClose,
  onSelect,
  fulfillmentCountry,
}) => {
  const { t } = useTranslation();
  const { data: recipients, isLoading, error } = useRecipients(
    fulfillmentCountry || undefined
  );

  const handleSelect = (recipient: SavedRecipient | null) => {
    onSelect(recipient);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('checkout.recipient.selectSaved', 'Select a recipient')}
      </DialogTitle>
      <DialogContent>
        {isLoading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t(
              'checkout.recipient.loadError',
              'Failed to load saved recipients'
            )}
          </Alert>
        )}
        {!isLoading && !error && recipients && recipients.length === 0 && (
          <Typography color="text.secondary" textAlign="center" py={3}>
            {t(
              'checkout.recipient.noSaved',
              'No saved recipients yet. Add one below.'
            )}
          </Typography>
        )}
        {!isLoading && !error && recipients && recipients.length > 0 && (
          <List>
            {recipients.map((recipient) => (
              <ListItem key={recipient.id} disablePadding>
                <ListItemButton onClick={() => handleSelect(recipient)}>
                  <ListItemText
                    primary={recipient.name}
                    secondary={`${recipient.phone}${
                      recipient.notify_whatsapp
                        ? ` • ${t('checkout.recipient.whatsappEnabled', 'WhatsApp')}`
                        : ''
                    }`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
        <Button
          fullWidth
          variant="outlined"
          startIcon={<Add />}
          onClick={() => handleSelect(null)}
          sx={{ mt: 2 }}
        >
          {t('checkout.recipient.addNew', 'Add new recipient')}
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecipientPickerDialog;
