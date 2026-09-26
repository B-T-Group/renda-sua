export const INITIAL_DEPOSIT_PERCENT_MIN = 1;
export const INITIAL_DEPOSIT_PERCENT_MAX = 25;

export type InitialDepositFields = {
  initial_deposit_enabled: boolean;
  initial_deposit_percent: number | null;
};

const COOKED_FOOD_DEPOSIT_ERROR =
  'Cooked food items cannot require an initial deposit';

const PERCENT_ERROR =
  'Initial deposit percent must be a whole number from 1 to 25';

export function resolveInitialDepositSave(input: {
  isCookedFood: boolean;
  enabled: unknown;
  percent: unknown;
  touchDeposit: boolean;
}): { fields: InitialDepositFields | null; error?: string } {
  if (input.isCookedFood) return cookedFoodDeposit(input.enabled);
  if (!input.touchDeposit) return { fields: null };
  if (input.enabled === false) return disabledDeposit();
  if (input.enabled === true || hasDepositPercent(input.percent)) {
    return enabledDeposit(input.percent);
  }
  return disabledDeposit();
}

function cookedFoodDeposit(enabled: unknown): {
  fields: InitialDepositFields | null;
  error?: string;
} {
  if (enabled === true) {
    return { fields: null, error: COOKED_FOOD_DEPOSIT_ERROR };
  }
  return disabledDeposit();
}

function hasDepositPercent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function enabledDeposit(percent: unknown): {
  fields: InitialDepositFields | null;
  error?: string;
} {
  const parsed = parseDepositPercent(percent);
  if (parsed == null) return { fields: null, error: PERCENT_ERROR };
  return {
    fields: {
      initial_deposit_enabled: true,
      initial_deposit_percent: parsed,
    },
  };
}

function disabledDeposit(): { fields: InitialDepositFields } {
  return {
    fields: {
      initial_deposit_enabled: false,
      initial_deposit_percent: null,
    },
  };
}

function parseDepositPercent(value: unknown): number | null {
  const percent = typeof value === 'string' ? Number(value) : value;
  if (typeof percent !== 'number' || !Number.isInteger(percent)) return null;
  if (percent < INITIAL_DEPOSIT_PERCENT_MIN) return null;
  if (percent > INITIAL_DEPOSIT_PERCENT_MAX) return null;
  return percent;
}
