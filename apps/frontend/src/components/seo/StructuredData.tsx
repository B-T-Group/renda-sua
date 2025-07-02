import { useMemo } from 'react';

export interface ProductStructuredData {
  name: string;
  description: string;
  image: string;
  price: string;
  currency: string;
  availability: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  category?: string;
  sku?: string;
  url: string;
}

export interface BusinessStructuredData {
  name: string;
  description: string;
  url: string;
  logo?: string;
  address?: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  contactPoint?: {
    telephone: string;
    contactType: string;
    email?: string;
  };
  sameAs?: string[];
}

export interface BreadcrumbStructuredData {
  items: Array<{
    name: string;
    url: string;
  }>;
}

interface StructuredDataProps {
  type: 'product' | 'business' | 'breadcrumb' | 'organization';
  data:
    | ProductStructuredData
    | BusinessStructuredData
    | BreadcrumbStructuredData;
}

const StructuredData: React.FC<StructuredDataProps> = ({ type, data }) => {
  const structuredData = useMemo(() => {
    switch (type) {
      case 'product':
        const productData = data as ProductStructuredData;
        return {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: productData.name,
          description: productData.description,
          image: productData.image,
          offers: {
            '@type': 'Offer',
            price: productData.price,
            priceCurrency: productData.currency,
            availability: `https://schema.org/${productData.availability}`,
            url: productData.url,
          },
          ...(productData.brand && {
            brand: { '@type': 'Brand', name: productData.brand },
          }),
          ...(productData.category && { category: productData.category }),
          ...(productData.sku && { sku: productData.sku }),
        };

      case 'business':
        const businessData = data as BusinessStructuredData;
        return {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: businessData.name,
          description: businessData.description,
          url: businessData.url,
          ...(businessData.logo && { logo: businessData.logo }),
          ...(businessData.address && {
            address: {
              '@type': 'PostalAddress',
              streetAddress: businessData.address.streetAddress,
              addressLocality: businessData.address.addressLocality,
              addressRegion: businessData.address.addressRegion,
              postalCode: businessData.address.postalCode,
              addressCountry: businessData.address.addressCountry,
            },
          }),
          ...(businessData.contactPoint && {
            contactPoint: {
              '@type': 'ContactPoint',
              telephone: businessData.contactPoint.telephone,
              contactType: businessData.contactPoint.contactType,
              ...(businessData.contactPoint.email && {
                email: businessData.contactPoint.email,
              }),
            },
          }),
          ...(businessData.sameAs && { sameAs: businessData.sameAs }),
        };

      case 'breadcrumb':
        const breadcrumbData = data as BreadcrumbStructuredData;
        return {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbData.items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
          })),
        };

      case 'organization':
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Rendasua',
          url: 'https://rendasua.com',
          logo: 'https://rendasua.com/logo.png',
          description:
            'Rendasua is a comprehensive business platform connecting agents, businesses, and clients.',
          sameAs: [
            'https://twitter.com/rendasua',
            'https://linkedin.com/company/rendasua',
          ],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            email: 'support@rendasua.com',
          },
        };

      default:
        return null;
    }
  }, [type, data]);

  if (!structuredData) return null;

  return (
    <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
  );
};

export default StructuredData;
