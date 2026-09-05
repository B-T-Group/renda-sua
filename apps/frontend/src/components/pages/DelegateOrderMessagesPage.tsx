import React from 'react';
import { Navigate } from 'react-router-dom';
import { OrdersApiPrefixProvider } from '../../contexts/OrdersApiPrefixContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import OrderMessagesPage from './OrderMessagesPage';

/**
 * Order messages in the location-delegate shell. Reuses OrderMessagesPage UI
 * with `/delegate/orders/*` API prefix.
 */
const DelegateOrderMessagesPage: React.FC = () => {
  const { isDelegationContext } = useUserProfileContext();
  if (!isDelegationContext) {
    return <Navigate to="/select-persona" replace />;
  }
  return (
    <OrdersApiPrefixProvider value="/delegate">
      <OrderMessagesPage />
    </OrdersApiPrefixProvider>
  );
};

export default DelegateOrderMessagesPage;
