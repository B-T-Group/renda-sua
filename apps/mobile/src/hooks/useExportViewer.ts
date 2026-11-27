import { useMemo } from 'react';
import { useStore } from '../stores/RootStore';
import type { ExportItemLike } from '../utils/exportItemRules';
import { resolveExportViewer, type ExportViewer } from '../utils/exportViewer';

export { resolveExportViewer, type ExportViewer };

export function useExportViewer(row: ExportItemLike | null | undefined): ExportViewer {
  // Read the market store directly (cheap in list rows; same code as useMarket().selectedMarket).
  const { market: marketStore } = useStore();
  const market = marketStore.hydrated ? marketStore.selectedCountryCode ?? null : null;
  return useMemo(() => resolveExportViewer(row, market), [row, market]);
}
