import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSwipeImageNavigation } from '../../../hooks/useSwipeImageNavigation';
import { ItemImage } from '../../../types/image';
import { ImageLightboxTapZones } from '../../common/ImageLightboxTapZones';

interface ItemImageLightboxProps {
  images: ItemImage[];
  index: number | null;
  itemName: string;
  onClose: () => void;
  onNavigate: (delta: number) => void;
}

const ItemImageLightbox: React.FC<ItemImageLightboxProps> = ({
  images,
  index,
  itemName,
  onClose,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const swipeEnabled = index !== null && images.length > 1;
  const swipe = useSwipeImageNavigation(
    () => onNavigate(1),
    () => onNavigate(-1),
    swipeEnabled
  );

  const current = index !== null ? images[index] : undefined;

  return (
    <Dialog
      open={index !== null && images.length > 0}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'grey.900', m: { xs: 1, sm: 2 } } }}
    >
      <DialogContent sx={{ p: 0, position: 'relative', bgcolor: 'grey.900' }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 2,
            color: 'common.white',
            bgcolor: 'rgba(0,0,0,0.45)',
          }}
          aria-label={t('common.close', 'Close')}
        >
          <CloseIcon />
        </IconButton>
        {index !== null && current && (
          <>
            <ImageLightboxTapZones
              showTapZones={images.length > 1}
              onPrevious={() => onNavigate(-1)}
              onNext={() => onNavigate(1)}
              previousLabel={t('common.previous', 'Previous')}
              nextLabel={t('common.next', 'Next')}
              onTouchStart={swipe.onTouchStart}
              onTouchEnd={swipe.onTouchEnd}
              wrapperSx={{ mx: 'auto', pt: 5, px: 1 }}
            >
              <Box
                component="img"
                src={current.image_url}
                alt={current.alt_text || itemName}
                sx={{
                  width: '100%',
                  maxHeight: { xs: '70vh', sm: '85vh' },
                  objectFit: 'contain',
                  display: 'block',
                  touchAction: 'pan-y',
                }}
              />
            </ImageLightboxTapZones>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={2}
              sx={{ py: 2, px: 2 }}
            >
              <IconButton
                onClick={() => onNavigate(-1)}
                sx={{ color: 'common.white' }}
                aria-label={t('common.previous', 'Previous')}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="body2" sx={{ color: 'grey.300' }}>
                {t(
                  'business.items.imageLightboxCounter',
                  '{{current}} of {{total}}',
                  { current: index + 1, total: images.length }
                )}
              </Typography>
              <IconButton
                onClick={() => onNavigate(1)}
                sx={{ color: 'common.white' }}
                aria-label={t('common.next', 'Next')}
              >
                <ChevronRightIcon />
              </IconButton>
            </Stack>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ItemImageLightbox;
