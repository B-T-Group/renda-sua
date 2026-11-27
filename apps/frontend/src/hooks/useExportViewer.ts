import { useMemo } from 'react';
import { useMarket } from './useMarket';
import {
  exportDestinationCodes,
  exportOriginCode,
  exportViewerRole,
  isExportOnlyItem,
  type ExportItemLike,
  type ExportViewerRole,
} from '../utils/exportItemRules';

export interface ExportViewerState {
  isExport: boolean;
  /** Browsing market (ISO-2), the same value sent as countryCode on interest. */
  marketCode: string | null;
  role: ExportViewerRole;
  destinations: string[];
  originCode: string | null;
  /** In-app rule: only a viewer in a destination market may send interest. */
  canSendInterest: boolean;
}

export function useExportViewer(row: ExportItemLike | null | undefined): ExportViewerState {
  const { selectedMarket } = useMarket();
  const marketCode = selectedMarket?.countryCode?.toUpperCase() ?? null;
  return useMemo(() => {
    const isExport = isExportOnlyItem(row);
    const role = exportViewerRole(row, marketCode);
    return {
      isExport,
      marketCode,
      role,
      destinations: exportDestinationCodes(row),
      originCode: exportOriginCode(row),
      canSendInterest: isExport && role === 'destination',
    };
  }, [row, marketCode]);
}
