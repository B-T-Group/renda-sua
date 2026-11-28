import { render, screen } from '@testing-library/react';
import React from 'react';
import ExportViewerNote from './ExportViewerNote';
import ExportedToBox from './ExportedToBox';
import ExportOnlyBadge from './ExportOnlyBadge';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, defaultValue?: string, options?: Record<string, string>) =>
      typeof defaultValue === 'string'
        ? defaultValue.replace(/\{\{(\w+)\}\}/g, (_m, k) => options?.[k] ?? '')
        : _key,
  }),
}));

describe('export item UI', () => {
  it('badge reads Export only', () => {
    render(<ExportOnlyBadge variant="overlay" />);
    expect(screen.getByTestId('export-only-badge').textContent).toContain('Export only');
  });

  it('origin viewers get the origin line', () => {
    render(<ExportViewerNote variant="pdp" role="origin" marketCode="CA" destinations={['CM']} />);
    expect(
      screen.getByText('Exported from your market. It isn’t sold here. You can still like or share it.')
    ).toBeTruthy();
  });

  it('third-market viewers get their market code', () => {
    render(<ExportViewerNote variant="pdp" role="third" marketCode="sn" destinations={['CM']} />);
    expect(
      screen.getByText('Not exported to your market (SN). You can still like or share it.')
    ).toBeTruthy();
  });

  it('card line lists destinations', () => {
    render(
      <ExportViewerNote variant="card" role="third" destinations={['CD', 'CG', 'CI', 'CM', 'GA']} />
    );
    expect(screen.getByText('Exported to: CD, CG, CI +2')).toBeTruthy();
  });

  it('Exported to box highlights the viewer market chip', () => {
    render(<ExportedToBox destinations={['CM', 'GA']} marketCode="cm" />);
    expect(screen.getByLabelText('Cameroon · Your market')).toBeTruthy();
    expect(screen.getByLabelText('Gabon')).toBeTruthy();
  });
});
