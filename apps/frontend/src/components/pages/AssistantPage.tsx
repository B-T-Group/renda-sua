import { AutoAwesome, Clear, Send, WhatsApp } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AssistantChatMessage,
  useAssistantChat,
} from '../../hooks/useAssistantChat';
import { AssistantEmptyIllustration } from './AssistantEmptyIllustration';
import { AssistantMarkdown } from './AssistantMarkdown';

const PAGE_BG = 'linear-gradient(160deg, #050b16 0%, #0a1726 48%, #061018 100%)';
const ACCENT = '#00e5ff';
const ACCENT_DIM = 'rgba(0, 229, 255, 0.14)';
const GLASS = 'rgba(255, 255, 255, 0.05)';

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

function useTypewriter(text: string, enabled: boolean, cps = 42): string {
  const [shown, setShown] = useState(enabled ? '' : text);
  useEffect(() => {
    if (!enabled) {
      setShown(text);
      return;
    }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, Math.max(12, Math.floor(1000 / cps)));
    return () => window.clearInterval(id);
  }, [text, enabled, cps]);
  return shown;
}

function ThinkingOrb() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{
          alignSelf: 'flex-start',
          px: 1.75,
          py: 1.1,
          borderRadius: 3,
          background: GLASS,
          border: `1px solid ${ACCENT_DIM}`,
          boxShadow: '0 0 24px rgba(0,229,255,0.12)',
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #7ef9ff, #00838f)',
            boxShadow: '0 0 16px rgba(0,229,255,0.7)',
            animation: 'aiOrbPulse 1.4s ease-in-out infinite',
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              border: '1px solid rgba(0,229,255,0.35)',
              animation: 'aiRingSpin 2.4s linear infinite',
            },
          }}
        />
        <Box>
          <Typography
            variant="caption"
            sx={{ color: ACCENT, fontWeight: 700, letterSpacing: 0.6 }}
          >
            {t('assistant.thinking', 'Thinking…')}
          </Typography>
          <Stack direction="row" spacing={0.6} sx={{ mt: 0.4 }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  bgcolor: ACCENT,
                  animation: 'aiBounce 1.1s ease-in-out infinite',
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    </motion.div>
  );
}

function MessageBubble({
  message,
  animateReveal,
}: {
  message: AssistantChatMessage;
  animateReveal: boolean;
}) {
  const isUser = message.role === 'user';
  const shown = useTypewriter(message.content, !isUser && animateReveal);
  const done = isUser || shown.length >= message.content.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <Box
        sx={{
          maxWidth: { xs: '90%', sm: '72%' },
          px: 2,
          py: 1.35,
          borderRadius: isUser ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
          background: isUser
            ? 'linear-gradient(135deg, #00bcd4 0%, #006978 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
          border: isUser ? 'none' : `1px solid ${ACCENT_DIM}`,
          color: 'white',
          boxShadow: isUser
            ? '0 8px 28px rgba(0,229,255,0.22)'
            : '0 4px 18px rgba(0,0,0,0.35)',
          position: 'relative',
          overflow: 'hidden',
          ...(!isUser && !done
            ? {
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(90deg, transparent, rgba(0,229,255,0.08), transparent)',
                  animation: 'aiShimmer 1.4s ease-in-out infinite',
                },
              }
            : {}),
        }}
      >
        {!isUser && (
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <AutoAwesome sx={{ fontSize: 13, color: ACCENT }} />
            <Typography
              variant="caption"
              sx={{ color: ACCENT, fontWeight: 700, letterSpacing: 0.4 }}
            >
              AI
            </Typography>
          </Stack>
        )}
        <Box sx={{ position: 'relative' }}>
          {isUser ? (
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
            >
              {shown}
            </Typography>
          ) : (
            <AssistantMarkdown content={shown} rich={done} />
          )}
          {!done && (
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                width: 7,
                height: 14,
                ml: 0.4,
                bgcolor: ACCENT,
                verticalAlign: 'text-bottom',
                animation: 'aiCursorBlink 0.9s steps(1) infinite',
              }}
            />
          )}
        </Box>
      </Box>
    </motion.div>
  );
}

