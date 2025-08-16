import React from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import {
  Close,
  Send,
} from '@mui/icons-material';
import { UserMessage } from '../../hooks/useUserMessages';
import { RichTextEditor } from './RichTextEditor';

interface MessageDetailDialogProps {
  open: boolean;
  message: UserMessage | null;
  onClose: () => void;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onReply: () => void;
}

export const MessageDetailDialog: React.FC<MessageDetailDialogProps> = ({
  open,
  message,
  onClose,
  replyContent,
  onReplyContentChange,
  onReply,
}) => {
  if (!message) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Message Details</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Message Header */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {message.user?.first_name} {message.user?.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {message.user?.email}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip
                label={message.entity_type_info?.comment || message.entity_type}
                size="small"
                color="primary"
              />
              <Chip
                label={`ID: ${message.entity_id}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>
          
          <Typography variant="caption" color="text.secondary">
            Sent on {new Date(message.created_at).toLocaleString()}
          </Typography>
        </Box>

        <Divider />

        {/* Message Content */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Typography variant="subtitle2" gutterBottom>
            Message:
          </Typography>
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.200',
              maxHeight: '200px',
              overflow: 'auto',
            }}
          >
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {message.message}
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Reply Section */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Typography variant="subtitle2" gutterBottom>
            Reply:
          </Typography>
          <Box sx={{ height: '200px' }}>
            <RichTextEditor
              value={replyContent}
              onChange={onReplyContentChange}
              placeholder="Type your reply here..."
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} startIcon={<Close />}>
          Cancel
        </Button>
        <Button
          onClick={onReply}
          variant="contained"
          startIcon={<Send />}
          disabled={!replyContent.trim()}
        >
          Send Reply
        </Button>
      </DialogActions>
    </Dialog>
  );
};
