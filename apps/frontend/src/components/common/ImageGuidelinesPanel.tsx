import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Alert, List, ListItem, ListItemText, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

const MAX_IMAGE_SIZE_MB = 10;

interface ImageGuidelinesPanelProps {
  minPhotos?: number;
}

const ImageGuidelinesPanel: React.FC<ImageGuidelinesPanelProps> = ({
  minPhotos = 2,
}) => {
  const { t } = useTranslation();
  const intro = t(
    'business.images.validation.guidelines.intro',
    'For the best listing experience, we recommend:'
  );
  const bullets = [
    t(
      'business.images.validation.guidelines.resolution',
      'At least 800×800 pixels. Sharp, well-lit photos work best.'
    ),
    t(
      'business.images.validation.guidelines.background',
      'Keep the product as the main focus on a clean background.'
    ),
    t(
      'business.images.validation.guidelines.lighting',
      'Avoid very dark or overexposed images.'
    ),
    t(
      'business.images.validation.guidelines.fileSize',
      'Each image must be {{maxSize}} MB or smaller.',
      { maxSize: MAX_IMAGE_SIZE_MB }
    ),
    t(
      'business.images.validation.guidelines.minPhotos',
      'At least {{count}} photos are required to publish a listing.',
      { count: minPhotos }
    ),
  ];

  return (
    <Alert severity="info" icon={<InfoOutlinedIcon />}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {intro}
      </Typography>
      <List dense disablePadding>
        {bullets.map((text) => (
          <ListItem key={text} disablePadding sx={{ py: 0.25 }}>
            <ListItemText primary={text} />
          </ListItem>
        ))}
      </List>
    </Alert>
  );
};

export default ImageGuidelinesPanel;
