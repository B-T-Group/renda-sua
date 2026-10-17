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

export interface FedaPayCallbackDto {
  entity: {
    id: number;
    status: 'pending' | 'approved' | 'declined' | 'canceled' | 'transferred' | string;
    amount: number;
    reference?: string;
    custom_metadata?: {
      externalId?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  name: string;
}
