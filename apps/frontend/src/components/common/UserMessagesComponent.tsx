import { Close, ExpandMore, Info, Message, Send } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderMessage, useOrderMessages } from '../../hooks/useOrderMessages';
import { UserMessage, useUserMessages } from '../../hooks/useUserMessages';
import { RichTextEditor } from './RichTextEditor';

interface UserMessagesComponentProps {
  /** The type of entity (e.g., 'order', 'item', 'business', etc.) */
  entityType: string;
  /** The ID of the entity */
  entityId: string;
  /** Optional title for the messages section */
  title?: string;
  /** Whether to show messages expanded by default */
  defaultExpanded?: boolean;
  /** Maximum number of messages to show before requiring "View All" */
  maxVisibleMessages?: number;
  /** Whether to show in compact mode (fewer details) */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

export const UserMessagesComponent: React.FC<UserMessagesComponentProps> = ({
  entityType,
  entityId,
  title,
  defaultExpanded = false,
  maxVisibleMessages = 3,
  compact = false,
  className,
}) => {
  const { t } = useTranslation();
  const isOrder = entityType === 'order';

  // Use order-specific hook for orders, otherwise use general user messages hook
  const orderMessagesHook = useOrderMessages();
  const userMessagesHook = useUserMessages();

  // Select the appropriate hook based on entity type
  const messagesHook = isOrder ? orderMessagesHook : userMessagesHook;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [viewAllDialog, setViewAllDialog] = useState(false);

  // Get messages - for orders, use the messages directly; for others, filter by entity
  const entityMessages = isOrder
    ? (messagesHook.messages as OrderMessage[])
    : (userMessagesHook.getMessagesForEntity(
        entityType,
        entityId
      ) as UserMessage[]);

  // Convert OrderMessage to UserMessage format for consistent display
  const normalizedMessages: UserMessage[] = entityMessages.map((msg) => ({
    id: msg.id,
    user_id: msg.user_id,
    entity_type: msg.entity_type,
    entity_id: msg.entity_id,
    message: msg.message,
    created_at: msg.created_at,
    updated_at: msg.updated_at,
    user: {
      id: msg.user?.id || '',
      first_name: msg.user?.first_name || '',
      last_name: msg.user?.last_name || '',
      email: msg.user?.email || '',
    },
    entity_type_info: msg.entity_type_info,
  }));

  const visibleMessages = expanded
    ? normalizedMessages.slice(0, maxVisibleMessages)
    : [];
  const hasMoreMessages = normalizedMessages.length > maxVisibleMessages;

  // Fetch messages when component mounts or entity changes
  useEffect(() => {
    if (isOrder && entityId) {
      // For orders, explicitly fetch messages
      orderMessagesHook.fetchMessages(entityId);
    }
    // For other entity types, the useUserMessages hook handles fetching automatically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, isOrder]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      let success = false;
      if (isOrder) {
        // Use order-specific message sending
        success = await orderMessagesHook.sendMessage(
          entityId,
          newMessage.trim()
        );
      } else {
        // Use general message sending
        success = await userMessagesHook.createMessage(
          entityType,
          entityId,
          newMessage.trim()
        );
      }

      if (success) {
        setNewMessage('');
        // Ensure messages section is expanded after sending
        if (!expanded) {
          setExpanded(true);
        }
        // Refresh messages for orders
        if (isOrder) {
          await orderMessagesHook.refetch(entityId);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  }, [
    newMessage,
    entityType,
    entityId,
    isOrder,
    orderMessagesHook,
    userMessagesHook,
    sending,
    expanded,
  ]);

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
  };

  const handleViewAll = () => {
    setViewAllDialog(true);
  };

  const handleCloseViewAll = () => {
    setViewAllDialog(false);
  };

  const formatMessageText = (text: string) => {
    // Simple markdown-like formatting for display
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\n/g, '<br>');
  };

  // Use error from the appropriate hook
  const error = messagesHook.error;

  if (error) {
    return (
      <Box className={className} sx={{ mt: 2 }}>
        <Typography variant="body2" color="error">
          {t('messages.error', 'Failed to load messages')}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box className={className} sx={{ mt: 2 }}>
        <Card
          variant="outlined"
          sx={{ border: '1px solid', borderColor: 'divider' }}
        >
          <CardContent sx={{ pb: compact ? 1 : 2 }}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: expanded ? 2 : 0,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Message color="action" fontSize="small" />
                <Typography
                  variant={compact ? 'body2' : 'subtitle2'}
                  fontWeight="medium"
                >
                  {title || t('messages.title', 'Messages')}
                </Typography>
                {normalizedMessages.length > 0 && (
                  <Chip
                    label={normalizedMessages.length}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Box>
              <IconButton
                size="small"
                onClick={handleToggleExpanded}
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease-in-out',
                }}
              >
                <ExpandMore />
              </IconButton>
            </Box>

            {/* Messages Content */}
            <Collapse in={expanded}>
              <Box>
                {/* Messages List */}
                {visibleMessages.length > 0 ? (
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    {visibleMessages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          p: compact ? 1 : 1.5,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            mb: 0.5,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {message.user?.first_name} {message.user?.last_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {isOrder
                              ? new Date(message.created_at).toLocaleString()
                              : userMessagesHook.formatDate(message.created_at)}
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            wordBreak: 'break-word',
                            '& strong': { fontWeight: 'bold' },
                            '& em': { fontStyle: 'italic' },
                            '& del': { textDecoration: 'line-through' },
                            '& code': {
                              bgcolor: 'grey.100',
                              p: '2px 4px',
                              borderRadius: 1,
                              fontFamily: 'monospace',
                              fontSize: '0.85em',
                            },
                            '& blockquote': {
                              borderLeft: '3px solid',
                              borderColor: 'grey.300',
                              pl: 1,
                              ml: 0,
                              fontStyle: 'italic',
                              color: 'text.secondary',
                            },
                          }}
                          dangerouslySetInnerHTML={{
                            __html: formatMessageText(message.message),
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Box sx={{ py: 2 }}>
                    <Alert
                      icon={<Info />}
                      severity="info"
                      sx={{
                        mb: 2,
                        '& .MuiAlert-message': {
                          width: '100%',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ mb: 1, fontWeight: 'medium' }}
                      >
                        {t(
                          'messages.startConversation',
                          'Start a conversation'
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'messages.conversationPrompt',
                          'Use this messaging feature to communicate with other parties involved. Ask questions, provide updates, or share important information about this order.'
                        )}
                      </Typography>
                    </Alert>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: 'center' }}
                    >
                      {t('messages.noMessages', 'No messages yet')}
                    </Typography>
                  </Box>
                )}

                {/* View All Button */}
                {hasMoreMessages && (
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Button size="small" variant="text" onClick={handleViewAll}>
                      {t('messages.viewAll', 'View All Messages')} (
                      {normalizedMessages.length})
                    </Button>
                  </Box>
                )}

                {/* Divider */}
                {(visibleMessages.length > 0 || hasMoreMessages) && (
                  <Divider sx={{ mb: 2 }} />
                )}

                {/* New Message Input */}
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ mb: 1, fontWeight: 'medium' }}
                  >
                    {t('messages.addNew', 'Add Message')}
                  </Typography>
                  <RichTextEditor
                    value={newMessage}
                    onChange={setNewMessage}
                    placeholder={t(
                      'messages.placeholder',
                      'Type your message...'
                    )}
                    disabled={sending}
                  />
                  <Box
                    sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}
                  >
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Send />}
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                    >
                      {sending
                        ? t('messages.sending', 'Sending...')
                        : t('messages.send', 'Send')}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </Box>

