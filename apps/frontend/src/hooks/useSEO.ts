import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { SEOHeadProps } from '../components/seo';

export interface PageSEOConfig {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  canonical?: string;
}

export const useSEO = (config: PageSEOConfig = {}): SEOHeadProps => {
  const { t } = useTranslation();
  const location = useLocation();

  const defaultSEO = useMemo(() => {
    const pathname = location.pathname;

    // Default SEO based on route
    switch (pathname) {
      case '/':
        return {
          title: t(
            'seo.home.title',
            'Rendasua - Your Trusted Business Platform'
          ),
          description: t(
            'seo.home.description',
            'Rendasua is a comprehensive business platform connecting agents, businesses, and clients. Streamline your operations, manage inventory, and grow your business with our innovative solutions.'
          ),
          keywords: t(
            'seo.home.keywords',
            'business platform, inventory management, agent dashboard, business dashboard, client management, order management, Rendasua'
          ),
          type: 'website' as const,
        };

      case '/dashboard':
        return {
          title: t('seo.dashboard.title', 'Dashboard - Rendasua'),
          description: t(
            'seo.dashboard.description',
            'Access your personalized dashboard to manage your business operations, view analytics, and track performance.'
          ),
          keywords: t(
            'seo.dashboard.keywords',
            'dashboard, business analytics, performance tracking, Rendasua'
          ),
          type: 'website' as const,
          noindex: true, // Private dashboard
        };

      case '/agent-dashboard':
        return {
          title: t('seo.agent-dashboard.title', 'Agent Dashboard - Rendasua'),
          description: t(
            'seo.agent-dashboard.description',
            'Manage your agent activities, track commissions, and handle client relationships efficiently.'
          ),
          keywords: t(
            'seo.agent-dashboard.keywords',
            'agent dashboard, commission tracking, client management, Rendasua'
          ),
          type: 'website' as const,
          noindex: true, // Private dashboard
        };

      case '/business-dashboard':
        return {
          title: t(
            'seo.business-dashboard.title',
            'Business Dashboard - Rendasua'
          ),
          description: t(
            'seo.business-dashboard.description',
            'Manage your business inventory, track sales, and optimize your operations with our comprehensive dashboard.'
          ),
          keywords: t(
            'seo.business-dashboard.keywords',
            'business dashboard, inventory management, sales tracking, Rendasua'
          ),
          type: 'website' as const,
          noindex: true, // Private dashboard
        };

      case '/profile':
        return {
          title: t('seo.profile.title', 'Profile - Rendasua'),
          description: t(
            'seo.profile.description',
            'Manage your profile information, preferences, and account settings.'
          ),
          keywords: t(
            'seo.profile.keywords',
            'profile, account settings, preferences, Rendasua'
          ),
          type: 'website' as const,
          noindex: true, // Private profile
        };

      case '/client-orders':
        return {
          title: t('seo.client-orders.title', 'Client Orders - Rendasua'),
          description: t(
            'seo.client-orders.description',
            'View and manage your client orders, track order status, and handle customer requests.'
          ),
          keywords: t(
            'seo.client-orders.keywords',
            'client orders, order management, customer service, Rendasua'
          ),
          type: 'website' as const,
          noindex: true, // Private orders
        };

      default:
        // Handle dynamic routes like /business/items/:itemId
        if (pathname.startsWith('/business/items/')) {
          return {
            title: t('seo.item.title', 'Product Details - Rendasua'),
            description: t(
              'seo.item.description',
              'View detailed product information, specifications, and pricing.'
            ),
            keywords: t(
              'seo.item.keywords',
              'product details, item information, pricing, Rendasua'
            ),
            type: 'product' as const,
          };
        }

        return {
          title: t(
            'seo.default.title',
            'Rendasua - Your Trusted Business Platform'
          ),
          description: t(
            'seo.default.description',
            'Rendasua is a comprehensive business platform connecting agents, businesses, and clients.'
          ),
          keywords: t('seo.default.keywords', 'business platform, Rendasua'),
          type: 'website' as const,
        };
    }
  }, [location.pathname, t]);

  return useMemo(
    () => ({
      ...defaultSEO,
      ...config,
      url: 'https://rendasua.com',
      image: config.image || 'https://rendasua.com/og-image.jpg',
    }),
    [defaultSEO, config]
  );
};

export default useSEO;
