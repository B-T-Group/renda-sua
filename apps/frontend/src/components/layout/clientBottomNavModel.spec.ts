import { clientBottomNavModel } from './clientBottomNavModel';

const keys = (tabs: { key: string }[]) => tabs.map((tab) => tab.key);
const active = (tabs: { key: string; active: boolean }[]) => tabs.find((tab) => tab.active)?.key;

describe('clientBottomNavModel', () => {
  it('keeps the four-tab bar and marks /rentals as Home when the flag is off', () => {
    const off = clientBottomNavModel({
      rentalsTabEnabled: false,
      pathname: '/rentals/requests',
      search: '',
    });
    expect(keys(off)).toEqual(['home', 'search', 'orders', 'account']);
    expect(active(off)).toBe('home');
    expect(off.find((tab) => tab.key === 'search')?.path).toBe('/items?focus=search');
  });

  it('adds Rentals on /rentals/requests and leaves browse on Home when the flag is on', () => {
    const requests = clientBottomNavModel({
      rentalsTabEnabled: true,
      pathname: '/rentals/requests',
      search: '',
    });
    expect(keys(requests)).toEqual(['home', 'search', 'rentals', 'orders', 'account']);
    expect(active(requests)).toBe('rentals');
    expect(requests.find((tab) => tab.key === 'rentals')?.path).toBe('/rentals/requests');

    const browse = clientBottomNavModel({
      rentalsTabEnabled: true,
      pathname: '/rentals',
      search: '',
    });
    expect(active(browse)).toBe('home');
  });

  it('keeps Search active from the focus query', () => {
    const tabs = clientBottomNavModel({
      rentalsTabEnabled: true,
      pathname: '/items',
      search: '?focus=search',
    });
    expect(tabs.find((tab) => tab.key === 'search')?.active).toBe(true);
  });
});
