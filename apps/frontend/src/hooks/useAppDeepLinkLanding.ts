import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  appRelativeFromLocation,
  isInAppBrowser,
  mapAppPathToWeb,
  openAppHref,
  shouldAutoOpenApp,
} from '../utils/appDeepLink';

export function useAppDeepLinkLanding(): {
  inAppBrowser: boolean;
  openHref: string;
  webFallbackPath: string;
} {
  const location = useLocation();
  const userAgent =
    typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const inAppBrowser = isInAppBrowser(userAgent);
  const appRelative = useMemo(
    () => appRelativeFromLocation(location.pathname, location.search),
    [location.pathname, location.search]
  );
  const openHref = openAppHref(appRelative, userAgent);
  const webFallbackPath = useMemo(
    () => mapAppPathToWeb(`/${appRelative}`),
    [appRelative]
  );
  useAutoOpenApp(openHref, userAgent);
  return { inAppBrowser, openHref, webFallbackPath };
}

function useAutoOpenApp(openHref: string, userAgent: string): void {
  useEffect(() => {
    if (!shouldAutoOpenApp(userAgent)) return;
    const timer = window.setTimeout(() => {
      window.location.href = openHref;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [openHref, userAgent]);
}
