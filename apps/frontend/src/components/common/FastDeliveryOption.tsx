import {
  AccessTime,
  ExpandLess,
  ExpandMore,
  LocalShipping,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
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
  const [expanded, setExpanded] = useState(false);

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(event.target.checked);
  };

  const handleExpandChange = () => {
    setExpanded(!expanded);
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
      elevation={2}
      sx={{
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.50' : 'background.paper',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <LocalShipping
            color={selected ? 'primary' : 'action'}
            sx={{ mr: 1 }}
          />
          <Typography variant="h6" fontWeight="bold">
            {t('orders.fastDelivery.title', 'Fast Delivery')}
          </Typography>
          <Chip
            label={t('orders.fastDelivery.premium', 'Premium')}
            color="primary"
            size="small"
            sx={{ ml: 2 }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'orders.fastDelivery.description',
            'Get your order delivered in {{minHours}}-{{maxHours}} hours with our premium delivery service.',
            { minHours: config.minHours, maxHours: config.maxHours }
          )}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <AccessTime sx={{ mr: 1, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {t(
              'orders.fastDelivery.timeWindow',
              'Delivery Time: {{minHours}}-{{maxHours}} hours',
              { minHours: config.minHours, maxHours: config.maxHours }
            )}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" color="primary" fontWeight="bold">
            {formatCurrency(config.fee)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {t('orders.fastDelivery.additionalFee', 'additional fee')}
          </Typography>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={selected}
              onChange={handleToggle}
              color="primary"
            />
          }
          label={
            <Typography variant="body1" fontWeight="medium">
              {t('orders.fastDelivery.enableOption', 'Enable Fast Delivery')}
            </Typography>
          }
        />

        <Accordion
          expanded={expanded}
          onChange={handleExpandChange}
          sx={{ mt: 2, boxShadow: 'none' }}
        >
          <AccordionSummary
            expandIcon={expanded ? <ExpandLess /> : <ExpandMore />}
            sx={{
              minHeight: 40,
              '& .MuiAccordionSummary-content': {
                margin: '8px 0',
              },
            }}
          >
            <Typography variant="body2" fontWeight="medium">
              {t('orders.fastDelivery.operatingHours', 'Operating Hours')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(config.operatingHours).map(
                ([day, hours]: [string, OperatingHours]) => (
                  <Box
                    key={day}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      p: 1,
                      borderRadius: 1,
                      bgcolor: hours.enabled ? 'success.50' : 'grey.100',
                      border: 1,
                      borderColor: hours.enabled ? 'success.200' : 'grey.300',
                      minWidth: { xs: '100%', sm: 'calc(50% - 4px)' },
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      sx={{ minWidth: 80 }}
                    >
                      {getDayName(day)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={hours.enabled ? 'success.main' : 'text.disabled'}
                      sx={{ ml: 1 }}
                    >
                      {hours.enabled
                        ? `${formatTime(hours.start)} - ${formatTime(
                            hours.end
                          )}`
                        : t('common.closed', 'Closed')}
                    </Typography>
                  </Box>
                )
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default FastDeliveryOption;
