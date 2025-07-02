import { Box, Paper, Typography } from '@mui/material';
import React from 'react';
import { useSEO } from '../../hooks/useSEO';
import { Breadcrumbs, SEOHead, StructuredData } from './index';
import { ProductStructuredData } from './StructuredData';

const SEOExample: React.FC = () => {
  // Use the SEO hook for automatic SEO configuration
  const seoConfig = useSEO({
    title: 'SEO Example Page - Rendasua',
    description:
      'This is an example page demonstrating SEO optimization features in the Rendasua application.',
    keywords: 'SEO example, optimization, meta tags, structured data, Rendasua',
    type: 'website',
  });

  // Example product data for structured data
  const productData: ProductStructuredData = {
    name: 'Example Product',
    description: 'This is an example product to demonstrate structured data.',
    image: 'https://rendasua.com/example-product.jpg',
    price: '99.99',
    currency: 'USD',
    availability: 'InStock',
    brand: 'Rendasua',
    category: 'Electronics',
    sku: 'EX-001',
    url: 'https://rendasua.com/products/example',
  };

  return (
    <>
      {/* SEO Head component for meta tags */}
      <SEOHead {...seoConfig} />

      {/* Structured data for the product */}
      <StructuredData type="product" data={productData} />

      {/* Breadcrumbs navigation */}
      <Box sx={{ p: 2 }}>
        <Breadcrumbs
          items={[
            { label: 'Home', path: '/' },
            { label: 'Examples', path: '/examples' },
            { label: 'SEO Example', path: '/examples/seo', isActive: true },
          ]}
        />
      </Box>

      {/* Page content */}
      <Box sx={{ p: 3 }}>
        <Typography variant="h1" gutterBottom>
          SEO Optimization Example
        </Typography>

        <Typography variant="h2" gutterBottom>
          Meta Tags
        </Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body1">
            This page demonstrates the implementation of comprehensive SEO
            optimization including:
          </Typography>
          <ul>
            <li>Dynamic meta tags (title, description, keywords)</li>
            <li>Open Graph tags for social media sharing</li>
            <li>Twitter Card tags</li>
            <li>Structured data (JSON-LD)</li>
            <li>Breadcrumb navigation with structured data</li>
            <li>Canonical URLs</li>
            <li>Internationalization support</li>
          </ul>
        </Paper>

        <Typography variant="h2" gutterBottom>
          Structured Data
        </Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body1">
            This page includes structured data for a product, which helps search
            engines understand the content and potentially display rich results.
          </Typography>
        </Paper>

        <Typography variant="h2" gutterBottom>
          Breadcrumbs
        </Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="body1">
            The breadcrumb navigation above provides both visual navigation and
            structured data for search engines.
          </Typography>
        </Paper>

        <Typography variant="h2" gutterBottom>
          How to Use
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            To implement SEO on any page:
          </Typography>
          <ol>
            <li>Import the SEO components from the seo directory</li>
            <li>Use the useSEO hook to get SEO configuration</li>
            <li>Add the SEOHead component with the configuration</li>
            <li>Add structured data components if needed</li>
            <li>Add breadcrumbs for navigation</li>
          </ol>
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            See the README.md file in this directory for detailed code examples
            and usage instructions.
          </Typography>
        </Paper>
      </Box>
    </>
  );
};

export default SEOExample;
