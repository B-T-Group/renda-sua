import React from 'react';
import SaleItemFromImageOnboardingPage from './SaleItemFromImageOnboardingPage';

/** Add another sale item using the photo → AI/manual → location flow. */
const AddSaleItemFromImagePage: React.FC = () => (
  <SaleItemFromImageOnboardingPage intent="additional" />
);

export default AddSaleItemFromImagePage;
