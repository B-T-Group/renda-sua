import React, { useCallback, useState } from 'react';
import {
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

  // Group messages by entity type
  const messagesByEntityType = entityTypes.reduce((acc, entityType) => {
    const entityMessages = messages.filter(msg => msg.entity_type === entityType.id);
    if (entityMessages.length > 0) {
      acc[entityType.id] = {
        entityType,
        messages: entityMessages,
      };
    }
    return acc;
  }, {} as Record<string, { entityType: any; messages: UserMessage[] }>);

  const entityTypeEntries = Object.entries(messagesByEntityType);

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
                  {entityTypeEntries.map(([entityTypeId, { entityType, messages }], index) => (
                    <Tab
                      key={entityTypeId}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{entityType.comment}</span>
                          <Chip
                            label={messages.length}
                            size="small"
                            color="primary"
                            sx={{ minWidth: 20, height: 20 }}
                          />
                        </Box>
                      }
                      id={`messages-tab-${index}`}
                      aria-controls={`messages-tabpanel-${index}`}
                    />
                  ))}
                </Tabs>
              </Box>

              {entityTypeEntries.map(([entityTypeId, { entityType, messages }], index) => (
                <TabPanel key={entityTypeId} value={selectedTab} index={index}>
                  <Grid container spacing={2}>
                    {messages.map((message) => (
                      <Grid item xs={12} md={6} lg={4} key={message.id}>
                        <Card variant="outlined" sx={{ height: '100%' }}>
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

                            <Stack direction="row" spacing={1}>
                              <Chip
                                label={`ID: ${message.entity_id}`}
                                size="small"
                                variant="outlined"
                              />
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
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
