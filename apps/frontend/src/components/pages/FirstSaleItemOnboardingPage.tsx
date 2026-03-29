import React from 'react';
import SaleItemFromImageOnboardingPage from './SaleItemFromImageOnboardingPage';

/** First-product onboarding route; same flow as “add from image” with first-time copy. */
const FirstSaleItemOnboardingPage: React.FC = () => (
  <SaleItemFromImageOnboardingPage intent="first" />
);

export default FirstSaleItemOnboardingPage;