function HandoffBanner() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Box
        sx={{
          mx: { xs: 1.5, sm: 2.5 },
          mb: 1.5,
          p: 2,
          borderRadius: 2.5,
          background: 'rgba(0, 188, 212, 0.09)',
          border: '1px solid rgba(0, 188, 212, 0.28)',
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ color: '#4dd0e1', mb: 0.5, fontWeight: 700 }}
        >
          {t('assistant.handoffTitle', 'Connecting you with our team')}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: 'rgba(255,255,255,0.65)', mb: 1.5 }}
        >
          {t(
            'assistant.handoffBody',
            'Our support team will follow up with you shortly.'
          )}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<WhatsApp />}
          href="https://wa.me/18556488855"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            borderColor: 'rgba(0,229,255,0.35)',
            color: ACCENT,
            '&:hover': {
              borderColor: ACCENT,
              background: 'rgba(0,229,255,0.08)',
            },
          }}
        >
          {t('assistant.whatsappCta', 'Chat on WhatsApp')}
        </Button>
      </Box>
    </motion.div>
  );
}

function AssistantHeader({
  onClear,
  hasMsgs,
  isThinking,
}: {
  onClear: () => void;
  hasMsgs: boolean;
  isThinking: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        px: { xs: 2, sm: 3 },
        py: 1.75,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background:
          'linear-gradient(180deg, rgba(5,11,22,0.96) 0%, rgba(5,11,22,0.72) 100%)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #26c6da, #005f6b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 22px rgba(0,229,255,0.55)',
            animation: isThinking
              ? 'aiOrbPulse 1.2s ease-in-out infinite'
              : 'aiOrbPulse 3.2s ease-in-out infinite',
            flexShrink: 0,
          }}
        >
          <AutoAwesome sx={{ fontSize: 18, color: 'white' }} />
        </Box>
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: 'white', lineHeight: 1.2 }}
          >
            {t('assistant.title', 'Rendasua Assistant')}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: isThinking ? '#ffd54f' : '#69f0ae',
                boxShadow: isThinking
                  ? '0 0 8px #ffd54f'
                  : '0 0 8px #69f0ae',
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: ACCENT, opacity: 0.85, lineHeight: 1 }}
            >
              {isThinking
                ? t('assistant.statusThinking', 'Generating response')
                : t('assistant.statusOnline', 'Online · AI powered')}
            </Typography>
          </Stack>
        </Box>
      </Stack>
      {hasMsgs && (
        <IconButton
          size="small"
          onClick={onClear}
          aria-label={t('assistant.clear', 'Clear chat')}
          sx={{
            color: 'rgba(255,255,255,0.45)',
            '&:hover': { color: 'white' },
          }}
        >
          <Clear fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const { t } = useTranslation();
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
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <AssistantEmptyIllustration size={156} />
      </motion.div>
      <Typography
        variant="h6"
        sx={{
          mt: 3,
          mb: 1,
          color: 'white',
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        {t('assistant.emptyTitle', 'What can I help you with?')}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: 'rgba(255,255,255,0.45)',
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.06 }}
            >
              <Chip
                label={label}
                clickable
                onClick={() => onPick(label)}
                sx={{
                  color: 'rgba(255,255,255,0.88)',
                  bgcolor: 'rgba(0,229,255,0.08)',
                  border: '1px solid rgba(0,229,255,0.22)',
                  '&:hover': {
                    bgcolor: 'rgba(0,229,255,0.16)',
                    borderColor: ACCENT,
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
        background:
          'linear-gradient(0deg, rgba(5,11,22,0.97) 55%, transparent 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          background: GLASS,
          border: '1px solid rgba(0,229,255,0.22)',
          borderRadius: 3.5,
          px: 2,
          py: 0.85,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:focus-within': {
            borderColor: 'rgba(0,229,255,0.55)',
            boxShadow: '0 0 0 1px rgba(0,229,255,0.18), 0 0 28px rgba(0,229,255,0.12)',
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
          placeholder={t('assistant.placeholder', 'Type your question…')}
          disabled={disabled}
          sx={{
            color: 'white',
            fontSize: '0.92rem',
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255,255,255,0.32)',
              opacity: 1,
            },
          }}
        />
        <IconButton
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label={t('assistant.send', 'Send')}
          size="small"
          sx={{
            width: 38,
            height: 38,
            color:
              disabled || !value.trim()
                ? 'rgba(255,255,255,0.18)'
                : '#041018',
            bgcolor:
              disabled || !value.trim() ? 'transparent' : ACCENT,
            transition: 'all 0.2s',
            '&:not(:disabled):hover': {
              bgcolor: '#7ef9ff',
              boxShadow: '0 0 18px rgba(0,229,255,0.45)',
            },
          }}
        >
          <Send fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

const AssistantPage: React.FC = () => {
  const { messages, isSending, error, handoff, sendMessage, clearChat } =
    useAssistantChat();
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const revealedIds = useRef<Set<string>>(new Set());
  const latestAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (latestAssistantId) {
      const timer = window.setTimeout(() => {
        revealedIds.current.add(latestAssistantId);
      }, Math.min(8000, Math.max(400, (messages.find((m) => m.id === latestAssistantId)?.content.length ?? 0) * 24)));
      return () => window.clearTimeout(timer);
    }
  }, [latestAssistantId, messages]);

  const handleSend = (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || isSending) return;
    setDraft('');
    void sendMessage(text);
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
        background: PAGE_BG,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(0,229,255,0.07) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
          maskImage:
            'radial-gradient(ellipse at center, black 35%, transparent 80%)',
        },
        '@keyframes aiBounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-5px)' },
        },
        '@keyframes aiOrbPulse': {
          '0%, 100%': { boxShadow: '0 0 18px rgba(0,229,255,0.5)' },
          '50%': {
            boxShadow:
              '0 0 34px rgba(0,229,255,0.95), 0 0 60px rgba(0,229,255,0.28)',
          },
        },
        '@keyframes aiRingSpin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        '@keyframes aiShimmer': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' },
        },
        '@keyframes aiCaret': {
          '0%, 49%': { opacity: 1 },
          '50%, 100%': { opacity: 0 },
        },
        '@keyframes aiDrift': {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(18px, -22px, 0)' },
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '-18%',
          right: '-10%',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(0,188,212,0.14) 0%, transparent 65%)',
          pointerEvents: 'none',
          animation: 'aiDrift 12s ease-in-out infinite',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-14%',
          left: '-8%',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(0,100,180,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
          animation: 'aiDrift 16s ease-in-out infinite reverse',
        }}
      />

      <AssistantHeader
        onClear={clearChat}
        hasMsgs={messages.length > 0}
        isThinking={isSending}
      />

      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 1.5, sm: 2.5 },
          py: 2,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,229,255,0.2)',
            borderRadius: 2,
          },
        }}
      >
        {messages.length === 0 ? (
          <EmptyState onPick={(text) => handleSend(text)} />
        ) : (
          <Stack spacing={1.4} sx={{ pb: 1 }}>
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  animateReveal={
                    m.role === 'assistant' &&
                    m.id === latestAssistantId &&
                    !revealedIds.current.has(m.id)
                  }
                />
              ))}
            </AnimatePresence>
            <AnimatePresence>{isSending ? <ThinkingOrb /> : null}</AnimatePresence>
            {error && (
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255,120,120,0.85)', px: 1 }}
              >
                {t(
                  'assistant.errorGeneric',
                  'Something went wrong. Please try again.'
                )}
              </Typography>
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
