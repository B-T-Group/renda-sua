# SEO Optimization for Rendasua Frontend

This directory contains comprehensive SEO optimization components and utilities for the Rendasua frontend application.

## Components

### SEOHead

A reusable component for managing page-specific SEO meta tags, Open Graph tags, Twitter Cards, and structured data. This component uses direct DOM manipulation for React 19 compatibility.

**Usage:**

```tsx
import { SEOHead } from '../components/seo';
import { useSEO } from '../hooks/useSEO';

const MyPage = () => {
  const seoConfig = useSEO({
    title: 'Custom Page Title',
    description: 'Custom page description',
    keywords: 'custom, keywords',
    type: 'website',
  });

  return (
    <>
      <SEOHead {...seoConfig} />
      {/* Your page content */}
    </>
  );
};
```

**Props:**

- `title`: Page title (default: "Rendasua - Your Trusted Business Platform")
- `description`: Page description
- `keywords`: Comma-separated keywords
- `image`: Open Graph image URL
- `url`: Page URL
- `type`: Content type ('website', 'article', 'product')
- `structuredData`: JSON-LD structured data object
- `noindex`: Boolean to prevent indexing
- `canonical`: Canonical URL

**Technical Implementation:**
The SEOHead component uses direct DOM manipulation via `useEffect` to update meta tags, which ensures compatibility with React 19 and avoids version conflicts with third-party libraries.

### StructuredData

Component for generating JSON-LD structured data for different content types.

**Usage:**

```tsx
import { StructuredData } from '../components/seo';

// Product structured data
<StructuredData
  type="product"
  data={{
    name: "Product Name",
    description: "Product description",
    image: "https://example.com/image.jpg",
    price: "99.99",
    currency: "USD",
    availability: "InStock",
    url: "https://example.com/product"
  }}
/>

// Business structured data
<StructuredData
  type="business"
  data={{
    name: "Business Name",
    description: "Business description",
    url: "https://example.com",
    address: {
      streetAddress: "123 Main St",
      addressLocality: "City",
      addressRegion: "State",
      postalCode: "12345",
      addressCountry: "US"
    }
  }}
/>
```

### Breadcrumbs

Component for generating both visual breadcrumbs and structured data.

**Usage:**

```tsx
import { Breadcrumbs } from '../components/seo';

// Automatic breadcrumbs based on current route
<Breadcrumbs />

// Custom breadcrumbs
<Breadcrumbs
  items={[
    { label: 'Home', path: '/' },
    { label: 'Products', path: '/products' },
    { label: 'Current Page', path: '/products/123', isActive: true }
  ]}
/>
```

## Hooks

### useSEO

Custom hook for managing SEO configuration based on current route and custom overrides.

**Usage:**

```tsx
import { useSEO } from '../hooks/useSEO';

const MyPage = () => {
  const seoConfig = useSEO({
    title: 'Custom Title',
    description: 'Custom description',
    // Override default SEO for this page
  });

  return <SEOHead {...seoConfig} />;
};
```

## SEO Features Implemented

### 1. Meta Tags

- Title tags
- Meta descriptions
- Keywords
- Robots directives
- Language specification

### 2. Open Graph Tags

- og:title
- og:description
- og:image
- og:url
- og:type
- og:site_name
- og:locale

### 3. Twitter Card Tags

- twitter:card
- twitter:title
- twitter:description
- twitter:image
- twitter:url

### 4. Structured Data (JSON-LD)

- Organization schema
- Product schema
- LocalBusiness schema
- BreadcrumbList schema

### 5. Technical SEO

- Canonical URLs
- Robots.txt
- Sitemap.xml
- Web app manifest
- Preconnect for performance

### 6. Internationalization

- Multi-language SEO support
- Language-specific meta tags
- Translated content for search engines

### 7. React 19 Compatibility

- Direct DOM manipulation for meta tags
- No dependency on react-helmet-async
- Compatible with React 19's concurrent features

## File Structure

```
src/components/seo/
├── SEOHead.tsx          # Main SEO component (DOM manipulation)
├── StructuredData.tsx   # JSON-LD structured data
├── Breadcrumbs.tsx      # Breadcrumb navigation
├── SEOExample.tsx       # Example implementation
└── index.ts            # Exports

src/hooks/
└── useSEO.ts           # SEO configuration hook

public/
├── robots.txt          # Search engine directives
├── sitemap.xml         # Site structure
└── site.webmanifest    # PWA manifest
```

## Best Practices

### 1. Page-Specific SEO

- Use the `useSEO` hook for automatic route-based SEO
- Override with custom values when needed
- Set `noindex: true` for private pages

### 2. Structured Data

- Use appropriate schema types for content
- Include all required fields
- Validate with Google's Rich Results Test

### 3. Performance

- Optimize images for Open Graph
- Use preconnect for external resources
- Implement lazy loading for images

### 4. Accessibility

- Use semantic HTML elements
- Include proper ARIA labels
- Ensure keyboard navigation

### 5. Internationalization

- Use translation keys for SEO content
- Set appropriate language meta tags
- Provide language-specific URLs when needed

### 6. React 19 Compatibility

- Avoid third-party SEO libraries that may not support React 19
- Use direct DOM manipulation for meta tag updates
- Test with React 19's concurrent features

## Testing SEO

### 1. Meta Tags

- Use browser developer tools
- Check page source for meta tags
- Validate with SEO tools

### 2. Structured Data

- Use Google's Rich Results Test
- Validate JSON-LD syntax
- Test with Google Search Console

### 3. Performance

- Use Lighthouse for SEO scoring
- Check Core Web Vitals
- Monitor page load times

### 4. React 19 Compatibility

- Test with React 19's concurrent features
- Verify no version conflicts
- Check for hydration issues

## Configuration

### Environment Variables

```env
REACT_APP_SITE_URL=https://rendasua.com
REACT_APP_SITE_NAME=Rendasua
```

### Translation Keys

Add SEO-related translations to locale files:

```json
{
  "seo": {
    "home": {
      "title": "Page Title",
      "description": "Page description",
      "keywords": "keywords"
    }
  },
  "breadcrumbs": {
    "page-name": "Page Display Name"
  }
}
```

## Monitoring

### 1. Search Console

- Monitor search performance
- Check for indexing issues
- Review structured data errors

### 2. Analytics

- Track organic traffic
- Monitor page rankings
- Analyze user behavior

### 3. Performance

- Monitor Core Web Vitals
- Track page load times
- Check mobile performance

## Troubleshooting

### React Version Conflicts

If you encounter React version conflicts:

1. Check for multiple React versions: `npm ls react`
2. Remove conflicting dependencies
3. Use direct DOM manipulation instead of third-party SEO libraries
4. Ensure all dependencies are compatible with React 19

### Meta Tags Not Updating

If meta tags are not updating:

1. Check browser developer tools
2. Verify the SEOHead component is mounted
3. Check for JavaScript errors
4. Ensure the component is re-rendering when props change

## Future Enhancements

1. **Dynamic Sitemap Generation**: Generate sitemap based on actual content
2. **Advanced Structured Data**: Add more schema types (FAQ, HowTo, etc.)
3. **SEO Analytics**: Track SEO performance metrics
4. **A/B Testing**: Test different meta descriptions and titles
5. **Automated SEO Audits**: Regular SEO health checks
6. **Server-Side Rendering**: Implement SSR for better SEO performance
