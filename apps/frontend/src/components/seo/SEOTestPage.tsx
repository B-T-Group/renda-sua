import { Box, Button, Paper, Typography } from '@mui/material';
import React from 'react';
import { useSEO } from '../../hooks/useSEO';
import { Breadcrumbs, SEOHead, StructuredData } from './index';
import { ProductStructuredData } from './StructuredData';

const SEOTestPage: React.FC = () => {
  // Test SEO configuration
  const seoConfig = useSEO({
    title: 'SEO Test Page - Rendasua',
    description:
      'This is a test page to verify SEO optimization features are working correctly.',
    keywords: 'SEO test, verification, meta tags, structured data, Rendasua',
    type: 'website',
  });

  // Test product data
  const testProductData: ProductStructuredData = {
    name: 'Test Product',
    description: 'A test product for SEO verification',
    image: 'https://rendasua.com/test-product.jpg',
    price: '29.99',
    currency: 'USD',
    availability: 'InStock',
    brand: 'Rendasua',
    category: 'Test Category',
    sku: 'TEST-001',
    url: 'https://rendasua.com/test-product',
  };

  return (
    <>
      {/* SEO Head component */}
      <SEOHead {...seoConfig} />

      {/* Structured data for testing */}
      <StructuredData type="product" data={testProductData} />

      {/* Breadcrumbs */}
      <Box sx={{ p: 2 }}>
        <Breadcrumbs
          items={[
            { label: 'Home', path: '/' },
            { label: 'Test', path: '/test' },
            { label: 'SEO Test', path: '/test/seo', isActive: true },
          ]}
        />
      </Box>

      {/* Page content */}
      <Box sx={{ p: 3 }}>
        <Typography variant="h1" gutterBottom>
          SEO Test Page
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            Meta Tags Test
          </Typography>
          <Typography variant="body1" paragraph>
            This page should have the following meta tags:
          </Typography>
          <ul>
            <li>Title: "SEO Test Page - Rendasua"</li>
            <li>
              Description: "This is a test page to verify SEO optimization
              features are working correctly."
            </li>
            <li>
              Keywords: "SEO test, verification, meta tags, structured data,
              Rendasua"
            </li>
            <li>Open Graph tags for social media sharing</li>
            <li>Twitter Card tags</li>
          </ul>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            Structured Data Test
          </Typography>
          <Typography variant="body1" paragraph>
            This page includes structured data for a test product. You can
            verify this by:
          </Typography>
          <ol>
            <li>Opening browser developer tools</li>
            <li>Going to the Elements tab</li>
            <li>Looking for a script tag with type="application/ld+json"</li>
            <li>Checking that it contains product structured data</li>
          </ol>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            Breadcrumbs Test
          </Typography>
          <Typography variant="body1" paragraph>
            The breadcrumbs above should:
          </Typography>
          <ul>
            <li>Show the current navigation path</li>
            <li>Include structured data for search engines</li>
            <li>Be properly styled with Material-UI</li>
          </ul>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h2" gutterBottom>
            How to Verify
          </Typography>
          <Typography variant="body1" paragraph>
            To verify that SEO is working correctly:
          </Typography>
          <ol>
            <li>Check the page title in the browser tab</li>
            <li>View page source and look for meta tags</li>
            <li>Use browser developer tools to inspect the head section</li>
            <li>Test with Google's Rich Results Test tool</li>
            <li>Check social media preview tools</li>
          </ol>

          <Button
            variant="contained"
            onClick={() =>
              window.open(
                'https://search.google.com/test/rich-results',
                '_blank'
              )
            }
            sx={{ mt: 2 }}
          >
            Test with Google Rich Results
          </Button>
        </Paper>
      </Box>
    </>
  );
};

export default SEOTestPage;
