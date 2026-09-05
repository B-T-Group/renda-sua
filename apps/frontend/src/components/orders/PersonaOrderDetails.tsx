import React from 'react';
import type { OrderData } from '../../hooks/useOrderById';
import BusinessOrderDetails from './business/BusinessOrderDetails';
import ClientOrderDetails from './client/ClientOrderDetails';
import DeliveryOrderDetails from './delivery/DeliveryOrderDetails';

export type OrderPersona = 'client' | 'business' | 'agent';

export interface PersonaOrderDetailsProps {
  persona: OrderPersona;
  order: OrderData;
  live?: boolean;
  onRefresh?: () => void;
  alerts?: React.ReactNode;
  messages?: React.ReactNode;
  tracking?: React.ReactNode;
  extras?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  hideDeliveryPin?: boolean;
  hideActions?: boolean;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
}

export const PersonaOrderDetails: React.FC<PersonaOrderDetailsProps> = ({
  persona,
  hideDeliveryPin,
  hideActions,
  ...props
}) => {
  if (persona === 'business') {
    return <BusinessOrderDetails {...props} hideActions={hideActions} />;
  }
  if (persona === 'agent') {
    return <DeliveryOrderDetails {...props} hideActions={hideActions} />;
  }
  return (
    <ClientOrderDetails
      {...props}
      hideDeliveryPin={hideDeliveryPin}
      hideActions={hideActions}
    />
  );
};

export default PersonaOrderDetails;
