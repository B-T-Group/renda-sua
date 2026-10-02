import { describe, expect, it } from 'vitest';
import {
  extractAppPath,
  resolveDeepLinkTarget,
  targetPersonaForDeepLinkPath,
} from './appDeepLink';

describe('extractAppPath', () => {
  it('parses universal order links', () => {
    expect(
      extractAppPath(
        'https://rendasua.com/app/orders/11111111-2222-4333-8555-666666666666'
      )
    ).toBe('orders/11111111-2222-4333-8555-666666666666');
  });

  it('parses custom-scheme order links', () => {
    expect(extractAppPath('rendasua://orders/abc-123')).toBe('orders/abc-123');
  });

  it('parses admin order links', () => {
    expect(extractAppPath('https://rendasua.com/app/admin/orders/abc')).toBe(
      'admin/orders/abc'
    );
  });

  it('parses public store share links', () => {
    expect(
      extractAppPath(
        'https://rendasua.com/store/00cdc50b-2b46-4a27-9401-0ce3a9d3c5fd'
      )
    ).toBe('store/00cdc50b-2b46-4a27-9401-0ce3a9d3c5fd');
    expect(extractAppPath('https://www.rendasua.com/store/abc/?x=1')).toBe(
      'store/abc'
    );
  });

  it('ignores store paths without a single id segment', () => {
    expect(extractAppPath('https://rendasua.com/store/')).toBeNull();
    expect(extractAppPath('https://rendasua.com/stores')).toBeNull();
    expect(extractAppPath('https://rendasua.com/store/abc/items')).toBeNull();
  });
});

describe('targetPersonaForDeepLinkPath', () => {
  it('routes implied personas', () => {
    expect(targetPersonaForDeepLinkPath('admin/orders/abc')).toBe('business');
    expect(targetPersonaForDeepLinkPath('items/abc')).toBe('business');
    expect(targetPersonaForDeepLinkPath('rentals/requests/abc')).toBe(
      'business'
    );
    expect(targetPersonaForDeepLinkPath('deliveries/abc')).toBe('agent');
    expect(targetPersonaForDeepLinkPath('orders/abc')).toBeNull();
  });
});

describe('resolveDeepLinkTarget', () => {
  it('opens orders, admin orders, and item proposals', () => {
    expect(resolveDeepLinkTarget('orders/abc')).toEqual({
      type: 'order',
      id: 'abc',
      openMessages: false,
    });
    expect(resolveDeepLinkTarget('admin/orders/abc')).toEqual({
      type: 'adminOrder',
      id: 'abc',
    });
    expect(resolveDeepLinkTarget('admin/whatsapp/conv-1')).toEqual({
      type: 'whatsappInbox',
      id: 'conv-1',
    });
    expect(resolveDeepLinkTarget('items/abc')).toEqual({
      type: 'itemProposal',
      id: 'abc',
    });
  });

  it('opens a store and keeps the active persona', () => {
    expect(resolveDeepLinkTarget('store/abc')).toEqual({
      type: 'store',
      id: 'abc',
    });
    expect(targetPersonaForDeepLinkPath('store/abc')).toBeNull();
  });
});
