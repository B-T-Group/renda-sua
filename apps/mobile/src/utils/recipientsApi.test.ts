import { describe, expect, it } from 'vitest';
import {
  isRecipientCountryCode,
  normalizeRecipientResponse,
  normalizeRecipientsList,
} from './recipientsApi';
import type { SavedRecipient } from '../types/recipient';

const recipient: SavedRecipient = {
  id: 'r-1',
  name: 'Amina',
  phone: '+241077123456',
  country: 'GA',
  notify_whatsapp: true,
};

describe('normalizeRecipientsList', () => {
  it('treats a raw empty array as success with no recipients', () => {
    expect(normalizeRecipientsList([])).toEqual({
      success: true,
      recipients: [],
    });
  });

  it('accepts a raw array of recipients', () => {
    expect(normalizeRecipientsList([recipient])).toEqual({
      success: true,
      recipients: [recipient],
    });
  });

  it('accepts the wrapped envelope including an empty list', () => {
    expect(normalizeRecipientsList({ success: true, recipients: [] })).toEqual({
      success: true,
      recipients: [],
    });
  });

  it('preserves a wrapped error', () => {
    expect(
      normalizeRecipientsList({ success: false, error: 'UNAUTHORIZED' })
    ).toEqual({
      success: false,
      recipients: [],
      error: 'UNAUTHORIZED',
    });
  });

  it('fails closed on an unexpected payload', () => {
    expect(normalizeRecipientsList({ ok: true })).toEqual({
      success: false,
      recipients: [],
      error: 'Failed to fetch recipients',
    });
  });
});

describe('normalizeRecipientResponse', () => {
  it('accepts a raw recipient object as success', () => {
    expect(normalizeRecipientResponse(recipient)).toEqual({
      success: true,
      recipient,
    });
  });

  it('accepts a wrapped recipient', () => {
    expect(
      normalizeRecipientResponse({ success: true, recipient })
    ).toEqual({
      success: true,
      recipient,
    });
  });

  it('does not treat an empty list as a saved recipient', () => {
    expect(normalizeRecipientResponse([])).toEqual({
      success: false,
      error: 'Failed to save recipient',
    });
  });
});

describe('isRecipientCountryCode', () => {
  it('accepts GA and CM', () => {
    expect(isRecipientCountryCode('GA')).toBe(true);
    expect(isRecipientCountryCode('CM')).toBe(true);
    expect(isRecipientCountryCode('CA')).toBe(false);
    expect(isRecipientCountryCode(undefined)).toBe(false);
  });
});