      {/* View All Messages Dialog */}
      <Dialog
        open={viewAllDialog}
        onClose={handleCloseViewAll}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6">
              {t('messages.allMessages', 'All Messages')} (
              {normalizedMessages.length})
            </Typography>
            <IconButton onClick={handleCloseViewAll}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {normalizedMessages.length > 0 ? (
            <Stack spacing={2}>
              {normalizedMessages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    p: 2,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight="medium">
                      {message.user?.first_name} {message.user?.last_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isOrder
                        ? new Date(message.created_at).toLocaleString()
                        : userMessagesHook.formatDate(message.created_at)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      wordBreak: 'break-word',
                      '& strong': { fontWeight: 'bold' },
                      '& em': { fontStyle: 'italic' },
                      '& del': { textDecoration: 'line-through' },
                      '& code': {
                        bgcolor: 'grey.100',
                        p: '2px 4px',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.85em',
                      },
                      '& blockquote': {
                        borderLeft: '3px solid',
                        borderColor: 'grey.300',
                        pl: 1,
                        ml: 0,
                        fontStyle: 'italic',
                        color: 'text.secondary',
                      },
                    }}
                    dangerouslySetInnerHTML={{
                      __html: formatMessageText(message.message),
                    }}
                  />
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ textAlign: 'center', py: 4 }}
            >
              {t('messages.noMessages', 'No messages yet')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseViewAll}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UserMessagesComponent;

