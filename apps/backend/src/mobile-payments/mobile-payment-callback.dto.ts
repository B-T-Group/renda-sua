export interface MyPVitCallbackDto {
  transactionId: string;
  merchantReferenceId: string;
  status: 'SUCCESS' | 'FAILED';
  amount: number;
  customerID: string;
  fees: number;
  chargeOwner: string;
  transactionOperation: string;
  operator: string;
  code: number;
}

export interface FreemopayCallbackDto {
  reference: string;
  externalId?: string;
  merchantRef?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  amount?: number;
  reason?: string;
  message?: string;
}
