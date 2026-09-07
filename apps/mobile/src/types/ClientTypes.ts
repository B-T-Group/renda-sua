/**
 * Types stub pour hooks client (app agent n'utilise pas ces flux).
 */

export interface ProjectDepositInvestment {
  id?: string;
  productApplicationId?: number;
  deposit?: number;
  amount?: number;
  [key: string]: unknown;
}

export interface InvestmentDividend {
  id?: string;
  amount?: number;
  currency?: string;
  createdAt?: string;
  interestRate?: number;
  [key: string]: unknown;
}
