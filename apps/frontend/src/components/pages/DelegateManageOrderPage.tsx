import React from 'react';
import { Navigate } from 'react-router-dom';
import { OrdersApiPrefixProvider } from '../../contexts/OrdersApiPrefixContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import ManageOrderPage from './ManageOrderPage';

/**
 * Order detail in the location-delegate shell. Reuses ManageOrderPage UI with
 * `/delegate/orders/*` API prefix.
 */
const DelegateManageOrderPage: React.FC = () => {
  const { isDelegationContext } = useUserProfileContext();
  if (!isDelegationContext) {
    return <Navigate to="/select-persona" replace />;
  }
  return (
    <OrdersApiPrefixProvider value="/delegate">
      <ManageOrderPage />
    </OrdersApiPrefixProvider>
  );
};

export default DelegateManageOrderPage;
