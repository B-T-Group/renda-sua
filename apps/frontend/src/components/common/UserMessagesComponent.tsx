import { Close, ExpandMore, Info, Message, Send } from '@mui/icons-material';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrderParticipants } from '../../hooks/useOrderParticipants';
import type { MentionableParticipant, OrderMessage } from '../../hooks/useOrderMessages';
import { useOrderMessages } from '../../hooks/useOrderMessages';
import { useUserMessages, type UserMessage } from '../../hooks/useUserMessages';
import { MessageRenderer } from '../messaging/MessageRenderer';
import { MentionPicker } from './MentionPicker';
import { PersonaBadge } from './PersonaBadge';
import { RichTextEditor } from './RichTextEditor';

interface UserMessagesComponentProps {
  entityType: string;
  entityId: string;
  title?: string;
  defaultExpanded?: boolean;
  maxVisibleMessages?: number;
  compact?: boolean;
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

  const orderMessagesHook = useOrderMessages();
  const userMessagesHook = useUserMessages();
  const { participants, loading: participantsLoading } = useOrderParticipants(
    isOrder ? entityId : null
  );

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [viewAllDialog, setViewAllDialog] = useState(false);

  // Mention state
  const [selectedMention, setSelectedMention] = useState<MentionableParticipant | null>(null);
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const composerRef = useRef<HTMLDivElement | null>(null);

  const entityMessages = isOrder
    ? (orderMessagesHook.messages as OrderMessage[])
    : (userMessagesHook.getMessagesForEntity(entityType, entityId) as UserMessage[]);

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

  const visibleMessages = expanded ? normalizedMessages.slice(0, maxVisibleMessages) : [];
  const hasMoreMessages = normalizedMessages.length > maxVisibleMessages;

