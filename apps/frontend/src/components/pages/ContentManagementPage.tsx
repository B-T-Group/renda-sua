import { Box, Typography } from '@mui/material';
import React from 'react';
import { useLocation } from 'react-router-dom';
import BrandsManagementPage from './BrandsManagementPage';
import CategoriesManagementPage from './CategoriesManagementPage';

const ContentManagementPage: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;

  // Determine which sub-page to render based on the current route
  const renderSubPage = () => {
    if (pathname.includes('/content-management/brands')) {
      return <BrandsManagementPage />;
    } else if (pathname.includes('/content-management/categories')) {
      return <CategoriesManagementPage />;
    } else {
      // Default view - show overview or redirect to brands
      return (
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Content Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a content management option from the navigation menu to
            manage brands, categories, and subcategories.
          </Typography>
        </Box>
      );
    }
  };

  return <Box>{renderSubPage()}</Box>;
};

export default ContentManagementPage;
