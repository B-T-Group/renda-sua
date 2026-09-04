import { AutoAwesome, Clear, Send, WhatsApp } from '@mui/icons-material';
import { Box, Button, IconButton, InputBase, Stack, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssistantChatMessage, useAssistantChat } from '../../hooks/useAssistantChat';
import { AssistantEmptyIllustration } from './AssistantEmptyIllustration';

// ─── Palette ──────────────────────────────────────────────────────────────────
const PAGE_BG = 'linear-gradient(160deg, #070f1c 0%, #0b1c2c 55%, #08141e 100%)';
const ACCENT = '#00e5ff';
const ACCENT_DIM = 'rgba(0, 229, 255, 0.13)';
const GLASS = 'rgba(255, 255, 255, 0.045)';

// ─── ThinkingDots ─────────────────────────────────────────────────────────────
function ThinkingDots() {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.75 }}>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 6, height: 6, borderRadius: '50%', bgcolor: ACCENT,
              animation: 'aiBounce 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
        {t('assistant.thinking', 'Thinking…')}
      </Typography>
    </Box>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: AssistantChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}
    >
      <Box
        sx={{
          maxWidth: { xs: '87%', sm: '70%' },
          px: 2, py: 1.25,
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser
            ? 'linear-gradient(135deg, #00acc1 0%, #006978 100%)'
            : GLASS,
          border: isUser ? 'none' : `1px solid ${ACCENT_DIM}`,
          color: 'white',
          boxShadow: isUser ? '0 4px 20px rgba(0,229,255,0.22)' : '0 2px 8px rgba(0,0,0,0.28)',
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
          {message.content}
        </Typography>
      </Box>
    </motion.div>
  );
}

// ─── HandoffBanner ────────────────────────────────────────────────────────────
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
          mx: { xs: 1.5, sm: 2.5 }, mb: 1.5, p: 2,
          borderRadius: 2.5,
          background: 'rgba(0, 188, 212, 0.09)',
          border: '1px solid rgba(0, 188, 212, 0.28)',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#4dd0e1', mb: 0.5, fontWeight: 700 }}>
          {t('assistant.handoffTitle', 'Connecting you with our team')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mb: 1.5 }}>
          {t('assistant.handoffBody', 'Our support team will follow up with you shortly.')}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<WhatsApp />}
          href="https://wa.me/18556488855"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            borderColor: 'rgba(0,229,255,0.35)', color: ACCENT,
            '&:hover': { borderColor: ACCENT, background: 'rgba(0,229,255,0.08)' },
          }}
        >
          {t('assistant.whatsappCta', 'Chat on WhatsApp')}
        </Button>
      </Box>
    </motion.div>
  );
}

// ─── AssistantHeader ──────────────────────────────────────────────────────────
function AssistantHeader({ onClear, hasMsgs }: { onClear: () => void; hasMsgs: boolean }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        position: 'sticky', top: 0, zIndex: 10,
        px: { xs: 2, sm: 3 }, py: 1.75,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(180deg, rgba(7,15,28,0.97) 0%, rgba(7,15,28,0.72) 100%)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(0,229,255,0.07)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #26c6da, #005f6b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 18px rgba(0,229,255,0.5)`,
            animation: 'aiOrbPulse 3s ease-in-out infinite',
            flexShrink: 0,
          }}
        >
          <AutoAwesome sx={{ fontSize: 18, color: 'white' }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
            {t('assistant.title', 'Rendasua Assistant')}
          </Typography>
          <Typography variant="caption" sx={{ color: ACCENT, opacity: 0.75, lineHeight: 1 }}>
            {t('assistant.subtitle', 'Ask about delivery, payments, and more')}
          </Typography>
        </Box>
      </Stack>
      {hasMsgs && (
        <IconButton
          size="small"
          onClick={onClear}
          aria-label={t('assistant.clear', 'Clear chat')}
          sx={{ color: 'rgba(255,255,255,0.45)', '&:hover': { color: 'white' } }}
        >
          <Clear fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState() {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        py: 6, px: 3,
      }}
    >
      <AssistantEmptyIllustration size={156} />
      <Typography
        variant="h6"
        sx={{ mt: 3, mb: 1, color: 'white', fontWeight: 700, textAlign: 'center' }}
      >
        {t('assistant.emptyTitle', 'What can I help you with?')}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'rgba(255,255,255,0.45)', textAlign: 'center', maxWidth: 320, lineHeight: 1.7 }}
      >
        {t('assistant.emptySubtitle', 'Ask about our services, delivery, payments, or pickup locations.')}
      </Typography>
    </Box>
  );
}

