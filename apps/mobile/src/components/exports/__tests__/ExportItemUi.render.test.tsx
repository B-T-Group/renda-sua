import React from 'react';
import { screen } from '@testing-library/react-native';
import i18n from '@/i18n';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { ExportOnlyBadge } from '../ExportOnlyBadge';
import { ExportedToBox } from '../ExportedToBox';
import { ExportDestinationsLine, ExportViewerNote } from '../ExportViewerNote';
import { ProductInterestSheet } from '../../product-interest/ProductInterestSheet';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const wrap = async (ui: React.ReactElement) => await renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);

describe('export item UI (EN)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('badge, destinations line and Exported to box', async () => {
    await wrap(
      <>
        <ExportOnlyBadge />
        <ExportDestinationsLine destinations={['CD', 'CG', 'CI', 'CM', 'GA']} />
        <ExportedToBox destinations={['CM', 'GA']} marketCode="CM" />
      </>
    );
    expect(screen.getByText('Export only')).toBeTruthy();
    expect(screen.getByText('CD · CG · CI +2')).toBeTruthy();
    expect(screen.getByText('Exported to')).toBeTruthy();
    expect(
      screen.getByText('This item is sold for export only. It can’t be bought in the app.')
    ).toBeTruthy();
    expect(screen.getByLabelText('Cameroon · Your market')).toBeTruthy();
  });

  it('origin and third-market notes', async () => {
    await wrap(
      <>
        <ExportViewerNote role="origin" marketCode="CA" />
        <ExportViewerNote role="third" marketCode="SN" />
        <ExportViewerNote role="destination" marketCode="CM" />
      </>
    );
    expect(
      screen.getByText('Exported from your market. It isn’t sold here. You can still like or share it.')
    ).toBeTruthy();
    expect(
      screen.getByText('Not exported to your market (SN). You can still like or share it.')
    ).toBeTruthy();
    expect(screen.queryByTestId('export-viewer-note-destination')).toBeNull();
  });

  it('interest sheet title uses the curly apostrophe', async () => {
    await wrap(
      <ProductInterestSheet visible itemName="Syrup" onDismiss={jest.fn()} onSubmit={jest.fn()} />
    );
    expect(screen.getByText('I’m interested')).toBeTruthy();
  });
});

describe('export item UI (FR)', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('French copy with vous and NBSP', async () => {
    await wrap(
      <>
        <ExportOnlyBadge />
        <ExportViewerNote role="third" marketCode="SN" />
        <ExportedToBox destinations={['CM']} marketCode="CM" />
      </>
    );
    expect(screen.getByText('Export uniquement')).toBeTruthy();
    expect(screen.getByText('Exporté vers')).toBeTruthy();
    expect(screen.getByText(/Vous pouvez l’aimer ou le partager/)).toBeTruthy();
    expect(screen.getByLabelText('Cameroun · Votre marché')).toBeTruthy();
  });
});
