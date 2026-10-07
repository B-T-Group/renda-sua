import {
  RestartAlt,
  Send,
  SmartToy,
  SupportAgent,
  WhatsApp,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputBase,
  Stack,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React, {
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAssistantChat } from '../../contexts/AssistantChatContext';
import type { AssistantChatMessage } from '../../contexts/AssistantChatContext';
import { useAppChromeInsets } from '../../hooks/useAppChromeInsets';
import { brandTokens } from '../../theme/brandTokens';
import { RendaCharacter } from '../assistant/RendaCharacter';
import type { RendaState } from '../assistant/RendaCharacter';
import { useShowsRendaCharacter } from '../assistant/useAssistantPersona';
import { useRendaChatState } from '../assistant/useRendaChatState';
import { AssistantMarkdown } from './AssistantMarkdown';
import type { AssistantContext } from '../../utils/assistantChips';
import { getContextualChips, buildChipMessage } from '../../utils/assistantChips';
import { useTrackSiteEvent } from '../../hooks/useTrackSiteEvent';

/** Thread and composer are capped and centred on desktop (Product & UX 3b/4b). */
const THREAD_MAX_WIDTH = 760;

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

function MiniOrb({
  visible,
  character,
}: {
  visible: boolean;
  character: boolean;
}) {
  const theme = useTheme();
  if (!visible) {
    // Keeps grouped bubbles aligned with the first bubble of the group.
    return <Box sx={{ width: 28, flexShrink: 0 }} aria-hidden />;
  }
  if (character) {
    // Message avatar: 28 px character, dot eyes, no motion (many on screen).
    return (
      <Box
        data-testid="assistant-mini-orb"
        aria-hidden
        sx={{
          width: 28,
          height: 28,
          flexShrink: 0,
          mt: 0.5,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <RendaCharacter size={28} surface="avatar" animated={false} />
      </Box>
    );
  }
  return (
    <Box
      data-testid="assistant-mini-orb"
      aria-hidden
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
      <SmartToy
        sx={{ fontSize: 16, color: theme.palette.primary.contrastText }}
      />
    </Box>
  );
}

function MessageBubble({
  message,
  showOrb,
  character,
}: {
  message: AssistantChatMessage;
  showOrb: boolean;
  character: boolean;
}) {
  const isUser = message.role === 'user';
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      data-chat-item
      data-role={message.role}
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
        {!isUser && <MiniOrb visible={showOrb} character={character} />}
        <Box
          data-testid={
            isUser ? 'assistant-user-bubble' : 'assistant-reply-bubble'
          }
          sx={{
            px: 2,
            py: 1.5,
            minWidth: 0,
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            backgroundColor: isUser
              ? theme.palette.primary.main
              : theme.palette.background.paper,
            border: isUser ? 'none' : `1px solid ${theme.palette.divider}`,
            // Assistant markdown renders body2 Typography; restyle it to the chat body spec.
            '& .MuiTypography-root': isUser
              ? undefined
              : {
                  color: theme.palette.text.primary,
                  fontSize: '15px',
                  lineHeight: '22px',
                },
          }}
        >
          {isUser ? (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                fontSize: '15px',
                lineHeight: '22px',
                color: theme.palette.primary.contrastText,
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

/** `network`: the request never reached the server. `server`: the API answered with an error. */
type ChatErrorKind = 'network' | 'server';

function ErrorBanner({
  kind,
  onRetry,
}: {
  kind: ChatErrorKind;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Box
      data-chat-item
      role="alert"
      data-testid="assistant-error-banner"
      data-error-kind={kind}
      sx={{
        p: 2,
        borderRadius: 2,
        backgroundColor: brandTokens.error.soft,
        border: `1px solid ${theme.palette.error.main}`,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography
        variant="body2"
        sx={{ flex: 1, color: theme.palette.text.primary }}
      >
        {kind === 'network'
          ? t(
              'assistant.errorMessage',
              'Message not sent. Check your connection.'
            )
          : t('assistant.errorServer', 'Message not sent. Please try again.')}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={onRetry}
        sx={{ minHeight: 44, flexShrink: 0 }}
      >
        {t('assistant.retry', 'Retry')}
      </Button>
    </Box>
  );
}

function HandoffCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      data-chat-item
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
    >
      <Box
        data-testid="assistant-handoff-card"
        sx={{
          p: 2,
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.06),
          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-start',
        }}
      >
        <SupportAgent
          aria-hidden
          sx={{ color: theme.palette.primary.main, fontSize: 24, mt: 0.25 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{ color: theme.palette.text.primary, mb: 0.5, fontWeight: 600 }}
          >
            {t('assistant.handoffTitle', 'A team member will help you')}
          </Typography>
          <Typography
            variant="body2"
            data-testid="assistant-handoff-body"
            // text.secondary (#64748B) drops below 4.5:1 on the primary tint; text.primary is ~15:1.
            sx={{ color: theme.palette.text.primary, mb: 1.5 }}
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
            sx={{ minHeight: 44 }}
          >
            {t('assistant.openWhatsApp', 'Open WhatsApp')}
          </Button>
        </Box>
      </Box>
    </motion.div>
  );
}

function AssistantHeader({
  onClear,
  hasMsgs,
  isThinking,
  isOffline,
  character,
}: {
  onClear: () => void;
  hasMsgs: boolean;
  isThinking: boolean;
  isOffline: boolean;
  /** Character state for client/guest; null keeps the SmartToy avatar (agent/business). */
  character: RendaState | null;
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
      component="header"
      sx={{
        flexShrink: 0,
        px: { xs: 2, sm: 3 },
        py: 1.5,
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        {character ? (
          <Box
            aria-hidden
            data-testid="assistant-header-character"
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <RendaCharacter size={40} surface="header" state={character} />
          </Box>
        ) : (
          <Box
            aria-hidden
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
            <SmartToy
              sx={{ fontSize: 20, color: theme.palette.primary.contrastText }}
            />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontFamily: theme.typography.h4.fontFamily,
              fontWeight: 600,
              fontSize: '18px',
              color: theme.palette.text.primary,
              lineHeight: 1.25,
            }}
          >
            {t('assistant.title', 'RendaSua Assistant')}
          </Typography>
          <Typography
            variant="caption"
            component="p"
            aria-live="polite"
            sx={{ color: theme.palette.text.secondary, lineHeight: 1.3 }}
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

/** Empty-state hero: 160 on desktop, 128 on mobile, on a primary.light 8% disc 1.5× its height. */
function HeroCharacter({ state }: { state: RendaState }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const size = isDesktop ? 160 : 128;
  const disc = size * 1.5;
  return (
    <Box
      data-testid="assistant-hero-character"
      data-size={size}
      aria-hidden
      sx={{
        position: 'relative',
        width: disc,
        height: disc,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 1,
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          pointerEvents: 'none',
          background: `radial-gradient(closest-side, ${alpha(
            brandTokens.primary.light,
            0.08
          )} 0%, ${alpha(brandTokens.primary.light, 0.08)} 55%, ${alpha(
            brandTokens.primary.light,
            0
          )} 100%)`,
        },
      }}
    >
      <RendaCharacter
        size={size}
        surface="hero"
        state={state}
        style={{ position: 'relative' }}
      />
    </Box>
  );
}

function EmptyState({
  onPick,
  character,
  context,
}: {
  onPick: (text: string) => void;
  /** Character state for client/guest; null keeps the SmartToy orb (agent/business). */
  character: RendaState | null;
  context?: AssistantContext;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const { trackSiteEvent } = useTrackSiteEvent();
  const chips = getContextualChips(context);

  const handleChipClick = (chipId: string, message: string) => {
    void trackSiteEvent({
      eventType: 'assistant.chip.tap',
      metadata: {
        chip_id: chipId,
        context: context?.type || 'generic',
      },
    });
    onPick(message);
  };

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
      {character ? (
        <HeroCharacter state={character} />
      ) : (
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
            <SmartToy
              sx={{ fontSize: 44, color: theme.palette.primary.contrastText }}
            />
          </Box>
        </motion.div>
      )}
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
        {chips.map((chip, index) => {
          const label = t(chip.translationKey, chip.fallback);
          const message = buildChipMessage(chip, label, context);
          return (
            <motion.div
              key={chip.id}
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
                onClick={() => handleChipClick(chip.id, message)}
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
  onFocusChange,
  inputDisabled,
  sendDisabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onFocusChange: (focused: boolean) => void;
  inputDisabled: boolean;
  sendDisabled: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const canSend = !sendDisabled && !!value.trim();

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
        flexShrink: 0,
        px: { xs: 1.5, sm: 2.5 },
        py: 1.5,
        backgroundColor: theme.palette.background.default,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          width: '100%',
          maxWidth: { md: THREAD_MAX_WIDTH },
          mx: 'auto',
          backgroundColor: brandTokens.surface.input,
          borderRadius: '12px',
          pl: 2,
          pr: 0.5,
          py: 0.5,
          minHeight: 56,
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
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          placeholder={t(
            'assistant.placeholder',
            'Ask about an item, order or delivery…'
          )}
          disabled={inputDisabled}
          name="message"
          autoComplete="off"
          inputProps={{
            'aria-label': t(
              'assistant.placeholder',
              'Ask about an item, order or delivery…'
            ),
          }}
          sx={{
            alignSelf: 'center',
            fontSize: '15px',
            lineHeight: '22px',
            py: 1,
            '& .MuiInputBase-input': {
              color: theme.palette.text.primary,
            },
            '& .MuiInputBase-input::placeholder': {
              color: brandTokens.text.secondary,
              opacity: 1,
            },
          }}
        />
        <IconButton
          onClick={onSend}
          disabled={!canSend}
          aria-label={t('assistant.send', 'Send')}
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            color: theme.palette.primary.contrastText,
            backgroundColor: theme.palette.primary.main,
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            },
            '&.Mui-disabled': {
              color: theme.palette.primary.contrastText,
              backgroundColor: theme.palette.action.disabled,
            },
          }}
        >
          <Send />
        </IconButton>
      </Box>
    </Box>
  );
}

/** Scrolls the message area (never the window) so the newest item is visible. */
function useScrollNewestIntoView(
  containerRef: React.RefObject<HTMLDivElement | null>,
  /** Changes whenever the thread gains or loses an item. */
  threadKey: string
) {
  const prefersReducedMotion = useReducedMotion();
  const isFirstRef = useRef(true);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const instant = isFirstRef.current || !!prefersReducedMotion;
    isFirstRef.current = false;
    const items = el.querySelectorAll<HTMLElement>('[data-chat-item]');
    const newest = items[items.length - 1];
    let top = el.scrollHeight;
    // A reply taller than the viewport is shown from its first line.
    if (newest && newest.offsetHeight > el.clientHeight) {
      top = newest.offsetTop - 8;
    }
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top, behavior: instant ? 'auto' : 'smooth' });
    } else {
      el.scrollTop = top;
    }
  }, [containerRef, prefersReducedMotion, threadKey]);
}

const AssistantPage: React.FC = () => {
  const {
    messages,
    isSending,
    error,
    handoff,
    isOffline,
    draft,
    ready,
    lastReply,
    setDraft,
    sendMessage,
    retry,
    clearChat,
  } = useAssistantChat();
  const theme = useTheme();
  const chrome = useAppChromeInsets();
  const scrollRef = useRef<HTMLDivElement>(null);
  const showsCharacter = useShowsRendaCharacter();
  const [composerFocused, setComposerFocused] = useState(false);
  const characterState = useRendaChatState({
    isSending,
    lastReply,
    isEmpty: messages.length === 0,
    composerFocused,
    composerHasText: draft.trim().length > 0,
  });
  // The "Thinking…" subtitle is paired with the character's Thinking (≥ 400 ms).
  const isThinking = isSending || characterState === 'thinking';
  
  const location = useLocation();
  const context: AssistantContext | undefined = (location.state as { context?: AssistantContext })?.context;

  // The page is a viewport-sized column; start it flush under the site top bar.
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }, []);

  useScrollNewestIntoView(
    scrollRef,
    `${messages.length}:${isSending}:${!!error}:${handoff}`
  );

  const handleSend = (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || !ready || isSending) return;
    // Typed text becomes a bubble; on failure it stays there and Retry re-sends it.
    if (override === undefined) setDraft('');
    void sendMessage(text);
  };

  const chromeHeight = chrome.top + chrome.bottom;

  return (
    <Box
      data-testid="assistant-page"
      sx={{
        // Cancel the layout Container's side gutters; app.tsx drops the vertical padding on this route.
        mx: { xs: -1.5, sm: -2, md: -3 },
        height: `calc(100vh - ${chromeHeight}px)`,
        '@supports (height: 100dvh)': {
          height: `calc(100dvh - ${chromeHeight}px)`,
        },
        minHeight: 360,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: theme.palette.background.default,
        '@keyframes dotBounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-4px)' },
        },
      }}
    >
      <AssistantHeader
        onClear={clearChat}
        hasMsgs={messages.length > 0}
        isThinking={isThinking}
        isOffline={isOffline}
        character={showsCharacter ? characterState : null}
      />

      <Box
        ref={scrollRef}
        data-testid="assistant-messages"
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 1.5, sm: 2.5 },
          py: 2,
        }}
      >
        <Box
          data-testid="assistant-thread"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: { md: THREAD_MAX_WIDTH },
            mx: 'auto',
          }}
        >
          {messages.length === 0 ? (
            <EmptyState
              onPick={(text) => handleSend(text)}
              character={showsCharacter ? characterState : null}
              context={context}
            />
          ) : (
            <Stack spacing={2} sx={{ pb: 1 }}>
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  showOrb={
                    m.role === 'assistant' &&
                    messages[i - 1]?.role !== 'assistant'
                  }
                  character={showsCharacter}
                />
              ))}
              {isSending && (
                <Box data-chat-item>
                  <ThinkingIndicator />
                </Box>
              )}
              {error && !isSending && (
                <ErrorBanner
                  kind={isOffline ? 'network' : 'server'}
                  onRetry={() => void retry()}
                />
              )}
              {handoff && <HandoffCard />}
            </Stack>
          )}
        </Box>
      </Box>

      <AssistantInput
        value={draft}
        onChange={setDraft}
        onSend={() => handleSend()}
        onFocusChange={setComposerFocused}
        inputDisabled={!ready}
        sendDisabled={!ready || isSending}
      />
    </Box>
  );
};

export default AssistantPage;
