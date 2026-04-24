import { useEffect } from 'react';
import { environment } from '../config/environment';
import { useMetaPixel } from './useMetaPixel';

const GA_MEASUREMENT_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;

/**
 * Meta Pixel PageView and GA4 page_view (when analytics is on).
 * Use on important static routes so SPA navigations are counted.
 */
export function useTrackPageView(pagePath: string, pageTitle: string) {
  const { track } = useMetaPixel();

  useEffect(() => {
    track('PageView');
    if (!environment.enableAnalytics || !GA_MEASUREMENT_ID) {
      return;
    }
    const g = window.gtag;
    if (typeof g !== 'function') {
      return;
    }
    try {
      g('event', 'page_view', {
        page_path: pagePath,
        page_title: pageTitle,
        page_location: window.location.href,
      });
    } catch {
      // ignore analytics errors
    }
  }, [track, pagePath, pageTitle]);
}
