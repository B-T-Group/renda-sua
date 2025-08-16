import React, { useCallback, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Message,
} from '@mui/icons-material';
import { useUserMessages, UserMessage } from '../../hooks/useUserMessages';

interface UserMessageListProps {
  entityType?: string;
  entityId?: string;
  className?: string;
}

export const UserMessageList: React.FC<UserMessageListProps> = ({
  entityType,
  entityId,
  className,
}) => {
  const {
    messages,
    entityTypes,
    loading,
    error,
    createMessage,
    updateMessage,
    deleteMessage,
    getMessagesForEntity,
    formatDate,
  } = useUserMessages();

  const [newMessage, setNewMessage] = useState('');
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    message: UserMessage | null;
    text: string;
  }>({ open: false, message: null, text: '' });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    message: UserMessage | null;
  }>({ open: false, message: null });

  // Filter messages for specific entity if provided
  const filteredMessages = entityType && entityId
    ? getMessagesForEntity(entityType, entityId)
    : messages;

  const handleCreateMessage = useCallback(async () => {
    if (!newMessage.trim() || !entityType || !entityId) return;

    const success = await createMessage(entityType, entityId, newMessage.trim());
    if (success) {
      setNewMessage('');
    }
  }, [newMessage, entityType, entityId, createMessage]);

  const handleEdit = useCallback((message: UserMessage) => {
    setEditDialog({ open: true, message, text: message.message });
  }, []);

  const handleConfirmEdit = useCallback(async () => {
    if (!editDialog.message) return;

    const success = await updateMessage(editDialog.message.id, editDialog.text);
    if (success) {
      setEditDialog({ open: false, message: null, text: '' });
    }
  }, [editDialog.message, editDialog.text, updateMessage]);

  const handleDelete = useCallback((message: UserMessage) => {
    setDeleteDialog({ open: true, message });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog.message) return;

    const success = await deleteMessage(deleteDialog.message.id);
    if (success) {
      setDeleteDialog({ open: false, message: null });
    }
  }, [deleteDialog.message, deleteMessage]);

  const getEntityTypeLabel = useCallback((entityTypeId: string) => {
    const entityType = entityTypes.find(et => et.id === entityTypeId);
    return entityType?.comment || entityTypeId;
  }, [entityTypes]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent>
          <Typography>Loading messages...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent>
          <Typography color="error">Error: {error}</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box className={className}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Message sx={{ mr: 1, verticalAlign: 'middle' }} />
            Messages ({filteredMessages.length})
          </Typography>

          {/* Create new message */}
          {entityType && entityId && (
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Add a message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message here..."
                sx={{ mb: 1 }}
              />
              <Stack direction="row" justifyContent="flex-end">
                <IconButton
                  color="primary"
                  onClick={handleCreateMessage}
                  disabled={!newMessage.trim()}
                >
                  <Add />
                </IconButton>
              </Stack>
            </Box>
          )}

          {/* Messages list */}
          <Stack spacing={2}>
            {filteredMessages.length === 0 ? (
              <Typography color="text.secondary" align="center">
                No messages found
              </Typography>
            ) : (
              filteredMessages.map((message) => (
                <Card key={message.id} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {message.user?.first_name} {message.user?.last_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(message.created_at)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <IconButton size="small" onClick={() => handleEdit(message)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(message)}>
                          <Delete />
                        </IconButton>
                      </Stack>
                    </Box>
                    
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      {message.message}
                    </Typography>

                    <Stack direction="row" spacing={1}>
                      <Chip
                        label={getEntityTypeLabel(message.entity_type)}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={`ID: ${message.entity_id}`}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, message: null, text: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Message</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Message"
            value={editDialog.text}
            onChange={(e) => setEditDialog(prev => ({ ...prev, text: e.target.value }))}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setEditDialog({ open: false, message: null, text: '' })}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirmEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, message: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Message</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this message? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, message: null })}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
