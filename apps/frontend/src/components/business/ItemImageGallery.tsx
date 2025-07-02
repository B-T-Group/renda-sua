import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import {
  Box,
  Card,
  CardMedia,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemImage } from '../../types/image';

interface ItemImageGalleryProps {
  images: ItemImage[];
  itemName: string;
}

export default function ItemImageGallery({
  images,
  itemName,
}: ItemImageGalleryProps) {
  const { t } = useTranslation();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <Paper
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          backgroundColor: 'grey.100',
        }}
      >
        <Typography variant="body1" color="text.secondary">
          {t('business.inventory.noImages')}
        </Typography>
      </Paper>
    );
  }

  const handlePrevious = () => {
    setSelectedImageIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setSelectedImageIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const selectedImage = images[selectedImageIndex];

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('business.inventory.images')}
      </Typography>

      {/* Main Image */}
      <Box sx={{ position: 'relative', mb: 2 }}>
        <Card>
          <CardMedia
            component="img"
            image={selectedImage.image_url}
            alt={
              selectedImage.alt_text ||
              `${itemName} - ${selectedImage.image_type}`
            }
            sx={{
              height: 400,
              objectFit: 'contain',
              backgroundColor: 'grey.50',
            }}
          />
        </Card>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                },
              }}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                },
              }}
            >
              <ChevronRight />
            </IconButton>
          </>
        )}
      </Box>

      {/* Thumbnails */}
      {images.length > 1 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {images.map((image, index) => (
            <Card
              key={image.id}
              sx={{
                cursor: 'pointer',
                border: index === selectedImageIndex ? 2 : 1,
                borderColor:
                  index === selectedImageIndex ? 'primary.main' : 'grey.300',
                '&:hover': {
                  borderColor: 'primary.main',
                },
              }}
              onClick={() => handleThumbnailClick(index)}
            >
              <CardMedia
                component="img"
                image={image.image_url}
                alt={image.alt_text || `${itemName} - ${image.image_type}`}
                sx={{
                  width: 80,
                  height: 80,
                  objectFit: 'cover',
                }}
              />
            </Card>
          ))}
        </Box>
      )}

      {/* Image Info */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t('business.inventory.imageType')}: {selectedImage.image_type}
        </Typography>
        {selectedImage.alt_text && (
          <Typography variant="body2" color="text.secondary">
            {t('business.inventory.altText')}: {selectedImage.alt_text}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          {t('business.inventory.imageCount')}: {images.length} /{' '}
          {selectedImageIndex + 1}
        </Typography>
      </Box>
    </Paper>
  );
}
