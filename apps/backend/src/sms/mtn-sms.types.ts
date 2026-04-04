/** Types aligned with MTN SMS v3 Swagger (Short Message Service API). */

export interface OutboundSmsMessageRequest {
  message: string;
  serviceCode: string;
  receiverAddress: string[];
  clientCorrelatorId: string;
  senderAddress?: string;
  keyword?: string;
  requestDeliveryReceipt?: boolean;
}

export interface MtnSmsResourceReferenceData {
  status: string;
}

export interface MtnSmsResourceReference {
  statusCode: string;
  statusMessage: string;
  transactionId: string;
  data: MtnSmsResourceReferenceData;
}

export interface ShortCodeSubscription {
  callbackUrl: string;
  targetSystem: string;
  serviceCode: string;
  deliveryReportUrl?: string;
}

export interface SubscriptionResponseData {
  subscriptionId?: string;
}

export interface MtnSmsSubscriptionResponse {
  statusCode: string;
  statusMessage: string;
  transactionId: string;
  data?: SubscriptionResponseData;
}

export interface UpdateSubscriptionRequest {
  serviceCode?: string;
  callbackUrl?: string;
  deliveryReportUrl?: string;
  targetSystem?: string;
  keywords?: string[];
}

export interface OutboundSubscriptionDeleteResponseData {
  subscriptionId?: string;
}

export interface MtnSmsOutboundSubscriptionDeleteResponse {
  statusCode: string;
  statusMessage: string;
  transactionId: string;
  data?: OutboundSubscriptionDeleteResponseData;
}

export interface MtnSmsErrorBody {
  statusCode: string;
  statusMessage: string;
  transactionId: string;
  supportMessage?: string;
  timestamp?: string;
  path?: string;
  method?: string;
}
