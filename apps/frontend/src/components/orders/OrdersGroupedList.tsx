import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Order } from '../../hooks/useOrders';
import { partitionOrdersByActivity } from '../../utils/orderListGrouping';
import OrderCard from '../common/OrderCard';

export interface OrdersGroupedListProps {
  orders: Order[];
  onActionComplete: () => void;
}

const OrdersGroupedList: React.FC<OrdersGroupedListProps> = ({
  orders,
  onActionComplete,
}) => {
  const { t } = useTranslation();
  const { active, completed, cancelled } = partitionOrdersByActivity(orders);

  const renderOrderCards = (sectionOrders: Order[]) =>
    sectionOrders.map((order) => (
      <OrderCard
        key={order.id}
        order={order}
        onActionComplete={onActionComplete}
      />
    ));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {active.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(completed.length > 0 || cancelled.length > 0) && (
            <Typography variant="subtitle1" fontWeight={600}>
              {t('orders.sections.activeOrders', 'Active orders')}
            </Typography>
          )}
          {renderOrderCards(active)}
        </Box>
      )}

      {completed.length > 0 && (
        <Accordion
          defaultExpanded={false}
          disableGutters
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>
              {t('orders.sections.completedOrders', 'Completed orders')}
            </Typography>
            <Chip label={completed.length} size="small" sx={{ ml: 1.5 }} />
          </AccordionSummary>
          <AccordionDetails
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}
          >
            {renderOrderCards(completed)}
          </AccordionDetails>
        </Accordion>
      )}

      {cancelled.length > 0 && (
        <Accordion
          defaultExpanded={false}
          disableGutters
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>
              {t('orders.sections.cancelledOrders', 'Cancelled orders')}
            </Typography>
            <Chip label={cancelled.length} size="small" sx={{ ml: 1.5 }} />
          </AccordionSummary>
          <AccordionDetails
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}
          >
            {renderOrderCards(cancelled)}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default OrdersGroupedList;
