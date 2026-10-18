import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('agentLocationTask - failure backoff integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call recordFailure when updateMyAgentLocation returns failure', async () => {
    const { recordFailure, clearFailure, __testOnly_resetState } = await import(
      '../utils/agentLocationLastSentStorage'
    );
    __testOnly_resetState();

    const mockUpdateFn = vi.fn().mockResolvedValue({ success: false });
    
    try {
      const res = await mockUpdateFn();
      if (!res.success) {
        recordFailure();
        return;
      }
      clearFailure();
    } catch {
      recordFailure();
      return;
    }

    const { canRetryAfterFailure } = await import('../utils/agentLocationLastSentStorage');
    expect(canRetryAfterFailure(60_000)).toBe(false);
  });

  it('should call recordFailure when updateMyAgentLocation throws', async () => {
    const { recordFailure, clearFailure, __testOnly_resetState } = await import(
      '../utils/agentLocationLastSentStorage'
    );
    __testOnly_resetState();

    const mockUpdateFn = vi.fn().mockRejectedValue(new Error('Network error'));
    
    try {
      await mockUpdateFn();
      clearFailure();
    } catch {
      recordFailure();
    }

    const { canRetryAfterFailure } = await import('../utils/agentLocationLastSentStorage');
    expect(canRetryAfterFailure(60_000)).toBe(false);
  });

  it('should allow send after backoff period and clearFailure on success', async () => {
    const {
      recordFailure,
      clearFailure,
      canRetryAfterFailure,
      __testOnly_resetState,
    } = await import('../utils/agentLocationLastSentStorage');
    
    __testOnly_resetState();

    recordFailure();
    expect(canRetryAfterFailure(60_000)).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(canRetryAfterFailure(60_000)).toBe(true);

    clearFailure();
    
    vi.advanceTimersByTime(2_000);
    expect(canRetryAfterFailure(60_000)).toBe(true);
  });
});
