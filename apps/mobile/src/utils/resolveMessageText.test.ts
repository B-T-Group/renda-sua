import { describe, expect, it, vi } from 'vitest';
import { resolveMessageText } from './resolveMessageText';

describe('resolveMessageText', () => {
  it('returns plain text unchanged', () => {
    const t = vi.fn();
    expect(resolveMessageText('Hello world', t)).toBe('Hello world');
    expect(t).not.toHaveBeenCalled();
  });

  it('resolves mapped plain keys', () => {
    const t = vi.fn((_key, fallback, params) =>
      fallback.replace('{{agentName}}', String(params?.agentName ?? ''))
    );
    const raw = JSON.stringify({
      i18nKey: 'orders.messaging.deliveryPin.shared',
      params: { agentName: 'Alice' },
    });
    expect(resolveMessageText(raw, t)).toBe('Delivery PIN sent to Alice');
    expect(t).toHaveBeenCalledWith(
      'orders.messaging.deliveryPin.sharedPlain',
      'Delivery PIN sent to {{agentName}}',
      { agentName: 'Alice' }
    );
  });

  it('resolves unmapped i18n keys via the key itself', () => {
    const t = vi.fn((_key, fallback, params) =>
      fallback.replace('{{itemName}}', String(params?.itemName ?? ''))
    );
    const raw = JSON.stringify({
      i18nKey: 'items.availability.requestMessage',
      params: { itemName: 'Fanta' },
    });
    expect(resolveMessageText(raw, t)).toBe('Availability check for Fanta');
    expect(t).toHaveBeenCalledWith(
      'items.availability.requestMessage',
      'Availability check for {{itemName}}',
      { itemName: 'Fanta' }
    );
  });

  it('returns raw JSON when parsed object has no i18nKey', () => {
    const t = vi.fn();
    const raw = JSON.stringify({ foo: 'bar' });
    expect(resolveMessageText(raw, t)).toBe(raw);
    expect(t).not.toHaveBeenCalled();
  });
});
