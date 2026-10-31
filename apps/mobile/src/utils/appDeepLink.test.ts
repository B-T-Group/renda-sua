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

describe('extractAppPath public item links', () => {
  const id = '333d0d21-440a-4fe6-8449-00f5120aaca5';

  it.each([
    `https://rendasua.com/items/${id}`,
    `https://rendasua.com/items/${id}/`,
    `https://rendasua.com/items/${id}/seo`,
    `https://rendasua.com/items/${id}/seo/`,
    `https://www.rendasua.com/items/${id}/seo`,
    `https://dev.rendasua.com/items/${id}/seo`,
    `https://rendasua.com/items/${id}?utm_source=share`,
    `https://rendasua.com/items/${id}/seo?utm_source=share&x=1`,
    `https://rendasua.com/items/${id}/seo/?x=1#frag`,
  ])('maps %s to the catalog item path', (url) => {
    expect(extractAppPath(url)).toBe(`item/${id}`);
  });

  it('ignores non-shareable or malformed item paths', () => {
    expect(extractAppPath('https://rendasua.com/items')).toBeNull();
    expect(extractAppPath('https://rendasua.com/items/')).toBeNull();
    expect(extractAppPath(`https://rendasua.com/items/${id}/place_order`)).toBeNull();
    expect(
      extractAppPath(`https://rendasua.com/items/${id}/place_order/anon-address`)
    ).toBeNull();
    expect(extractAppPath(`https://rendasua.com/items/${id}/seo/extra`)).toBeNull();
    expect(extractAppPath(`https://rendasua.com/item/${id}`)).toBeNull();
  });

  it('keeps business /app/items links on the AI proposal path', () => {
    expect(extractAppPath(`https://rendasua.com/app/items/${id}`)).toBe(`items/${id}`);
    expect(extractAppPath(`https://rendasua.com/app/items/${id}/`)).toBe(`items/${id}`);
    expect(extractAppPath(`rendasua://items/${id}`)).toBe(`items/${id}`);
  });

  it('keeps store links working with trailing slashes and query strings', () => {
    expect(extractAppPath('https://rendasua.com/store/abc/')).toBe('store/abc');
    expect(extractAppPath('https://rendasua.com/store/abc?ref=wa')).toBe('store/abc');
    expect(extractAppPath('https://dev.rendasua.com/store/abc/?ref=wa')).toBe('store/abc');
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

  it('does not switch persona for public item links', () => {
    expect(targetPersonaForDeepLinkPath('item/abc')).toBeNull();
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

  it('opens public item links on the catalog item detail, not the business proposal', () => {
    expect(resolveDeepLinkTarget('item/abc')).toEqual({ type: 'inventoryItem', id: 'abc' });
    expect(resolveDeepLinkTarget('items/abc')).toEqual({ type: 'itemProposal', id: 'abc' });
    expect(resolveDeepLinkTarget('item')).toEqual({ type: 'dashboard' });
  });

  it('opens a store and keeps the active persona', () => {
    expect(resolveDeepLinkTarget('store/abc')).toEqual({
      type: 'store',
      id: 'abc',
    });
    expect(targetPersonaForDeepLinkPath('store/abc')).toBeNull();
  });
});
