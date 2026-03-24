import {
  Badge,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Skeleton,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const ORDER_STATUS_BOX_COLORS: Record<string, string> = {
  pending: '#fff3e0',
  pending_payment: '#fff8e1',
  confirmed: '#e3f2fd',
  preparing: '#e3f2fd',
  ready_for_pickup: '#e8eaf6',
  assigned_to_agent: '#e8eaf6',
  picked_up: '#e1f5fe',
  in_transit: '#e1f5fe',
  out_for_delivery: '#e0f7fa',
  delivered: '#e8f5e9',
  complete: '#e8f5e9',
  completed: '#e8f5e9',
};

const getOrderStatusBoxColor = (status: string): string =>
  ORDER_STATUS_BOX_COLORS[status] ?? '#f5f5f5';

export interface BusinessDashboardModule {
  title: string;
  description: string;
  icon: React.ReactNode;
  count: number | null;
  color: string;
  path: string;
  orderCountByStatus?: Record<string, number>;
  showBadge?: boolean;
  countBreakdown?: {
    verified: number;
    other: number;
    otherLabel: string;
  };
}

export interface BusinessDashboardModuleCardProps {
  module: BusinessDashboardModule;
  isLoading: boolean;
}

const BusinessDashboardModuleCard: React.FC<BusinessDashboardModuleCardProps> = ({
  module: card,
  isLoading,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card
      elevation={0}
      sx={{
        width: {
          xs: '100%',
          sm: 'calc(50% - 12px)',
          md: 'calc(33.333% - 16px)',
        },
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 3,
          borderColor: 'action.hover',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 2,
            color: card.color,
          }}
        >
          {card.icon}
        </Box>
        <Typography variant="h6" component="h2" gutterBottom>
          {card.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {card.description}
        </Typography>
        {card.count !== null && (
          <Badge
            badgeContent={card.showBadge ? card.count : 0}
            color="error"
            invisible={!card.showBadge}
          >
            <Typography
              variant="h4"
              component="div"
              color="primary"
              sx={{ mb: 1 }}
            >
              {isLoading ? (
                <Skeleton
                  variant="text"
                  width={60}
                  height={40}
                  sx={{ mx: 'auto' }}
                />
              ) : (
                card.count
              )}
            </Typography>
          </Badge>
        )}
        {card.countBreakdown && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1 }}
            component="div"
          >
            {t('business.dashboard.verified', 'Verified')}:{' '}
            {card.countBreakdown.verified} · {card.countBreakdown.otherLabel}:{' '}
            {card.countBreakdown.other}
          </Typography>
        )}
        {card.orderCountByStatus &&
          Object.keys(card.orderCountByStatus).length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
                mt: 1,
                justifyContent: 'center',
              }}
            >
              {Object.entries(card.orderCountByStatus)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([status, n]) => (
                  <Box
                    key={status}
                    sx={{
                      bgcolor: getOrderStatusBoxColor(status),
                      color: 'text.primary',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}
                  >
                    {t(`common.orderStatus.${status}`, status)}: {n}
                  </Box>
                ))}
            </Box>
          )}
      </CardContent>
      <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button
          variant="contained"
          onClick={() => navigate(card.path)}
          disabled={isLoading}
          sx={{
            backgroundColor: card.color,
            '&:hover': {
              backgroundColor: card.color,
              opacity: 0.9,
            },
          }}
        >
          {t('common.manage')}
        </Button>
      </CardActions>
    </Card>
  );
};

export default BusinessDashboardModuleCard;
