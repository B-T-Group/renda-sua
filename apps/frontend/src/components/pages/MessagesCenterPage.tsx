import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  ExpandMore,
  Message,
  Reply,
  Send,
} from '@mui/icons-material';
import { useUserMessages, UserMessage } from '../../hooks/useUserMessages';
import { MessageDetailDialog } from '../common/MessageDetailDialog';
import { RichTextEditor } from '../common/RichTextEditor';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`messages-tabpanel-${index}`}
      aria-labelledby={`messages-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const MessagesCenterPage: React.FC = () => {
  const {
    messages,
    entityTypes,
    loading,
    error,
    createMessage,
    formatDate,
  } = useUserMessages();

  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<UserMessage | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [expandedEntityIds, setExpandedEntityIds] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const messagesHashRef = useRef<string>('');

  // Group messages by entity type, then by entity ID - memoized to prevent infinite loops
  const messagesByEntityTypeAndId = useMemo(() => {
    return entityTypes.reduce((acc, entityType) => {
      const entityMessages = messages.filter(msg => msg.entity_type === entityType.id);
      if (entityMessages.length > 0) {
        // Group messages by entity_id within this entity type
        const messagesByEntityId = entityMessages.reduce((entityIdAcc, message) => {
          const entityId = message.entity_id;
          if (!entityIdAcc[entityId]) {
            entityIdAcc[entityId] = [];
          }
          entityIdAcc[entityId].push(message);
          return entityIdAcc;
        }, {} as Record<string, UserMessage[]>);

        acc[entityType.id] = {
          entityType,
          messagesByEntityId: Object.entries(messagesByEntityId).map(([entityId, msgs]) => ({
            entityId,
            messages: msgs.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ),
          })),
        };
      }
      return acc;
    }, {} as Record<string, { 
      entityType: any; 
      messagesByEntityId: Array<{ entityId: string; messages: UserMessage[] }> 
    }>);
  }, [entityTypes, messages]);

  const entityTypeEntries = useMemo(() => 
    Object.entries(messagesByEntityTypeAndId),
    [messagesByEntityTypeAndId]
  );

  // Expand all entity IDs by default - only run when messages actually change
  useEffect(() => {
    // Create a hash of message IDs to detect actual changes
    const messagesHash = messages.map(m => m.id).sort().join(',');
    
    // Only initialize if messages have changed and we haven't initialized yet
    if (messagesHashRef.current === messagesHash || messages.length === 0) {
      return;
    }
    
    messagesHashRef.current = messagesHash;
    
    // Create proper keys for accordions
    const accordionKeys = new Set<string>();
    Object.entries(messagesByEntityTypeAndId).forEach(([entityTypeId, { messagesByEntityId }]) => {
      messagesByEntityId.forEach(({ entityId }) => {
        accordionKeys.add(`${entityTypeId}-${entityId}`);
      });
    });
    
    if (accordionKeys.size > 0 && !initializedRef.current) {
      setExpandedEntityIds(accordionKeys);
      initializedRef.current = true;
    }
  }, [messages, messagesByEntityTypeAndId]);

  const handleAccordionChange = useCallback((entityId: string) => {
    setExpandedEntityIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
        newSet.delete(entityId);
      } else {
        newSet.add(entityId);
      }
      return newSet;
    });
  }, []);

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  }, []);

  const handleViewMessage = useCallback((message: UserMessage) => {
    setSelectedMessage(message);
    setDetailDialogOpen(true);
    setReplyContent('');
  }, []);

  const handleReply = useCallback(async () => {
    if (!selectedMessage || !replyContent.trim()) return;

    const success = await createMessage(
      selectedMessage.entity_type,
      selectedMessage.entity_id,
      replyContent.trim()
    );

    if (success) {
      setReplyContent('');
      setDetailDialogOpen(false);
      setSelectedMessage(null);
    }
  }, [selectedMessage, replyContent, createMessage]);

  const handleCloseDialog = useCallback(() => {
    setDetailDialogOpen(false);
    setSelectedMessage(null);
    setReplyContent('');
  }, []);

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" gutterBottom>
            <Message sx={{ mr: 2, verticalAlign: 'middle' }} />
            Messages Center
          </Typography>
          <Typography>Loading messages...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" gutterBottom>
            <Message sx={{ mr: 2, verticalAlign: 'middle' }} />
            Messages Center
          </Typography>
          <Typography color="error">Error: {error}</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          <Message sx={{ mr: 2, verticalAlign: 'middle' }} />
          Messages Center
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          View and manage messages organized by entity type
        </Typography>

        {entityTypeEntries.length === 0 ? (
          <Card>
            <CardContent>
              <Typography align="center" color="text.secondary">
                No messages found
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs
                  value={selectedTab}
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {entityTypeEntries.map(([entityTypeId, { entityType, messagesByEntityId }], index) => {
                    const totalMessages = messagesByEntityId.reduce((sum, group) => sum + group.messages.length, 0);
                    return (
                      <Tab
                        key={entityTypeId}
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{entityType.comment}</span>
                            <Chip
                              label={totalMessages}
                              size="small"
                              color="primary"
                              sx={{ minWidth: 20, height: 20 }}
                            />
                            <Chip
                              label={`${messagesByEntityId.length} ${messagesByEntityId.length === 1 ? 'item' : 'items'}`}
                              size="small"
                              variant="outlined"
                              sx={{ minWidth: 40, height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        }
                        id={`messages-tab-${index}`}
                        aria-controls={`messages-tabpanel-${index}`}
                      />
                    );
                  })}
                </Tabs>
              </Box>

              {entityTypeEntries.map(([entityTypeId, { entityType, messagesByEntityId }], index) => (
                <TabPanel key={entityTypeId} value={selectedTab} index={index}>
                  <Stack spacing={2}>
                    {messagesByEntityId.map(({ entityId, messages }) => {
                      const accordionKey = `${entityTypeId}-${entityId}`;
                      const isExpanded = expandedEntityIds.has(accordionKey);
                      
                      return (
                        <Accordion
                          key={accordionKey}
                          expanded={isExpanded}
                          onChange={() => handleAccordionChange(accordionKey)}
                          sx={{
                            '&:before': { display: 'none' },
                            boxShadow: 1,
                            '&.Mui-expanded': {
                              margin: '16px 0',
                            },
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMore />}
                            sx={{
                              backgroundColor: 'grey.50',
                              '&:hover': {
                                backgroundColor: 'grey.100',
                              },
                              '&.Mui-expanded': {
                                backgroundColor: 'grey.100',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {entityType.comment} #{entityId}
                                </Typography>
                                <Chip
                                  label={`${messages.length} ${messages.length === 1 ? 'message' : 'messages'}`}
                                  size="small"
                                  color="primary"
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                Last: {formatDate(messages[0]?.created_at)}
                              </Typography>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Grid container spacing={2}>
                              {messages.map((message) => (
                                <Grid item xs={12} md={6} lg={4} key={message.id}>
                                  <Card variant="outlined" sx={{ height: '100%', transition: 'all 0.2s', '&:hover': { boxShadow: 2 } }}>
                                    <CardContent>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box>
                                          <Typography variant="subtitle2" fontWeight="bold">
                                            {message.user?.first_name} {message.user?.last_name}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {formatDate(message.created_at)}
                                          </Typography>
                                        </Box>
                                        <IconButton
                                          size="small"
                                          color="primary"
                                          onClick={() => handleViewMessage(message)}
                                          title="View and Reply"
                                        >
                                          <Reply />
                                        </IconButton>
                                      </Box>

                                      <Typography
                                        variant="body2"
                                        sx={{
                                          mb: 2,
                                          display: '-webkit-box',
                                          WebkitLineClamp: 3,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {message.message}
                                      </Typography>

                                      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                                        <Chip
                                          label={message.user?.email}
                                          size="small"
                                          variant="outlined"
                                        />
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                </Grid>
                              ))}
                            </Grid>
                          </AccordionDetails>
                        </Accordion>
                      );
                    })}
                  </Stack>
                </TabPanel>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Message Detail Dialog */}
        <MessageDetailDialog
          open={detailDialogOpen}
          message={selectedMessage}
          onClose={handleCloseDialog}
          replyContent={replyContent}
          onReplyContentChange={setReplyContent}
          onReply={handleReply}
        />
      </Box>
    </Container>
  );
};
