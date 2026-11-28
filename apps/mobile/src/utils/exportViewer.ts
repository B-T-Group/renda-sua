import {
  exportDestinationCodes,
  exportOriginCode,
  exportViewerRole,
  isExportOnlyItem,
  type ExportItemLike,
  type ExportViewerRole,
} from './exportItemRules';

export interface ExportViewer {
  isExport: boolean;
  /** Browsing market (ISO-2, upper case) or null while unknown. */
  marketCode: string | null;
  role: ExportViewerRole;
  destinations: string[];
  originCode: string | null;
  /** I’m interested only for viewers in a destination market. */
  canSendInterest: boolean;
}

export function resolveExportViewer(
  row: ExportItemLike | null | undefined,
  marketCode: string | null | undefined
): ExportViewer {
  const market = marketCode?.trim().toUpperCase() || null;
  const isExport = isExportOnlyItem(row);
  const role = exportViewerRole(row, market);
  return {
    isExport,
    marketCode: market,
    role,
    destinations: exportDestinationCodes(row),
    originCode: exportOriginCode(row),
    canSendInterest: isExport && role === 'destination',
  };
}
