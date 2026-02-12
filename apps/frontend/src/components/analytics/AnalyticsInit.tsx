import { useEffect } from 'react';
import { environment } from '../../config/environment';

declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

const GA_MEASUREMENT_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;

/**
 * Loads Google Analytics 4 when enableAnalytics is true and REACT_APP_GA_MEASUREMENT_ID is set.
 * Injects the gtag script and configures the measurement ID.
 */
export function AnalyticsInit() {
  useEffect(() => {
    if (!environment.enableAnalytics || !GA_MEASUREMENT_ID) {
      return;
    }
    const scriptId = 'ga4-gtag';
    if (document.getElementById(scriptId)) {
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer?.push(arguments);
    };
    window.gtag('js', new Date());

    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: true,
    });
  }, []);

  return null;
}

export default AnalyticsInit;
