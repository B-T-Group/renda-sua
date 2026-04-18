import { Box, ButtonBase } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode, SyntheticEvent, TouchEventHandler } from 'react';

export interface ImageLightboxTapZonesProps {
  /** When false, only the wrapper (and optional swipe) is applied. */
  showTapZones: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
  children: ReactNode;
  wrapperSx?: SxProps<Theme>;
}

/**
 * Wraps a lightbox image with invisible left/right tap targets (prev/next).
 * Touch-swipe handlers belong on this wrapper so they still receive events
 * when tap zones sit above the sides of the image.
 */
export function ImageLightboxTapZones({
  showTapZones,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  onTouchStart,
  onTouchEnd,
  children,
  wrapperSx,
}: ImageLightboxTapZonesProps) {
  const stopNavClick = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <Box
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      sx={{
        position: 'relative',
        display: 'block',
        maxWidth: '100%',
        ...wrapperSx,
      }}
    >
      {children}
      {showTapZones ? (
        <>
          <ButtonBase
            focusRipple
            aria-label={previousLabel}
            onClick={(e) => {
              stopNavClick(e);
              onPrevious();
            }}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '35%',
              zIndex: 1,
              borderRadius: 0,
              bgcolor: 'transparent',
            }}
          />
          <ButtonBase
            focusRipple
            aria-label={nextLabel}
            onClick={(e) => {
              stopNavClick(e);
              onNext();
            }}
            sx={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '35%',
              zIndex: 1,
              borderRadius: 0,
              bgcolor: 'transparent',
            }}
          />
        </>
      ) : null}
    </Box>
  );
}
