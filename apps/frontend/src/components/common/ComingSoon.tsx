import {
  AccessTime as AccessTimeIcon,
  Construction as ConstructionIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ComingSoonProps {
  title: string;
  description: string;
  features?: string[];
  variant?: 'alert' | 'card' | 'chip';
  severity?: 'info' | 'warning' | 'success';
  icon?: React.ReactNode;
  sx?: any;
}

const ComingSoon: React.FC<ComingSoonProps> = ({
  title,
  description,
  features = [],
  variant = 'alert',
  severity = 'info',
  icon,
  sx = {},
}) => {
  const { t } = useTranslation();

  const defaultIcon = icon || <ConstructionIcon />;

  const renderAlert = () => (
    <Alert
      severity={severity}
      icon={defaultIcon}
      variant="outlined"
      sx={{
        mb: 2,
        '& .MuiAlert-message': {
          width: '100%',
        },
        ...sx,
      }}
    >
      <Box>
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {description}
        </Typography>
        {features.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {features.map((feature, index) => (
              <Chip
                key={index}
                label={feature}
                size="small"
                variant="outlined"
                sx={{ mr: 1, mb: 0.5 }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Alert>
  );

  const renderCard = () => (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        border: `2px dashed ${
          severity === 'info'
            ? 'primary.main'
            : severity === 'warning'
            ? 'warning.main'
            : 'success.main'
        }`,
        backgroundColor: `${severity}.light`,
        ...sx,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {defaultIcon}
          <Typography variant="h6" sx={{ ml: 1, fontWeight: 'bold' }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          {description}
        </Typography>
        {features.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {features.map((feature, index) => (
              <Chip
                key={index}
                label={feature}
                size="small"
                variant="outlined"
                sx={{ mr: 1, mb: 0.5 }}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderChip = () => (
    <Chip
      icon={defaultIcon}
      label={title}
      variant="outlined"
      color={severity}
      sx={{
        mb: 1,
        '& .MuiChip-label': {
          fontWeight: 'bold',
        },
        ...sx,
      }}
    />
  );

  switch (variant) {
    case 'card':
      return renderCard();
    case 'chip':
      return renderChip();
    case 'alert':
    default:
      return renderAlert();
  }
};

export default ComingSoon;
