import { resolveInitialDepositSave } from './initial-deposit.util';

const disabled = {
  initial_deposit_enabled: false,
  initial_deposit_percent: null,
};

describe('resolveInitialDepositSave', () => {
  it('rejects an initial deposit on cooked food and clears a disabled one', () => {
    expect(
      resolveInitialDepositSave({
        isCookedFood: true,
        enabled: true,
        percent: 10,
        touchDeposit: true,
      })
    ).toEqual({
      fields: null,
      error: 'Cooked food items cannot require an initial deposit',
    });
    expect(
      resolveInitialDepositSave({
        isCookedFood: true,
        enabled: false,
        percent: 10,
        touchDeposit: false,
      }).fields
    ).toEqual(disabled);
  });

  it('leaves the columns untouched when the save does not mention a deposit', () => {
    expect(
      resolveInitialDepositSave({
        isCookedFood: false,
        enabled: undefined,
        percent: undefined,
        touchDeposit: false,
      })
    ).toEqual({ fields: null });
  });

  it('accepts whole percents from 1 to 25, including numeric strings', () => {
    expect(
      resolveInitialDepositSave({
        isCookedFood: false,
        enabled: true,
        percent: '15',
        touchDeposit: true,
      }).fields
    ).toEqual({
      initial_deposit_enabled: true,
      initial_deposit_percent: 15,
    });
    expect(
      resolveInitialDepositSave({
        isCookedFood: false,
        enabled: undefined,
        percent: 1,
        touchDeposit: true,
      }).fields?.initial_deposit_percent
    ).toBe(1);
    expect(
      resolveInitialDepositSave({
        isCookedFood: false,
        enabled: true,
        percent: 25,
        touchDeposit: true,
      }).fields?.initial_deposit_percent
    ).toBe(25);
  });

  it('rejects blank, fractional, and out-of-range percents', () => {
    for (const percent of [0, 26, 10.5, '10.5', '', null]) {
      const result = resolveInitialDepositSave({
        isCookedFood: false,
        enabled: true,
        percent,
        touchDeposit: true,
      });
      expect(result.fields).toBeNull();
      expect(result.error).toMatch(/1 to 25/);
    }
  });

  it('clears the deposit when the merchant turns it off', () => {
    expect(
      resolveInitialDepositSave({
        isCookedFood: false,
        enabled: false,
        percent: 10,
        touchDeposit: true,
      }).fields
    ).toEqual(disabled);
  });
});
