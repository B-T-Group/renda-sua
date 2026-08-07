import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  structuredData?: object;
  noindex?: boolean;
  canonical?: string;
}

function seoLocaleFromLanguage(lng: string | undefined): {
  language: string;
  ogLocale: string;
} {
  const code = lng?.split(/[-_]/)[0]?.toLowerCase();
  if (code === 'en') {
    return { language: 'English', ogLocale: 'en_US' };
  }
  return { language: 'French', ogLocale: 'fr_FR' };
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'Rendasua - Your Trusted Business Platform',
  description = 'Rendasua is a comprehensive business platform connecting agents, businesses, and clients. Streamline your operations, manage inventory, and grow your business with our innovative solutions.',
  keywords = 'business platform, inventory management, agent dashboard, business dashboard, client management, order management, Rendasua',
  image = 'https://rendasua.com/og-image.jpg',
  url = 'https://rendasua.com',
  type = 'website',
  structuredData,
  noindex = false,
  canonical,
}) => {
  const { i18n } = useTranslation();
  const fullUrl = canonical || `${url}${window.location.pathname}`;
  const fullImageUrl = image.startsWith('http') ? image : `${url}${image}`;
  const { language, ogLocale } = seoLocaleFromLanguage(i18n.language);

  useEffect(() => {
    document.title = title;

    const updateMetaTag = (name: string, content: string, property = false) => {
      const selector = property
        ? `meta[property="${name}"]`
        : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;

      if (!meta) {
        meta = document.createElement('meta');
        if (property) {
          meta.setAttribute('property', name);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }

      meta.setAttribute('content', content);
    };

    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', 'Rendasua');
    updateMetaTag('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    updateMetaTag('language', language);

    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', fullImageUrl, true);
    updateMetaTag('og:url', fullUrl, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', 'Rendasua', true);
    updateMetaTag('og:locale', ogLocale, true);

    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', fullImageUrl);
    updateMetaTag('twitter:url', fullUrl);

    let canonicalLink = document.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', fullUrl);

    if (structuredData) {
      const existingScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      existingScripts.forEach((script) => {
        if (script.textContent?.includes('@context')) {
          script.remove();
        }
      });

      const script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      // Next page updates meta tags on mount.
    };
  }, [
    title,
    description,
    keywords,
    fullImageUrl,
    fullUrl,
    type,
    structuredData,
    noindex,
    language,
    ogLocale,
  ]);

  return null;
};

export default SEOHead;
