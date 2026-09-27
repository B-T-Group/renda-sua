export type MobilePaymentPhoneModalMode = 'add' | 'edit' | 'verify';

export type MobilePaymentPhoneFormAction =
  | { type: 'update'; phoneId: string }
  | { type: 'create' }
  | { type: 'reuse' };

/**
 * Decide whether the MoMo phone form should create, update, or reuse a row.
 * "Add new" after picking an existing number must create — never overwrite.
 */
export function resolveMobilePaymentPhoneFormAction(input: {
  mode: MobilePaymentPhoneModalMode;
  mustCreateNew: boolean;
  activePhoneId?: string | null;
  initialPhoneId?: string | null;
}): MobilePaymentPhoneFormAction {
  if (input.mode === 'edit' && input.initialPhoneId) {
    return { type: 'update', phoneId: input.initialPhoneId };
  }
  if (input.mode === 'verify') {
    return { type: 'reuse' };
  }
  if (input.mode === 'add' && input.mustCreateNew) {
    return { type: 'create' };
  }
  if (input.mode === 'add' && input.activePhoneId) {
    return { type: 'update', phoneId: input.activePhoneId };
  }
  return { type: 'create' };
}

export function nationalDigitsForMobilePayment(
  phoneValue: string,
  countryCode: string
): string {
  const digits = phoneValue.replace(/\D/g, '');
  if (digits.startsWith(countryCode)) {
    return digits.slice(countryCode.length);
  }
  return digits.replace(/^237|^241/, '');
}
