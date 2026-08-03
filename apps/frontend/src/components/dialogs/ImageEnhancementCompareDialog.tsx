import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ImageEnhancementCompareDialogProps {
  open: boolean;
  onClose: () => void;
  originalUrl: string;
  enhancedUrl: string;
  changes?: string[] | null;
  busy?: boolean;
  useOriginalDisabled?: boolean;
  useEnhancedDisabled?: boolean;
  onUseOriginal: () => void;
  onUseEnhanced: () => void;
}

const ImageEnhancementCompareDialog: React.FC<
  ImageEnhancementCompareDialogProps
> = ({
  open,
  onClose,
  originalUrl,
  enhancedUrl,
  changes,
  busy = false,
  useOriginalDisabled = false,
  useEnhancedDisabled = false,
  onUseOriginal,
  onUseEnhanced,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {t('business.aiImageCleanup.compareTitle', 'Compare enhancement')}
      </DialogTitle>
      <DialogContent>
        {isDesktop ? (
          <CompareSlider originalUrl={originalUrl} enhancedUrl={enhancedUrl} />
        ) : (
          <SideBySide originalUrl={originalUrl} enhancedUrl={enhancedUrl} />
        )}
        {changes && changes.length > 0 ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            {changes.map((change) => (
              <Chip key={change} size="small" label={change} variant="outlined" />
            ))}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={busy}>
          {t('common.close', 'Close')}
        </Button>
        <Button
          variant="outlined"
          onClick={onUseOriginal}
          disabled={busy || useOriginalDisabled || !originalUrl}
        >
          {t('business.aiImageCleanup.useOriginal', 'Use original')}
        </Button>
        <Button
          variant="contained"
          onClick={onUseEnhanced}
          disabled={busy || useEnhancedDisabled || !enhancedUrl}
        >
          {t('business.aiImageCleanup.useEnhanced', 'Use enhanced')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function SideBySide({
  originalUrl,
  enhancedUrl,
}: {
  originalUrl: string;
  enhancedUrl: string;
}) {
  const { t } = useTranslation();
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
      <ComparePane
        label={t('business.images.cleanup.original', 'Original')}
        src={originalUrl}
      />
      <ComparePane
        label={t('business.aiImageCleanup.enhanced', 'Enhanced')}
        src={enhancedUrl}
      />
    </Stack>
  );
}

function ComparePane({ label, src }: { label: string; src: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="subtitle2" gutterBottom color="text.secondary">
        {label}
      </Typography>
      <Box
        component="img"
        src={src}
        alt={label}
        sx={{
          width: '100%',
          maxHeight: 320,
          objectFit: 'contain',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      />
    </Box>
  );
}

function CompareSlider({
  originalUrl,
  enhancedUrl,
}: {
  originalUrl: string;
  enhancedUrl: string;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, next)));
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      updateFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [updateFromClientX]);

  return (
    <Box sx={{ mt: 1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('business.images.cleanup.original', 'Original')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('business.aiImageCleanup.enhanced', 'Enhanced')}
        </Typography>
      </Stack>
      <Box
        ref={containerRef}
        onPointerDown={(e) => {
          draggingRef.current = true;
          updateFromClientX(e.clientX);
        }}
        sx={{
          position: 'relative',
          width: '100%',
          height: 360,
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'ew-resize',
          userSelect: 'none',
          bgcolor: 'action.hover',
        }}
      >
        <Box
          component="img"
          src={enhancedUrl}
          alt={t('business.aiImageCleanup.enhanced', 'Enhanced')}
          sx={imageFillSx}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            clipPath: `inset(0 ${100 - position}% 0 0)`,
          }}
        >
          <Box
            component="img"
            src={originalUrl}
            alt={t('business.images.cleanup.original', 'Original')}
            sx={imageFillSx}
          />
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${position}%`,
            width: 2,
            bgcolor: 'common.white',
            boxShadow: 1,
            transform: 'translateX(-1px)',
            pointerEvents: 'none',
          }}
        />
      </Box>
    </Box>
  );
}

const imageFillSx = {
  position: 'absolute' as const,
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const,
};

export default ImageEnhancementCompareDialog;
