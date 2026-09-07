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
});
