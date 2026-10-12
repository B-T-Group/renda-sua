import { describe, expect, it, vi } from 'vitest';
import { signatureStatusKey, waitForAgentSignature } from './waitForAgentSignature';

function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

describe('waitForAgentSignature', () => {
  it('returns as soon as the contract is signed', async () => {
    const c = clock();
    const check = vi
      .fn()
      .mockResolvedValueOnce({ signed: false, status: 'viewed' })
      .mockResolvedValueOnce({ signed: true, status: 'signed' });
    const r = await waitForAgentSignature(check, { ...c, intervalMs: 3000, timeoutMs: 60000 });
    expect(r).toEqual({ signed: true, status: 'signed', timedOut: false });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('gives up after 60 s and reports the real status', async () => {
    const c = clock();
    const check = vi.fn().mockResolvedValue({ signed: false, status: 'sent' });
    const r = await waitForAgentSignature(check, { ...c, intervalMs: 3000, timeoutMs: 60000 });
    expect(r).toEqual({ signed: false, status: 'sent', timedOut: true });
    expect(c.now()).toBeLessThanOrEqual(60000);
    expect(check.mock.calls.length).toBeGreaterThanOrEqual(20);
  });

  it('stops early on a terminal status (declined)', async () => {
    const c = clock();
    const check = vi.fn().mockResolvedValue({ signed: false, status: 'declined' });
    const r = await waitForAgentSignature(check, c);
    expect(r).toEqual({ signed: false, status: 'declined', timedOut: false });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('keeps polling through transient errors', async () => {
    const c = clock();
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ signed: true, status: 'signed' });
    const r = await waitForAgentSignature(check, c);
    expect(r?.signed).toBe(true);
  });

  it('returns null when cancelled (screen left)', async () => {
    const c = clock();
    let cancelled = false;
    const check = vi.fn().mockImplementation(async () => {
      cancelled = true;
      return { signed: false, status: 'sent' };
    });
    expect(await waitForAgentSignature(check, { ...c, isCancelled: () => cancelled })).toBeNull();
  });

  it('maps statuses to copy keys', () => {
    expect(signatureStatusKey('expired')).toBe('expired');
    expect(signatureStatusKey(null)).toBe('unknown');
    expect(signatureStatusKey('weird')).toBe('unknown');
  });
});
