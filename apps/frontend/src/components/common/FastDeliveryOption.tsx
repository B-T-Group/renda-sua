import {
  AccessTime,
  ExpandLess,
  ExpandMore,
  LocalShipping,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  FormControlLabel,
  IconButton,
  Switch,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FastDeliveryConfig } from '../../hooks/useFastDeliveryConfig';

interface FastDeliveryOptionProps {
  config: FastDeliveryConfig | null;
  selected: boolean;
  onToggle: (enabled: boolean) => void;
  formatCurrency: (amount: number) => string;
}

interface OperatingHours {
  start: string;
  end: string;
  enabled: boolean;
}

const FastDeliveryOption: React.FC<FastDeliveryOptionProps> = ({
  config,
  selected,
  onToggle,
  formatCurrency,
}) => {
  const { t } = useTranslation();
  const [operatingHoursExpanded, setOperatingHoursExpanded] = useState(false);

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(event.target.checked);
  };

  const handleOperatingHoursToggle = () => {
    setOperatingHoursExpanded(!operatingHoursExpanded);
  };

  const formatTime = (time: string) => {
    return time;
  };

  const getDayName = (day: string) => {
    const dayMap: { [key: string]: string } = {
      monday: t('common.days.monday', 'Monday'),
      tuesday: t('common.days.tuesday', 'Tuesday'),
      wednesday: t('common.days.wednesday', 'Wednesday'),
      thursday: t('common.days.thursday', 'Thursday'),
      friday: t('common.days.friday', 'Friday'),
      saturday: t('common.days.saturday', 'Saturday'),
      sunday: t('common.days.sunday', 'Sunday'),
    };
    return dayMap[day] || day;
  };

  if (!config || !config.enabled) {
    return null;
  }

  return (
    <Card
      elevation={selected ? 4 : 2}
      sx={{
        border: selected ? 3 : 2,
        borderColor: selected ? 'primary.main' : 'primary.200',
        bgcolor: selected ? 'primary.50' : 'background.paper',
        background: selected
          ? 'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(25, 118, 210, 0.04) 100%)'
          : 'background.paper',
        transition: 'all 0.3s ease-in-out',
        boxShadow: selected
          ? '0 8px 24px rgba(25, 118, 210, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        '&:hover': {
          boxShadow: selected
            ? '0 12px 32px rgba(25, 118, 210, 0.3)'
            : '0 4px 12px rgba(0, 0, 0, 0.15)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <LocalShipping
            color="primary"
            sx={{
              mr: 1,
              fontSize: 32,
              filter: selected
                ? 'drop-shadow(0 2px 4px rgba(25, 118, 210, 0.3))'
                : 'none',
            }}
          />
          <Typography variant="h5" fontWeight="bold" color="primary">
            {t('orders.fastDelivery.title', 'Fast Delivery')}
          </Typography>
          <Chip
            label={t('orders.fastDelivery.premium', 'Premium')}
            color="primary"
            size="small"
            sx={{
              ml: 2,
              fontWeight: 'bold',
              boxShadow: selected
                ? '0 2px 4px rgba(25, 118, 210, 0.3)'
                : 'none',
            }}
          />
        </Box>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'orders.fastDelivery.description',
            'Get your order delivered in {{minHours}}-{{maxHours}} hours with our premium delivery service.',
            { minHours: config.minHours, maxHours: config.maxHours }
          )}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AccessTime sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="body1" fontWeight="medium" color="primary">
            {t(
              'orders.fastDelivery.timeWindow',
              'Delivery Time: {{minHours}}-{{maxHours}} hours',
              { minHours: config.minHours, maxHours: config.maxHours }
            )}
          </Typography>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={selected}
              onChange={handleToggle}
              color="primary"
              size="medium"
            />
          }
          label={
            <Typography variant="body1" fontWeight="bold">
              {t('orders.fastDelivery.enableOption', 'Enable Fast Delivery')}
            </Typography>
          }
          sx={{ mb: 3 }}
        />

        {/* Operating Hours - Collapsible */}
        <Box sx={{ mt: 3, pt: 2, borderTop: 2, borderColor: 'divider' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
            onClick={handleOperatingHoursToggle}
          >
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              color="primary"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <AccessTime />
              {t('orders.fastDelivery.operatingHours', 'Operating Hours')}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleOperatingHoursToggle();
              }}
              sx={{ color: 'primary.main' }}
            >
              {operatingHoursExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          <Collapse in={operatingHoursExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {Object.entries(config.operatingHours).map(
                ([day, hours]: [string, OperatingHours]) => (
                  <Box
                    key={day}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: hours.enabled ? 'success.50' : 'grey.100',
                      border: 2,
                      borderColor: hours.enabled ? 'success.main' : 'grey.300',
                      minWidth: { xs: '100%', sm: 'calc(50% - 6px)' },
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: hours.enabled
                          ? '0 4px 8px rgba(46, 125, 50, 0.2)'
                          : '0 2px 4px rgba(0, 0, 0, 0.1)',
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      sx={{ minWidth: 90 }}
                    >
                      {getDayName(day)}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      color={hours.enabled ? 'success.main' : 'text.disabled'}
                      sx={{ ml: 1 }}
                    >
                      {hours.enabled
                        ? `${formatTime(hours.start)} - ${formatTime(hours.end)}`
                        : t('common.closed', 'Closed')}
                    </Typography>
                  </Box>
                )
              )}
            </Box>
          </Collapse>
        </Box>
      </CardContent>
    </Card>
  );
};

export default FastDeliveryOption;
