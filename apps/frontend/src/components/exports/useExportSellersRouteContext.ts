import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMarket } from '../../hooks/useMarket';
import { normalizeCountryCode } from '../../utils/exportCountries';
import type { ExportSellersContext } from '../../utils/exportSellers';

/**
 * /exports/:countryCode/sellers[/...] is the public From context (origin from the URL);
 * /exports/sellers[/...] is the in-app Into context (viewer market).
 */
export function useExportSellersRouteContext(): {
  ctx: ExportSellersContext;
  isPublic: boolean;
  rawCode: string | undefined;
  invalidCode: boolean;
} {
  const { countryCode: rawCode } = useParams<{ countryCode?: string }>();
  const { selectedMarket } = useMarket();
  const marketCode = selectedMarket?.countryCode ?? null;
  const origin = normalizeCountryCode(rawCode);
  const isPublic = rawCode !== undefined;
  const ctx = useMemo<ExportSellersContext>(
    () =>
      isPublic
        ? { direction: 'from', marketCode: null, originCode: origin }
        : { direction: 'into', marketCode, originCode: null },
    [isPublic, origin, marketCode]
  );
  return { ctx, isPublic, rawCode, invalidCode: isPublic && !origin };
}
