import { RestartAlt, Send, SmartToy, WhatsApp } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React, { KeyboardEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssistantChat } from '../../contexts/AssistantChatContext';
import type { AssistantChatMessage } from '../../contexts/AssistantChatContext';
import { AssistantMarkdown } from './AssistantMarkdown';

const SUGGESTION_KEYS = [
  {
    key: 'assistant.suggestion.location',
    fallback: 'Where are you located?',
  },
  {
    key: 'assistant.suggestion.payDelivery',
    fallback: 'Do you support payment at delivery?',
  },
  {
    key: 'assistant.suggestion.pickup',
    fallback: 'Do you support in-store pickup?',
  },
  {
    key: 'assistant.suggestion.mobilePay',
    fallback: 'Do you support mobile payments?',
  },
] as const;


function ThinkingIndicator() {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          alignSelf: 'flex-start',
          px: 2,
          py: 1.5,
          borderRadius: '16px 16px 16px 4px',
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
        role="status"
        aria-live="polite"
        aria-label={t('assistant.thinking', 'Thinking…')}
      >
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '15px',
            lineHeight: '22px',
          }}
        >
          {t('assistant.thinking', 'Thinking…')}
        </Typography>
        {!prefersReducedMotion && (
          <Stack direction="row" spacing={0.5}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: theme.palette.text.secondary,
                  animation: 'dotBounce 1.4s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </motion.div>
  );
}

function MessageBubble({ message }: { message: AssistantChatMessage }) {
  const isUser = message.role === 'user';
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          maxWidth: { xs: '80%', sm: '560px' },
          alignItems: 'flex-start',
        }}
      >
        {!isUser && (
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: 0.5,
            }}
          >
            <SmartToy sx={{ fontSize: 16, color: 'white' }} />
          </Box>
        )}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            backgroundColor: isUser
              ? theme.palette.primary.main
              : theme.palette.background.paper,
            border: isUser ? 'none' : `1px solid ${theme.palette.divider}`,
            color: isUser
              ? theme.palette.primary.contrastText
              : theme.palette.text.primary,
          }}
        >
          {isUser ? (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                fontSize: '15px',
                lineHeight: '22px',
                color: 'inherit',
              }}
            >
              {message.content}
            </Typography>
          ) : (
            <AssistantMarkdown content={message.content} rich />
          )}
        </Box>
      </Stack>
    </motion.div>
  );
}

function HandoffBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
    >
      <Box
        sx={{
          mx: { xs: 1.5, sm: 2.5 },
          mb: 1.5,
          p: 2,
          borderRadius: 2,
          backgroundColor: `${theme.palette.info.main}1A`,
          border: `1px solid ${theme.palette.info.main}`,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: theme.palette.text.primary,
            mb: 0.5,
            fontWeight: 600,
          }}
        >
          {t(
            'assistant.handoffTitle',
            'A team member will help you'
          )}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary, mb: 1.5 }}
        >
          {t(
            'assistant.handoffBody',
            'Continue on WhatsApp. We usually reply within 1 hour.'
          )}
        </Typography>
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<WhatsApp />}
          href="https://wa.me/18556488855"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('assistant.openWhatsApp', 'Open WhatsApp')}
        </Button>
      </Box>
    </motion.div>
  );
}

function AssistantHeader({
  onClear,
  hasMsgs,
  isThinking,
  isOffline,
}: {
  onClear: () => void;
  hasMsgs: boolean;
  isThinking: boolean;
  isOffline: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const statusText = isOffline
    ? t('assistant.statusOffline', 'Offline')
    : isThinking
    ? t('assistant.statusThinking', 'Thinking…')
    : t('assistant.statusOnline', 'AI · Replies in seconds');

  return (
    <Box
      sx={{
        position: 'sticky',
        top: { xs: 56, sm: 64 },
        zIndex: 10,
        px: { xs: 2, sm: 3 },
        py: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: theme.palette.primary.main,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SmartToy sx={{ fontSize: 20, color: 'white' }} />
        </Box>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              lineHeight: 1.2,
              fontFamily: theme.typography.h6.fontFamily,
            }}
          >
            {t('assistant.title', 'RendaSua Assistant')}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, lineHeight: 1 }}
          >
            {statusText}
          </Typography>
        </Box>
      </Stack>
      {hasMsgs && (
        <IconButton
          size="medium"
          onClick={onClear}
          aria-label={t('assistant.startOver', 'Start over')}
          title={t('assistant.startOver', 'Start over')}
          sx={{
            minWidth: 44,
            minHeight: 44,
            color: theme.palette.text.secondary,
            '&:hover': { color: theme.palette.text.primary },
          }}
        >
          <RestartAlt />
        </IconButton>
      )}
    </Box>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 5,
        px: 3,
      }}
    >
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      >
        <Box
          sx={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            backgroundColor: theme.palette.primary.main,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <SmartToy sx={{ fontSize: 44, color: 'white' }} />
        </Box>
      </motion.div>
      <Typography
        variant="h6"
        sx={{
          mb: 1,
          color: theme.palette.text.primary,
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        {t('assistant.emptyTitle', 'Hi! What do you need today?')}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: theme.palette.text.secondary,
          textAlign: 'center',
          maxWidth: 340,
          lineHeight: 1.7,
          mb: 3,
        }}
      >
        {t(
          'assistant.emptySubtitle',
          'Ask about our services, delivery, payments, or pickup locations.'
        )}
      </Typography>
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
        justifyContent="center"
        sx={{ maxWidth: 520 }}
      >
        {SUGGESTION_KEYS.map((item, index) => {
          const label = t(item.key, item.fallback);
          return (
            <motion.div
              key={item.key}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.2,
                delay: prefersReducedMotion ? 0 : 0.1 + index * 0.05,
              }}
            >
              <Chip
                label={label}
                clickable
                onClick={() => onPick(label)}
                variant="outlined"
                sx={{
                  color: theme.palette.primary.main,
                  borderColor: theme.palette.divider,
                  minHeight: 40,
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    backgroundColor: `${theme.palette.primary.main}0A`,
                  },
                }}
              />
            </motion.div>
          );
        })}
      </Stack>
    </Box>
  );
}

