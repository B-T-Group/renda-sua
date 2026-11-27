import { describe, expect, it } from 'vitest';
import {
  exportDestinationCodes,
  exportViewerRole,
  formatExportDestinations,
  isExportOnlyItem,
} from './exportItemRules';
import { exportCountryName, exportCountryOfPlace, exportCountryPlace } from './exportCountries';
import { resolveExportViewer } from './exportViewer';

const maple = {
  item: { export_available: true, export_markets: [{ country_code: 'ga' }, { country_code: 'CM' }] },
  business_location: { address: { country: 'CA' } },
};

describe('export item rules', () => {
  it('roles: destination, origin, third', () => {
    expect(isExportOnlyItem(maple)).toBe(true);
    expect(exportDestinationCodes(maple)).toEqual(['CM', 'GA']);
    expect(exportViewerRole(maple, 'CM')).toBe('destination');
    expect(exportViewerRole(maple, 'ca')).toBe('origin');
    expect(exportViewerRole(maple, 'SN')).toBe('third');
  });

  it('only destination viewers can send interest', () => {
    expect(resolveExportViewer(maple, 'CM').canSendInterest).toBe(true);
    expect(resolveExportViewer(maple, 'CA').canSendInterest).toBe(false);
    expect(resolveExportViewer(maple, 'SN').canSendInterest).toBe(false);
    expect(resolveExportViewer(maple, null).canSendInterest).toBe(false);
    expect(resolveExportViewer({ item: { export_available: false } }, 'CM').canSendInterest).toBe(false);
  });

  it('formats destinations and French places', () => {
    expect(formatExportDestinations(['CD', 'CG', 'CI', 'CM'])).toBe('CD · CG · CI +1');
    expect(exportCountryName('CI', 'fr')).toBe('Côte d’Ivoire');
    expect(exportCountryPlace('CA', 'fr')).toBe('le Canada');
    expect(exportCountryOfPlace('CA', 'fr')).toBe('du Canada');
  });
});