// ─── AssistantInput ───────────────────────────────────────────────────────────
interface InputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}

function AssistantInput({ value, onChange, onSend, disabled }: InputProps) {
  const { t } = useTranslation();

  const handleKey = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  return (
    <Box
      sx={{
        position: 'sticky', bottom: 0, zIndex: 10,
        px: { xs: 1.5, sm: 2.5 }, py: 2,
        background: 'linear-gradient(0deg, rgba(7,15,28,0.97) 60%, transparent 100%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          background: GLASS, border: `1px solid rgba(0,229,255,0.2)`,
          borderRadius: 3, px: 2, py: 0.75,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:focus-within': {
            borderColor: 'rgba(0,229,255,0.45)',
            boxShadow: '0 0 0 1px rgba(0,229,255,0.12)',
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
            color: 'white', fontSize: '0.9rem',
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255,255,255,0.32)', opacity: 1,
            },
          }}
        />
        <IconButton
          onClick={onSend}
          disabled={disabled || !value.trim()}
          aria-label={t('assistant.send', 'Send')}
          size="small"
          sx={{
            color: disabled || !value.trim() ? 'rgba(255,255,255,0.18)' : ACCENT,
            transition: 'all 0.2s',
            '&:not(:disabled):hover': { background: 'rgba(0,229,255,0.1)' },
          }}
        >
          <Send fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

// ─── AssistantPage ────────────────────────────────────────────────────────────
const AssistantPage: React.FC = () => {
  const { messages, isSending, error, handoff, sendMessage, clearChat } = useAssistantChat();
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    void sendMessage(text);
  };

  return (
    <Box
      sx={{
        // Escape the app Container padding to go full-bleed
        mx: { xs: -1.5, sm: -2, md: -3 },
        mt: -4,
        mb: -4,
        minHeight: 'calc(100vh - 116px)',
        display: 'flex',
        flexDirection: 'column',
        background: PAGE_BG,
        position: 'relative',
        overflow: 'hidden',
        // Subtle dot-grid overlay
        '&::before': {
          content: '""', position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(0,229,255,0.06) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          pointerEvents: 'none',
        },
        // CSS keyframe definitions
        '@keyframes aiBounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-5px)' },
        },
        '@keyframes aiOrbPulse': {
          '0%, 100%': { boxShadow: '0 0 18px rgba(0,229,255,0.5)' },
          '50%': { boxShadow: '0 0 30px rgba(0,229,255,0.9), 0 0 52px rgba(0,229,255,0.25)' },
        },
      }}
    >
      {/* Ambient background orb */}
      <Box
        sx={{
          position: 'absolute', top: '-15%', right: '-8%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,188,212,0.06) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,100,150,0.05) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <AssistantHeader onClear={clearChat} hasMsgs={messages.length > 0} />

      {/* Messages list */}
      <Box
        sx={{
          flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
          px: { xs: 1.5, sm: 2.5 }, py: 2,
          // Custom scrollbar for dark bg
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(0,229,255,0.18)', borderRadius: 2 },
        }}
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <Stack spacing={1.25} sx={{ pb: 1 }}>
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </AnimatePresence>
            {isSending && <ThinkingDots />}
            {error && (
              <Typography
                variant="caption"
                sx={{ color: 'rgba(255,120,120,0.8)', px: 1 }}
              >
                {t('assistant.errorGeneric', 'Something went wrong. Please try again.')}
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
        onSend={handleSend}
        disabled={isSending}
      />
    </Box>
  );
};

export default AssistantPage;
