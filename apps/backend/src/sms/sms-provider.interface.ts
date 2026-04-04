export interface SendSmsParams {
  to: string | string[];
  message: string;
  clientCorrelatorId?: string;
  requestDeliveryReceipt?: boolean;
  senderAddress?: string;
  keyword?: string;
  /** Overrides default `MTN_SMS_SERVICE_CODE` when set. */
  serviceCode?: string;
}

export interface SmsSendResult {
  success: boolean;
  transactionId?: string;
  statusCode?: string;
  statusMessage?: string;
  dataStatus?: string;
  error?: string;
}

export interface SmsProvider {
  sendSms(params: SendSmsParams): Promise<SmsSendResult>;
}
