import {
  AutoFixHigh as AutoFixHighIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ItemImage } from '../../../types/image';
import { isPrimaryItemImageType } from '../../../utils/orderedItemImages';

interface ItemImagesTabProps {
  images: ItemImage[];
  itemName: string;
  imageActionsBusy: boolean;
  cleanupEnabled: boolean;
  aiTokensRemaining?: number;
  onOpenLightbox: (index: number) => void;
  onSetPrimary: (imageId: string) => void;
  onSetSecondary: (imageId: string) => void;
  onOpenCleanup: (image: ItemImage) => void;
  onBuyTokens?: () => void;
  onManageImages: () => void;
}

interface ImageCardProps {
  image: ItemImage;
  index: number;
  itemName: string;
  isMain: boolean;
  showSetSecondary: boolean;
  imageActionsBusy: boolean;
  cleanupEnabled: boolean;
  aiTokensRemaining?: number;
  onOpenLightbox: (index: number) => void;
  onSetPrimary: (imageId: string) => void;
  onSetSecondary: (imageId: string) => void;
  onOpenCleanup: (image: ItemImage) => void;
  onBuyTokens?: () => void;
}

const ImageCard: React.FC<ImageCardProps> = ({
  image,
  index,
  itemName,
  isMain,
  showSetSecondary,
  imageActionsBusy,
  cleanupEnabled,
  aiTokensRemaining = 0,
  onOpenLightbox,
  onSetPrimary,
  onSetSecondary,
  onOpenCleanup,
  onBuyTokens,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderColor: isMain ? 'primary.main' : 'divider',
        borderWidth: isMain ? 2 : 1,
        transition: 'all 0.3s ease',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
      }}
    >
      <CardMedia
        component="img"
        height="200"
        image={image.image_url}
        alt={image.alt_text || itemName}
        onClick={() => onOpenLightbox(index)}
        sx={{ objectFit: 'cover', cursor: 'pointer' }}
      />
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1 }}
          flexWrap="wrap"
          gap={1}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {isMain
              ? t('business.items.mainImage', 'Main Image')
              : t('business.items.galleryImage', 'Gallery Image')}
          </Typography>
          <Chip
            label={
              isMain
                ? t('business.items.primary', 'Primary')
                : t('business.items.secondary', 'Secondary')
            }
            size="small"
            color={isMain ? 'primary' : 'default'}
            variant={isMain ? 'filled' : 'outlined'}
          />
        </Stack>
        {(!isMain || showSetSecondary) && (
          <Stack spacing={1} sx={{ mb: 1 }}>
            {!isMain && (
              <Button
                size="small"
                variant="outlined"
                disabled={imageActionsBusy}
                onClick={() => onSetPrimary(image.id)}
              >
                {t('business.items.setAsPrimaryImage', 'Set as primary')}
              </Button>
            )}
            {showSetSecondary && (
              <Button
                size="small"
                variant="outlined"
                disabled={imageActionsBusy}
                onClick={() => onSetSecondary(image.id)}
              >
                {t('business.items.setAsSecondaryImage', 'Set as secondary')}
              </Button>
            )}
          </Stack>
        )}
        {cleanupEnabled && (
          <Button
            size="small"
            variant="outlined"
            fullWidth
            startIcon={<AutoFixHighIcon />}
            onClick={() => onOpenCleanup(image)}
            disabled={imageActionsBusy || !!image.is_ai_cleaned}
            sx={{ mb: 1 }}
          >
            {t('business.images.actions.cleanup', 'Cleanup picture')}
          </Button>
        )}
        {!cleanupEnabled && onBuyTokens && !image.is_ai_cleaned && (
          <Button
            size="small"
            variant="outlined"
            fullWidth
            startIcon={<AutoFixHighIcon />}
            onClick={onBuyTokens}
            disabled={imageActionsBusy}
            sx={{ mb: 1 }}
          >
            {t('business.tokens.buyToCleanup', 'Buy tokens to cleanup')}
          </Button>
        )}
        {cleanupEnabled && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {t(
              'business.images.cleanup.tokenCostWithBalance',
              'This uses 1 AI token. You have {{count}} left.',
              { count: aiTokensRemaining }
            )}
          </Typography>
        )}
        {image.alt_text && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {image.alt_text}
          </Typography>
        )}
        {image.caption && (
          <Typography variant="caption" color="text.secondary">
            {image.caption}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const ItemImagesTab: React.FC<ItemImagesTabProps> = ({
  images,
  itemName,
  imageActionsBusy,
  cleanupEnabled,
  aiTokensRemaining = 0,
  onOpenLightbox,
  onSetPrimary,
  onSetSecondary,
  onOpenCleanup,
  onBuyTokens,
  onManageImages,
}) => {
  const { t } = useTranslation();

  return (
    <Card>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {t('business.items.imageManagement', 'Image Management')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<PhotoCameraIcon />}
          onClick={onManageImages}
          size="small"
        >
          {t('business.inventory.manageImages', 'Manage Images')}
        </Button>
      </Box>

      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t(
            'business.items.imageManagementDescription',
            'Upload and manage photos. Tap a picture to open it full screen and use arrows or keyboard to browse. Use “Set as primary” or “Set as secondary” to choose which photo is the main listing image.'
          )}
        </Typography>

        {images.length > 0 ? (
          <Grid container spacing={2}>
            {images.map((image, idx) => {
              const isMain = isPrimaryItemImageType(image.image_type);
              return (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={image.id}>
                  <ImageCard
                    image={image}
                    index={idx}
                    itemName={itemName}
                    isMain={isMain}
                    showSetSecondary={isMain && images.length > 1}
                    imageActionsBusy={imageActionsBusy}
                    cleanupEnabled={cleanupEnabled}
                    aiTokensRemaining={aiTokensRemaining}
                    onOpenLightbox={onOpenLightbox}
                    onSetPrimary={onSetPrimary}
                    onSetSecondary={onSetSecondary}
                    onOpenCleanup={onOpenCleanup}
                    onBuyTokens={onBuyTokens}
                  />
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              bgcolor: 'grey.50',
              borderRadius: 2,
              border: '2px dashed',
              borderColor: 'grey.300',
            }}
          >
            <PhotoCameraIcon sx={{ fontSize: 60, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {t('business.items.noImagesYet', 'No Images Yet')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t(
                'business.items.addFirstImage',
                'Upload images to showcase your product to customers'
              )}
            </Typography>
            <Button
              variant="contained"
              startIcon={<PhotoCameraIcon />}
              onClick={onManageImages}
            >
              {t('business.items.uploadImages', 'Upload Images')}
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default ItemImagesTab;
