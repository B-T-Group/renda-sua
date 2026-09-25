import {
  nationalDigitsForMobilePayment,
  resolveMobilePaymentPhoneFormAction,
} from './resolveMobilePaymentPhoneFormAction';

describe('resolveMobilePaymentPhoneFormAction', () => {
  it('creates when adding a new number after selecting an existing row', () => {
    const action = resolveMobilePaymentPhoneFormAction({
      mode: 'add',
      mustCreateNew: true,
      activePhoneId: 'existing-unverified',
    });
    expect(action).toEqual({ type: 'create' });
  });

  it('creates when the user chose Add new from the chooser', () => {
    const action = resolveMobilePaymentPhoneFormAction({
      mode: 'add',
      mustCreateNew: true,
      activePhoneId: null,
    });
    expect(action).toEqual({ type: 'create' });
  });

  it('updates a draft created earlier in the same add session', () => {
    const action = resolveMobilePaymentPhoneFormAction({
      mode: 'add',
      mustCreateNew: false,
      activePhoneId: 'draft-created-this-session',
    });
    expect(action).toEqual({
      type: 'update',
      phoneId: 'draft-created-this-session',
    });
  });

  it('updates the original row in edit mode', () => {
    const action = resolveMobilePaymentPhoneFormAction({
      mode: 'edit',
      mustCreateNew: false,
      initialPhoneId: 'edit-target',
      activePhoneId: 'stale-selection',
    });
    expect(action).toEqual({ type: 'update', phoneId: 'edit-target' });
  });

  it('reuses the existing row in verify mode', () => {
    const action = resolveMobilePaymentPhoneFormAction({
      mode: 'verify',
      mustCreateNew: false,
      initialPhoneId: 'verify-target',
    });
    expect(action).toEqual({ type: 'reuse' });
  });

  it('creates when add mode has no selected or draft phone', () => {
    const action = resolveMobilePaymentPhoneFormAction({
      mode: 'add',
      mustCreateNew: false,
    });
    expect(action).toEqual({ type: 'create' });
  });
});

describe('nationalDigitsForMobilePayment', () => {
  it('strips the selected country code from an E.164 value', () => {
    expect(nationalDigitsForMobilePayment('+237670000000', '237')).toBe(
      '670000000'
    );
  });
});
