import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  beginSend,
  endSend,
  recordAttempt,
  canRetryAfterFailure,
} from './agentLocationLastSentStorage';

describe('agentLocationLastSentStorage - in-flight guard and failure backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    it('should allow retry before any attempt', () => {
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should block retry immediately after attempt', () => {
      recordAttempt();
      vi.advanceTimersByTime(100);
      expect(canRetryAfterFailure(60_000)).toBe(false);
    });

    it('should allow retry after backoff period', () => {
      recordAttempt();
      vi.advanceTimersByTime(60_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should allow retry just at backoff threshold', () => {
      recordAttempt();
      vi.advanceTimersByTime(59_999);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      vi.advanceTimersByTime(1);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should handle multiple attempts', () => {
      recordAttempt();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      recordAttempt();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(false);
      
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(60_000)).toBe(true);
    });

    it('should handle different backoff periods', () => {
      recordAttempt();
      vi.advanceTimersByTime(30_000);
      expect(canRetryAfterFailure(30_000)).toBe(true);
      expect(canRetryAfterFailure(60_000)).toBe(false);
    });
  });
});
