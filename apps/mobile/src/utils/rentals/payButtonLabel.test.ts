import { describe, expect, it } from 'vitest';
import { payLabelStyle } from './payButtonLabel';

describe('pay button label', () => {
  it('shrinks long labels instead of letting them ellipsize', () => {
    expect(payLabelStyle('Pay 11 850 FCFA & start').fontSize).toBeUndefined();
    expect(payLabelStyle('Payer 11 850 FCFA et démarrer').fontSize).toBe(14);
    expect(payLabelStyle('Payer 11 850 FCFA · démarrer la location').fontSize).toBe(13);
  });
});