  useEffect(() => {
    if (isOrder && entityId) {
      orderMessagesHook.fetchMessages(entityId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, isOrder]);

  useEffect(() => {
    if (isOrder && expanded && entityMessages.length > 0) {
      const lastMessage = entityMessages[0];
      orderMessagesHook.markMessagesRead(entityId, lastMessage.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, isOrder]);

  const handleMessageChange = useCallback(
    (text: string) => {
      setNewMessage(text);

      if (!isOrder) return;

      const atIndex = text.lastIndexOf('@');
      if (atIndex !== -1 && atIndex === text.length - 1) {
        setMentionPickerOpen(true);
        setMentionQuery('');
      } else if (mentionPickerOpen && atIndex !== -1) {
        const afterAt = text.slice(atIndex + 1);
        if (!afterAt.includes(' ')) {
          setMentionQuery(afterAt);
        } else {
          setMentionPickerOpen(false);
        }
      } else {
        setMentionPickerOpen(false);
      }
    },
    [isOrder, mentionPickerOpen]
  );

  const handleMentionSelect = useCallback(
    (participant: MentionableParticipant) => {
      setSelectedMention(participant);
      setMentionPickerOpen(false);
      const atIndex = newMessage.lastIndexOf('@');
      if (atIndex !== -1) {
        setNewMessage(newMessage.slice(0, atIndex));
      }
    },
    [newMessage]
  );

  const handleClearMention = useCallback(() => {
    setSelectedMention(null);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      let success = false;
      if (isOrder) {
        success = await orderMessagesHook.sendMessage(
          entityId,
          newMessage.trim(),
          selectedMention?.userId
        );
      } else {
        success = await userMessagesHook.createMessage(entityType, entityId, newMessage.trim());
      }

      if (success) {
        setNewMessage('');
        setSelectedMention(null);
        if (!expanded) setExpanded(true);
        if (isOrder) await orderMessagesHook.refetch(entityId);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
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
    selectedMention,
  ]);

  const formatMessageText = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\n/g, '<br>');

  const getOrderMessage = (msg: UserMessage): OrderMessage | undefined =>
    isOrder
      ? (entityMessages as OrderMessage[]).find((m) => m.id === msg.id)
      : undefined;

  const error = isOrder ? orderMessagesHook.error : userMessagesHook.error;

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
        <Card variant="outlined" sx={{ border: '1px solid', borderColor: 'divider' }}>
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
                <Typography variant={compact ? 'body2' : 'subtitle2'} fontWeight="medium">
                  {title || t('messages.title', 'Messages')}
                </Typography>
                {normalizedMessages.length > 0 && (
                  <Badge
                    badgeContent={normalizedMessages.length}
                    color="primary"
                    max={99}
                    sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
                  >
                    <span />
                  </Badge>
                )}
              </Box>
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease-in-out',
                }}
                aria-label={
                  expanded
                    ? t('messages.collapse', 'Collapse messages')
                    : t('messages.expand', 'Expand messages')
                }
              >
                <ExpandMore />
              </IconButton>
            </Box>

            <Collapse in={expanded}>
              <Box>
                {visibleMessages.length > 0 ? (
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    {visibleMessages.map((message) => {
                      const orderMsg = getOrderMessage(message);
                      return (
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
                              alignItems: 'center',
                              mb: 0.5,
                              gap: 1,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {message.user?.first_name} {message.user?.last_name}
                              </Typography>
                              {orderMsg?.sender_persona && (
                                <PersonaBadge persona={orderMsg.sender_persona} />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {isOrder
                                ? new Date(message.created_at).toLocaleString()
                                : userMessagesHook.formatDate(message.created_at)}
                            </Typography>
                          </Box>
                          {orderMsg?.mention && (
                            <Box sx={{ mb: 0.5 }}>
                              <MentionChip
                                displayName={orderMsg.mention.displayName}
                                persona={orderMsg.mention.persona}
                              />
                            </Box>
                          )}
                          {orderMsg?.message_type === 'DELIVERY_PIN' && orderMsg ? (
                            <MessageRenderer message={orderMsg} compact={compact} />
                          ) : (
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
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ py: 2 }}>
                    <Alert icon={<Info />} severity="info" sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                        {t('messages.startConversation', 'Start a conversation')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(
                          'messages.conversationPrompt',
                          'Use this messaging feature to communicate with other parties involved.'
                        )}
                      </Typography>
                    </Alert>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                      {t('messages.noMessages', 'No messages yet')}
                    </Typography>
                  </Box>
                )}

                {hasMoreMessages && (
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Button size="small" variant="text" onClick={() => setViewAllDialog(true)}>
                      {t('messages.viewAll', 'View All Messages')} ({normalizedMessages.length})
                    </Button>
                  </Box>
                )}

                {(visibleMessages.length > 0 || hasMoreMessages) && <Divider sx={{ mb: 2 }} />}

                {/* Composer */}
                <Box ref={composerRef}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                    {t('messages.addNew', 'Add Message')}
                  </Typography>

                  {selectedMention && (
                    <Box sx={{ mb: 1 }}>
                      <MentionChip
                        displayName={selectedMention.displayName}
                        persona={selectedMention.persona}
                        onDelete={handleClearMention}
                      />
                    </Box>
                  )}

                  <MentionPicker
                    anchorEl={composerRef.current}
                    open={mentionPickerOpen && isOrder}
                    participants={participants}
                    loading={participantsLoading}
                    query={mentionQuery}
                    onSelect={handleMentionSelect}
                    onClose={() => setMentionPickerOpen(false)}
                  />

                  <RichTextEditor
                    value={newMessage}
                    onChange={handleMessageChange}
                    placeholder={
                      isOrder
                        ? t('messages.mentionPlaceholder', 'Type your message... Use @ to mention')
                        : t('messages.placeholder', 'Type your message...')
                    }
                    disabled={sending}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<Send />}
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                    >
                      {sending ? t('messages.sending', 'Sending...') : t('messages.send', 'Send')}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Collapse>
          </CardContent>
        </Card>
      </Box>

      {/* View All Dialog */}
      <Dialog open={viewAllDialog} onClose={() => setViewAllDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {t('messages.allMessages', 'All Messages')} ({normalizedMessages.length})
            </Typography>
            <IconButton onClick={() => setViewAllDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {normalizedMessages.length > 0 ? (
            <Stack spacing={2}>
              {normalizedMessages.map((message) => {
                const orderMsg = getOrderMessage(message);
                return (
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
                        alignItems: 'center',
                        mb: 1,
                        gap: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight="medium">
                          {message.user?.first_name} {message.user?.last_name}
                        </Typography>
                        {orderMsg?.sender_persona && (
                          <PersonaBadge persona={orderMsg.sender_persona} />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {isOrder
                          ? new Date(message.created_at).toLocaleString()
                          : userMessagesHook.formatDate(message.created_at)}
                      </Typography>
                    </Box>
                    {orderMsg?.mention && (
                      <Box sx={{ mb: 0.5 }}>
                        <MentionChip
                          displayName={orderMsg.mention.displayName}
                          persona={orderMsg.mention.persona}
                        />
                      </Box>
                    )}
                    {orderMsg?.message_type === 'DELIVERY_PIN' && orderMsg ? (
                      <MessageRenderer message={orderMsg} />
                    ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        wordBreak: 'break-word',
                        '& strong': { fontWeight: 'bold' },
                        '& em': { fontStyle: 'italic' },
                      }}
                      dangerouslySetInnerHTML={{
                        __html: formatMessageText(message.message),
                      }}
                    />
                    )}
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              {t('messages.noMessages', 'No messages yet')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewAllDialog(false)}>{t('common.close', 'Close')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UserMessagesComponent;