function AssistantInput({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  const handleKey = (
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        px: { xs: 1.5, sm: 2.5 },
        py: 2,
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          backgroundColor: theme.palette.grey[100],
          borderRadius: '12px',
          px: 2,
          py: 1,
          minHeight: 48,
          transition: 'box-shadow 0.2s',
          '&:focus-within': {
            boxShadow: `0 0 0 2px ${theme.palette.primary.main}40`,
          },
        }}
      >
        <InputBase
          fullWidth
          multiline
          maxRows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t(
            'assistant.placeholder',
            'Ask about an item, order or delivery…'
          )}
          disabled={disabled}
          name="message"
          autoComplete="off"
          inputProps={{
            'aria-label': t('assistant.placeholder', 'Ask about an item, order or delivery…'),
          }}
          sx={{
            fontSize: '15px',
            lineHeight: '22px',
            py: 0.75,
            '& .MuiInputBase-input': {
              color: theme.palette.text.primary,
            },
            '& .MuiInputBase-input::placeholder': {
              color: theme.palette.text.secondary,
              opacity: 0.7,
            },
          }}
        />
        <IconButton
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label={t('assistant.send', 'Send')}
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            color: 'white',
            backgroundColor:
              disabled || !value.trim()
                ? theme.palette.action.disabled
                : theme.palette.primary.main,
            '&:not(:disabled):hover': {
              backgroundColor: theme.palette.primary.dark,
            },
            '&:disabled': {
              backgroundColor: theme.palette.action.disabledBackground,
            },
          }}
        >
          <Send />
        </IconButton>
      </Box>
    </Box>
  );
}

const AssistantPage: React.FC = () => {
  const {
    messages,
    isSending,
    error,
    handoff,
    isOffline,
    draft,
    setDraft,
    sendMessage,
    clearChat,
  } = useAssistantChat();
  const { t } = useTranslation();
  const theme = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending]);

  const handleSend = (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || isSending) return;
    setDraft('');
    void sendMessage(text, false);
  };

  const handleRetry = () => {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.role === 'user');
    if (lastUserMessage) {
      void sendMessage(lastUserMessage.content, true);
    }
  };

  return (
    <Box
      sx={{
        mx: { xs: -1.5, sm: -2, md: -3 },
        mt: -4,
        mb: -4,
        minHeight: 'calc(100vh - 116px)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.palette.background.default,
        position: 'relative',
        '@keyframes dotBounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      }}
    >
      <AssistantHeader
        onClear={clearChat}
        hasMsgs={messages.length > 0}
        isThinking={isSending}
        isOffline={isOffline}
      />

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 1.5, sm: 2.5 },
          py: 2,
        }}
      >
        {messages.length === 0 ? (
          <EmptyState onPick={(text) => handleSend(text)} />
        ) : (
          <Stack spacing={2} sx={{ pb: 1 }}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isSending && <ThinkingIndicator />}
            {error && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: `${theme.palette.error.main}1A`,
                  border: `1px solid ${theme.palette.error.main}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ color: theme.palette.text.primary, mb: 0.5 }}
                  >
                    {t(
                      'assistant.errorMessage',
                      'Message not sent. Check your connection.'
                    )}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleRetry}
                >
                  {t('assistant.retry', 'Retry')}
                </Button>
              </Box>
            )}
          </Stack>
        )}
        <div ref={bottomRef} />
      </Box>

      {handoff && <HandoffBanner />}

      <AssistantInput
        value={draft}
        onChange={setDraft}
        onSend={() => handleSend()}
        disabled={isSending}
      />
    </Box>
  );
};

export default AssistantPage;
