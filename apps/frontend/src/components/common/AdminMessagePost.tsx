import { Message, Send } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';
import {
  AdminMessageRequest,
  useAdminMessage,
} from '../../hooks/useAdminMessage';
import { useUserMessages } from '../../hooks/useUserMessages';
import { RichTextEditor } from './RichTextEditor';

interface AdminMessagePostProps {
  entityType?: string;
  entityId?: string;
  onMessageSent?: () => void;
}

export const AdminMessagePost: React.FC<AdminMessagePostProps> = ({
  entityType,
  entityId,
  onMessageSent,
}) => {
  const { postMessage, loading, error } = useAdminMessage();
  const { entityTypes } = useUserMessages();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [messageData, setMessageData] = useState<AdminMessageRequest>({
    entity_type: entityType || '',
    entity_id: entityId || '',
    message: '',
  });

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
    setMessageData({
      entity_type: entityType || '',
      entity_id: entityId || '',
      message: '',
    });
  }, [entityType, entityId]);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setMessageData({
      entity_type: '',
      entity_id: '',
      message: '',
    });
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (
      !messageData.entity_type ||
      !messageData.entity_id ||
      !messageData.message.trim()
    ) {
      return;
    }

    const result = await postMessage(messageData);
    if (result.success) {
      handleCloseDialog();
      onMessageSent?.();
    }
  }, [messageData, postMessage, handleCloseDialog, onMessageSent]);

  return (
    <>
      <Button
        variant="contained"
        startIcon={<Message />}
        onClick={handleOpenDialog}
        disabled={loading}
      >
        Post Message
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Message />
            Post Admin Message
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Entity Type</InputLabel>
              <Select
                value={messageData.entity_type}
                onChange={(e) =>
                  setMessageData((prev) => ({
                    ...prev,
                    entity_type: e.target.value,
                  }))
                }
                label="Entity Type"
              >
                {entityTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.comment}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Entity ID"
              value={messageData.entity_id}
              onChange={(e) =>
                setMessageData((prev) => ({
                  ...prev,
                  entity_id: e.target.value,
                }))
              }
              placeholder="Enter the entity ID (UUID)"
              fullWidth
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Message:
              </Typography>
              <RichTextEditor
                value={messageData.message}
                onChange={(content) =>
                  setMessageData((prev) => ({ ...prev, message: content }))
                }
                placeholder="Type your message here..."
              />
            </Box>

            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSendMessage}
            variant="contained"
            startIcon={<Send />}
            disabled={
              loading ||
              !messageData.entity_type ||
              !messageData.entity_id ||
              !messageData.message.trim()
            }
          >
            {loading ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
