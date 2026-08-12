import {
  normalizeAgentFocus,
  showsCommercialChrome,
  showsDeliveryChrome,
} from './agent-focus.util';

describe('normalizeAgentFocus', () => {
  it('accepts known focus values', () => {
    expect(normalizeAgentFocus('delivery')).toBe('delivery');
    expect(normalizeAgentFocus('commercial')).toBe('commercial');
    expect(normalizeAgentFocus('both')).toBe('both');
  });

  it('normalizes trimmed and cased GraphQL / transport strings', () => {
    expect(normalizeAgentFocus(' Delivery ')).toBe('delivery');
    expect(normalizeAgentFocus('COMMERCIAL')).toBe('commercial');
    expect(normalizeAgentFocus('Both')).toBe('both');
  });

  it('defaults unknown, nullish, and non-string values to both', () => {
    expect(normalizeAgentFocus(undefined)).toBe('both');
    expect(normalizeAgentFocus(null)).toBe('both');
    expect(normalizeAgentFocus('')).toBe('both');
    expect(normalizeAgentFocus('recruiting')).toBe('both');
    expect(normalizeAgentFocus(0)).toBe('both');
  });
});

describe('showsDeliveryChrome / showsCommercialChrome', () => {
  it('includes delivery and both for delivery chrome', () => {
    expect(showsDeliveryChrome('delivery')).toBe(true);
    expect(showsDeliveryChrome('both')).toBe(true);
    expect(showsDeliveryChrome('commercial')).toBe(false);
  });

  it('includes commercial and both for commercial chrome', () => {
    expect(showsCommercialChrome('commercial')).toBe(true);
    expect(showsCommercialChrome('both')).toBe(true);
    expect(showsCommercialChrome('delivery')).toBe(false);
  });

  it('treats cased raw focus strings like typed enums', () => {
    expect(showsDeliveryChrome(' Delivery ')).toBe(true);
    expect(showsDeliveryChrome('COMMERCIAL')).toBe(false);
    expect(showsCommercialChrome('Commercial')).toBe(true);
  });
});
