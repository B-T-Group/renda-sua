import React from 'react';
import type { OrderData } from '../../../hooks/useOrderById';
import DeliveryTimeWindowDisplay from '../../common/DeliveryTimeWindowDisplay';

export interface DeliveryWindowCardProps {
  order: OrderData;
}

/** Thin wrapper so persona layouts depend on orders/shared, not common/. */
export const DeliveryWindowCard: React.FC<DeliveryWindowCardProps> = ({
  order,
}) => <DeliveryTimeWindowDisplay order={order} />;

export default DeliveryWindowCard;
