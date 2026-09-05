import {
  Add,
  Delete,
  Edit,
  FilterList,
  Person,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useRecipients,
  useCreateRecipient,
  useUpdateRecipient,
  useDeleteRecipient,
  type SavedRecipient,
  type CreateRecipientDto,
  type UpdateRecipientDto,
} from '../../hooks/useRecipients';
import RecipientFormDialog from '../dialogs/RecipientFormDialog';

const SUPPORTED_COUNTRIES = [
  { code: '', name: 'All Countries' },
  { code: 'GA', name: 'Gabon' },
  { code: 'CM', name: 'Cameroon' },
];

const SavedRecipientsPage: React.FC = () => {
  const { t } = useTranslation();
  const [countryFilter, setCountryFilter] = useState('');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<SavedRecipient | null>(null);

  const { data: recipients, isLoading, error } = useRecipients(countryFilter || undefined);
  const createMutation = useCreateRecipient();
  const updateMutation = useUpdateRecipient();
  const deleteMutation = useDeleteRecipient();

  const handleAdd = () => {
    setSelectedRecipient(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (recipient: SavedRecipient) => {
    setSelectedRecipient(recipient);
    setFormDialogOpen(true);
  };

  const handleDelete = (recipient: SavedRecipient) => {
    setSelectedRecipient(recipient);
    setDeleteDialogOpen(true);
  };

  const handleSave = async (data: CreateRecipientDto | UpdateRecipientDto) => {
    try {
      if (selectedRecipient) {
        await updateMutation.mutateAsync({
          id: selectedRecipient.id,
          data: data as UpdateRecipientDto,
        });
      } else {
        await createMutation.mutateAsync(data as CreateRecipientDto);
      }
      setFormDialogOpen(false);
    } catch (error) {
      console.error('Failed to save recipient:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedRecipient) return;
    try {
      await deleteMutation.mutateAsync(selectedRecipient.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete recipient:', error);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            {t('recipients.title', 'Saved Recipients')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('recipients.subtitle', 'Manage your saved recipients for diaspora orders')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAdd}
        >
          {t('recipients.addButton', 'Add Recipient')}
        </Button>
      </Stack>

      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <FilterList />
        <Select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          {SUPPORTED_COUNTRIES.map((c) => (
            <MenuItem key={c.code} value={c.code}>
              {c.name}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      {isLoading && (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {t('recipients.loadError', 'Failed to load recipients')}
        </Alert>
      )}

      {!isLoading && !error && recipients && recipients.length === 0 && (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <Person sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t('recipients.empty', 'No saved recipients yet')}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {t('recipients.emptySubtitle', 'Add recipients to quickly fill checkout forms')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAdd}
              >
                {t('recipients.addFirst', 'Add Your First Recipient')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && recipients && recipients.length > 0 && (
        <List>
          {recipients.map((recipient) => (
            <Card key={recipient.id} sx={{ mb: 2 }}>
              <ListItem
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      edge="end"
                      onClick={() => handleEdit(recipient)}
                      aria-label="edit"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      onClick={() => handleDelete(recipient)}
                      aria-label="delete"
                    >
                      <Delete />
                    </IconButton>
                  </Stack>
                }
              >
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {recipient.name}
                      </Typography>
                      <Chip
                        label={recipient.country}
                        size="small"
                        variant="outlined"
                      />
                      {recipient.notify_whatsapp && (
                        <Chip
                          label={t('recipients.whatsappChip', 'WhatsApp')}
                          size="small"
                          color="primary"
                        />
                      )}
                    </Stack>
                  }
                  secondary={recipient.phone}
                />
              </ListItem>
            </Card>
          ))}
        </List>
      )}

      <RecipientFormDialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        onSave={handleSave}
        recipient={selectedRecipient}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>
          {t('recipients.deleteTitle', 'Delete Recipient?')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(
              'recipients.deleteConfirm',
              'Are you sure you want to delete {{name}}? This action cannot be undone.',
              { name: selectedRecipient?.name }
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            disabled={deleteMutation.isPending}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SavedRecipientsPage;
