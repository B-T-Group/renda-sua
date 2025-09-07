import { Construction as ConstructionIcon } from '@mui/icons-material';
import { Alert, Box, Card, CardContent, Chip, Typography } from '@mui/material';
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
      variant="filled"
      sx={{
        mb: 2,
        '& .MuiAlert-message': {
          width: '100%',
        },
        ...sx,
      }}
    >
      <Box>
        <Typography
          variant="subtitle2"
          fontWeight="bold"
          gutterBottom
          color="inherit"
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="inherit"
          paragraph
          sx={{ opacity: 0.9 }}
        >
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
                sx={{
                  mr: 1,
                  mb: 0.5,
                  color: 'inherit',
                  borderColor: 'inherit',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiChip-label': {
                    color: 'inherit',
                  },
                }}
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
        backgroundColor: `${severity}.main`,
        color: `${severity}.contrastText`,
        ...sx,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ color: 'inherit' }}>{defaultIcon}</Box>
          <Typography
            variant="h6"
            sx={{ ml: 1, fontWeight: 'bold', color: 'inherit' }}
          >
            {title}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          color="inherit"
          paragraph
          sx={{ opacity: 0.9 }}
        >
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
                sx={{
                  mr: 1,
                  mb: 0.5,
                  color: 'inherit',
                  borderColor: 'inherit',
                  '& .MuiChip-label': {
                    color: 'inherit',
                  },
                }}
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
