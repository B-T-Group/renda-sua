import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  beginSend,
  endSend,
  recordFailure,
  clearFailure,
  canRetryAfterFailure,
  __testOnly_resetState,
} from './agentLocationLastSentStorage';

describe('agentLocationLastSentStorage - in-flight guard and failure backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __testOnly_resetState();
  });

  describe('in-flight guard', () => {
    it('should allow first send', () => {
      expect(beginSend()).toBe(true);
      endSend();
    });

    it('should block concurrent sends', () => {
      expect(beginSend()).toBe(true);
      expect(beginSend()).toBe(false);
      expect(beginSend()).toBe(false);
      endSend();
    });

    it('should allow send after endSend', () => {
      expect(beginSend()).toBe(true);
      endSend();
      expect(beginSend()).toBe(true);
      endSend();
    });

    it('should handle nested endSend gracefully', () => {
      expect(beginSend()).toBe(true);
      endSend();
      endSend();
      expect(beginSend()).toBe(true);
      endSend();
    });
  });

  describe('failure backoff', () => {
    it('should allow retry before any failure', () => {
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should block retry immediately after failure', () => {
      recordFailure();
      vi.advanceTimersByTime(100);
      expect(canRetryAfterFailure(60_000)).toBe(false);
    });

    it('should allow retry after backoff period', () => {
      recordFailure();
      vi.advanceTimersByTime(60_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should allow retry just at backoff threshold', () => {
      recordFailure();
      vi.advanceTimersByTime(59_999);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      vi.advanceTimersByTime(1);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should handle multiple failures', () => {
      recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should handle different backoff periods', () => {
      recordFailure();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(30_000)).toBe(true);
      expect(canRetryAfterFailure(60_000)).toBe(false);
    });

    it('should allow immediate retry after successful send (success does not block)', () => {
      expect(canRetryAfterFailure(60_000)).toBe(true);
      
      clearFailure();
      vi.advanceTimersByTime(2_000);
      
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should clear failure after success, allowing immediate next send', () => {
      recordFailure();
      vi.advanceTimersByTime(100);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      clearFailure();
      expect(canRetryAfterFailure(60_000)).toBe(true);
      
      vi.advanceTimersByTime(2_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });
  });
});
