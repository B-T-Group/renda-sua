/** GET /accounts/info — legacy XAF wallet + nested transactions (backend shape). */

export interface AccountTransactionRow {
  id: string;
  account_id: string;
  transaction_type: string;
  amount: number;
  memo?: string | null;
  created_at: string;
}

export interface AccountInfoRow {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  business_location_id?: string | null;
  business_location?: { id: string; name: string; phone?: string } | null;
  account_transactions: AccountTransactionRow[];
}

export interface AccountInfoData {
  accounts: AccountInfoRow[];
  clients: unknown[];
}

export interface AccountInfoResponse {
  success: boolean;
  data?: AccountInfoData;
  error?: string;
}

export interface InitiateMobilePaymentBody {
  amount: number;
  currency: string;
  description: string;
  customerPhone?: string;
  accountId?: string;
  transactionType?: 'PAYMENT' | 'GIVE_CHANGE';
  /** Required when the owning business has withdrawal PIN enabled. */
  withdrawalPin?: string;
}

export interface WithdrawalConfigResponse {
  success: boolean;
  data?: { requirePin: boolean };
  error?: string;
}

export interface InitiateMobilePaymentResponse {
  success: boolean;
  data?: {
    transactionId: string;
    providerTransactionId?: string;
    paymentUrl?: string;
    message?: string;
    provider?: string;
  };
  message?: string;
  errorCode?: string;
}
