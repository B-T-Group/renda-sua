import { Close } from '@mui/icons-material';
import { Box, Button, IconButton, Typography, alpha } from '@mui/material';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { brandTokens } from '../../theme/brandTokens';

export type NudgeDismissReason = 'close' | 'outside' | 'timeout' | 'opened';

/** Auto-hide after 8 s (spec §1 first-run nudge). */
export const NUDGE_AUTO_HIDE_MS = 8000;

export interface AssistantLauncherNudgeProps {
  onDismiss: (reason: NudgeDismissReason) => void;
  onTry: () => void;
  /** Taps inside these elements are not "outside" (the orb handles its own tap). */
  ignoreRef?: React.RefObject<HTMLElement | null>;
}

/** One-time speech bubble anchored to the launcher, pointing at it. */
export function AssistantLauncherNudge({
  onDismiss,
  onTry,
  ignoreRef,
}: AssistantLauncherNudgeProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const textId = `assistant-nudge-text-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const timer = window.setTimeout(
      () => dismissRef.current('timeout'),
      NUDGE_AUTO_HIDE_MS
    );
    const onPointerDown = (e: PointerEvent | MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ref.current?.contains(target)) return;
      if (ignoreRef?.current?.contains(target)) return;
      dismissRef.current('outside');
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [ignoreRef]);

  return (
    <Box
      ref={ref}
      // Announced through the launcher's persistent live region, not here.
      role="group"
      aria-labelledby={textId}
      data-testid="assistant-launcher-nudge"
      sx={{
        position: 'relative',
        width: 'max-content',
        maxWidth: 'min(300px, calc(100vw - 32px))',
        p: 1.5,
        pr: 5,
        borderRadius: '16px',
        backgroundColor: brandTokens.surface.paper,
        border: `1px solid ${brandTokens.surface.border}`,
        boxShadow: `0 1px 2px ${alpha(
          brandTokens.text.primary,
          0.04
        )}, 0 8px 28px ${alpha(brandTokens.text.primary, 0.12)}`,
        // Tail pointing down at the orb (right-aligned over its centre).
        '&::after': {
          content: '""',
          position: 'absolute',
          right: 22,
          bottom: -7,
          width: 12,
          height: 12,
          backgroundColor: brandTokens.surface.paper,
          borderRight: `1px solid ${brandTokens.surface.border}`,
          borderBottom: `1px solid ${brandTokens.surface.border}`,
          transform: 'rotate(45deg)',
        },
      }}
    >
      <Typography
        id={textId}
        variant="body2"
        sx={{
          color: brandTokens.text.primary,
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: 500,
        }}
      >
        {t(
          'assistant.nudge.text',
          'Hi! I can find items, track your order or reorder for you.'
        )}
      </Typography>
      <Box
        sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, mr: -3.5 }}
      >
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={onTry}
          sx={{
            minHeight: 36,
            borderRadius: '18px',
            px: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {t('assistant.nudge.tryIt', 'Try it')}
        </Button>
      </Box>
      <IconButton
        size="small"
        onClick={() => onDismiss('close')}
        aria-label={t('assistant.nudge.dismiss', 'Dismiss')}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          width: 36,
          height: 36,
          color: brandTokens.text.muted,
        }}
      >
        <Close fontSize="small" />
      </IconButton>
    </Box>
  );
}

export default AssistantLauncherNudge;
