import React from 'react';
import { Navigate } from 'react-router-dom';

/** Legacy route: `/business/rentals` redirects to the rental catalog. */
const BusinessRentalsPage: React.FC = () => (
  <Navigate to="/business/rentals/catalog" replace />
);

export default BusinessRentalsPage;
