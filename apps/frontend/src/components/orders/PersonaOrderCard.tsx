import React from 'react';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { OrderData } from '../../hooks/useOrderById';
import BusinessOrderCard from './business/BusinessOrderCard';
import ClientOrderCard from './client/ClientOrderCard';
import DeliveryOrderCard from './delivery/DeliveryOrderCard';

export interface PersonaOrderCardProps {
  order: OrderData | Record<string, unknown>;
  onActionComplete?: () => void;
}

/**
 * Routes to the persona-specific order card. Prefer this over the legacy
 * shared OrderCard so each persona owns its presentation.
 */
export const PersonaOrderCard: React.FC<PersonaOrderCardProps> = ({
  order,
  onActionComplete,
}) => {
  const { userType, profile } = useUserProfileContext();
  const persona = userType || profile?.user_type_id || 'client';

  if (persona === 'business') {
    return (
      <BusinessOrderCard order={order} onActionComplete={onActionComplete} />
    );
  }
  if (persona === 'agent') {
    return (
      <DeliveryOrderCard order={order} onActionComplete={onActionComplete} />
    );
  }
  return <ClientOrderCard order={order} onActionComplete={onActionComplete} />;
};

export default PersonaOrderCard;
