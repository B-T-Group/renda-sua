import { Star } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useOrderRatingEligibility } from '../../hooks/useOrderRatingEligibility';

export interface OrderRatingCtasProps {
  orderId: string;
  orderStatus: string;
  size?: 'small' | 'medium';
}

/**
 * Self-contained eligibility-driven rating CTAs for a completed order.
 * Renders nothing until the order is complete and the user can still rate.
 * Navigates to the manage-order page with a ?rate= intent.
 *
 * The eligibility request is deferred until the card is scrolled into view
 * (and deduped/cached by the hook), so long order lists don't fan out one
 * API call per row on load.
 */
const OrderRatingCtas: React.FC<OrderRatingCtasProps> = ({
  orderId,
  orderStatus,
  size = 'small',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const markerRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const isComplete = orderStatus === 'complete';

  useEffect(() => {
    if (!isComplete || visible) return;
    const node = markerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isComplete, visible]);

  const { eligibility } = useOrderRatingEligibility(
    orderId,
    isComplete && visible
  );

  if (isComplete && !visible) {
    return <Box component="span" ref={markerRef} />;
  }
  if (!eligibility) return null;

  const ctas: Array<{ mode: 'agent' | 'item' | 'client'; label: string }> = [];
  if (eligibility.canRateAgent) {
    ctas.push({
      mode: 'agent',
      label: t('orders.actions.rateAgent', 'Rate Delivery Agent'),
    });
  }
  if (eligibility.canRateItem) {
    ctas.push({
      mode: 'item',
      label: t('orders.actions.rateItems', 'Rate Your Items'),
    });
  }
  if (eligibility.canRateClient) {
    ctas.push({
      mode: 'client',
      label: t('orders.actions.rateClient', 'Rate Client'),
    });
  }
  if (ctas.length === 0) return null;

  return (
    <>
      {ctas.map((cta) => (
        <Button
          key={cta.mode}
          variant="outlined"
          color="primary"
          size={size}
          startIcon={<Star fontSize="small" />}
          onClick={() => navigate(`/orders/${orderId}?rate=${cta.mode}`)}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {cta.label}
        </Button>
      ))}
    </>
  );
};

export default OrderRatingCtas;
