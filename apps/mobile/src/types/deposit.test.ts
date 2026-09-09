import { describe, it, expect } from 'vitest';
import { calculateDepositFallback, resolveDepositAmount } from './deposit';

describe('calculateDepositFallback', () => {
  it('returns floor 151 XAF for very small orders', () => {
    expect(calculateDepositFallback(100)).toBe(151);
    expect(calculateDepositFallback(500)).toBe(151);
    expect(calculateDepositFallback(1000)).toBe(151);
  });

  it('returns 10% for orders < 5000 XAF when above floor', () => {
    // 10% of 3000 = 300
    expect(calculateDepositFallback(3000)).toBe(300);
    // 10% of 4500 = 450
    expect(calculateDepositFallback(4500)).toBe(450);
  });

  it('returns 5% for orders >= 5000 XAF', () => {
    // 5% of 5000 = 250
    expect(calculateDepositFallback(5000)).toBe(250);
    // 5% of 10000 = 500
    expect(calculateDepositFallback(10000)).toBe(500);
    // 5% of 20000 = 1000
    expect(calculateDepositFallback(20000)).toBe(1000);
  });

  it('rounds to nearest integer', () => {
    // 10% of 2555 = 255.5 -> 256
    expect(calculateDepositFallback(2555)).toBe(256);
    // 5% of 7777 = 388.85 -> 389
    expect(calculateDepositFallback(7777)).toBe(389);
  });

  it('handles edge case at 5000 threshold', () => {
    // 10% of 4999 = 499.9 -> 500
    expect(calculateDepositFallback(4999)).toBe(500);
    // 5% of 5000 = 250
    expect(calculateDepositFallback(5000)).toBe(250);
    // 5% of 5001 = 250.05 -> 250
    expect(calculateDepositFallback(5001)).toBe(250);
  });
});

describe('resolveDepositAmount', () => {
  it('prefers server deposit_amount when provided', () => {
    expect(resolveDepositAmount(3000, 200)).toBe(200);
    expect(resolveDepositAmount(10000, 500)).toBe(500);
  });

  it('falls back to calculation when server amount is null', () => {
    expect(resolveDepositAmount(3000, null)).toBe(300);
    expect(resolveDepositAmount(10000, null)).toBe(500);
  });

  it('falls back to calculation when server amount is undefined', () => {
    expect(resolveDepositAmount(3000, undefined)).toBe(300);
    expect(resolveDepositAmount(10000, undefined)).toBe(500);
  });

  it('falls back to calculation when server amount is zero or negative', () => {
    expect(resolveDepositAmount(3000, 0)).toBe(300);
    expect(resolveDepositAmount(3000, -50)).toBe(300);
  });
});
