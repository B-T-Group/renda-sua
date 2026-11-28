import { fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '../../../public/locales/en.json';
import fr from '../../../public/locales/fr.json';
import type { Market } from '../../types/market';
import type { BrowseLaneId } from '../../utils/browseMarketLanes';
import { MarketPickerDialog } from './MarketPickerDialog';

type Hook = {
  counts: { rentals: number; exports: number; shop: number } | null;
  totals: { rentals: number; shop: number } | null;
  states: Array<{ state: string; itemCount: number; inventoryCount: number; rentalCount: number }>;
  loading: boolean;
  statesFailed: boolean;
};
let mockHook: Hook;
jest.mock('../../hooks/useMarketPickerCounts', () => ({
  useMarketPickerCounts: () => mockHook,
}));

const markets: Market[] = [
  {
    id: 'CM',
    code: 'CM',
    countryCode: 'CM',
    stateCode: null,
    stateName: null,
    name: 'Cameroon',
    currency: 'XAF',
    flag: '🇨🇲',
    isEnabled: true,
  },
];

const ready: Hook = {
  counts: { rentals: 32, exports: 86, shop: 1240 },
  totals: { rentals: 32, shop: 1240 },
  states: [
    { state: 'Littoral', itemCount: 640, inventoryCount: 640, rentalCount: 18 },
    { state: 'Centre', itemCount: 402, inventoryCount: 402, rentalCount: 11 },
  ],
  loading: false,
  statesFailed: false,
};

const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
});

beforeEach(async () => {
  mockHook = ready;
  await i18n.changeLanguage('en');
});

function open(lane: BrowseLaneId | null | undefined, onSelect = jest.fn()) {
  render(
    <I18nextProvider i18n={i18n}>
      <MarketPickerDialog
        open
        markets={markets}
        selectedCode="CM"
        selectedStateCode={null}
        lane={lane}
        onSelect={onSelect}
        onClose={jest.fn()}
      />
    </I18nextProvider>
  );
  return onSelect;
}

const active = (lane: string) =>
  screen.getByTestId(`market-count-${lane}`).getAttribute('data-active');

describe('MarketPickerDialog counts strip (Option C)', () => {
  it('shows Rentals, Exports and Shop with plural-aware labels', () => {
    open('rentals');
    expect(screen.getByLabelText('32 rentals')).toBeTruthy();
    expect(screen.getByLabelText('86 exports')).toBeTruthy();
    expect(screen.getByLabelText('1,240 items')).toBeTruthy();
  });

  it('highlights only the lane the user is in, and nothing for Food', () => {
    open('exports');
    expect([active('rentals'), active('exports'), active('shop')]).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('highlights nothing in the Food lane', () => {
    open('food');
    expect([active('rentals'), active('exports'), active('shop')]).toEqual([
      'false',
      'false',
      'false',
    ]);
  });

  it('keeps a zero cell visible and compacts from 10,000', () => {
    mockHook = { ...ready, counts: { rentals: 58, exports: 0, shop: 12400 }, totals: { rentals: 58, shop: 12400 } };
    open('shop');
    expect(screen.getByLabelText('0 exports')).toBeTruthy();
    expect(screen.getAllByText('12.4k')).toHaveLength(2); // strip cell + "All of" row
  });

  it('uses FR labels, narrow no-break space and "Tout le pays"', async () => {
    await i18n.changeLanguage('fr');
    open('shop');
    // Keep the exact narrow no-break space (the default normalizer would collapse it).
    expect(screen.getAllByText('1\u202f240', { normalizer: (t) => t })).toHaveLength(2);
    expect(screen.getByText('Locations')).toBeTruthy();
    expect(screen.getByText('Boutique')).toBeTruthy();
    expect(screen.getByText('Tout le pays')).toBeTruthy();
  });

  it('shows the lane count on state rows and never an exports count there', () => {
    open('rentals');
    expect(screen.getByText('18')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.queryByText('640')).toBeNull();
  });

  it('never blocks selection while counts load', () => {
    mockHook = { counts: null, totals: null, states: [], loading: true, statesFailed: false };
    const onSelect = open('shop');
    expect(screen.getByTestId('market-counts-strip')).toBeTruthy();
    fireEvent.click(screen.getByText('All of Cameroon'));
    expect(onSelect).toHaveBeenCalledWith('CM', null);
  });

  it('hides the strip when a count call failed and keeps rows usable', () => {
    mockHook = { counts: null, totals: { rentals: 32, shop: 1240 }, states: ready.states, loading: false, statesFailed: false };
    const onSelect = open('shop');
    expect(screen.queryByTestId('market-counts-strip')).toBeNull();
    // The states call worked, so the "All of" row still shows its count.
    expect(screen.getByText('1,240')).toBeTruthy();
    fireEvent.click(screen.getByText('Littoral'));
    expect(onSelect).toHaveBeenCalledWith('CM', 'Littoral');
  });
});
