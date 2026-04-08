/**
 * Types aligned with Orange Money Core APIs Swagger (OrangeMoneyCoreAPIS 1.0.2).
 */
import type { CollectionRequest } from '../mtn-momo/mtn-momo.service';

/** Merchant collection body (same as MTN CollectionRequest). Channel PIN comes from server config. */
export type OrangeCollectionRequest = CollectionRequest;

/** Mirrors MtnMomoResponse for mobile-payments mapping. */
export interface OrangeMomoPaymentResponse {
  status: boolean;
  financialTransactionId?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
  payerMessage?: string;
  payeeNote?: string;
  error?: string;
}

export interface OrangeMomoResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface OrangeMomoTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/** Init responses expose payToken under data */
export interface PayTokenData {
  payToken?: string;
}

export interface MessageWrapper<T> {
  data?: T;
  message?: string;
}

export type MpInitResponse = MessageWrapper<MpInitResponseData>;
export interface MpInitResponseData {
  payToken?: string;
}

export type CashinInitResponse = MessageWrapper<CashinInitResponseData>;
export interface CashinInitResponseData {
  payToken?: string;
}

export type CashoutInitResponse = MessageWrapper<CashoutInitResponseData>;
export interface CashoutInitResponseData {
  payToken?: string;
}

export type C2cInitResponse = MessageWrapper<C2cInitResponseData>;
export interface C2cInitResponseData {
  payToken?: string;
}

export type Ic2cInitResponse = MessageWrapper<Ic2cInitResponseData>;
export interface Ic2cInitResponseData {
  payToken?: string;
}

export interface MpPayRequestBody {
  notifUrl?: string;
  channelUserMsisdn?: string;
  amount?: number;
  subscriberMsisdn?: string;
  pin?: string;
  orderId?: string;
  description?: string;
  payToken?: string;
}

export interface CashinPayRequestBody {
  notifUrl?: string;
  channelUserMsisdn?: string;
  amount?: number;
  subscriberMsisdn?: string;
  pin?: string;
  orderId?: string;
  description?: string;
  payToken?: string;
}

export interface CashoutPayRequestBody {
  notifUrl?: string;
  channelUserMsisdn?: string;
  amount?: number;
  subscriberMsisdn?: string;
  pin?: string;
  orderId?: string;
  description?: string;
  payToken?: string;
}

export interface C2cPayRequestBody {
  amount?: number;
  pin?: string;
  orderId?: string;
  fromChannelMsisdn?: string;
  description?: string;
  toChannelMsisdn?: string;
  payToken?: string;
}

export interface Ic2cPayRequestBody {
  notifUrl?: string;
  toChannelMsisdn?: string;
  amount?: number;
  fromChannelMsisdn?: string;
  pin?: string;
  orderId?: string;
  description?: string;
  payToken?: string;
}

export interface MpEntity {
  createtime?: number;
  amount?: number;
  channelUserMsisdn?: string;
  inittxnmessage?: string;
  confirmtxnmessage?: string;
  confirmtxnstatus?: string;
  subscriberMsisdn?: string;
  txnmode?: string;
  notifyUrl?: string;
  inittxnstatus?: string;
  payToken?: string;
  txnid?: string;
  status?: string;
}

export interface CashinEntity {
  createtime?: string;
  amount?: number;
  channelUserMsisdn?: string;
  subscriberMsisdn?: string;
  txnmode?: string;
  txnstatus?: number;
  txnmessage?: string;
  payToken?: string;
  txnid?: string;
  status?: string;
}

export interface CashoutEntity {
  createtime?: string;
  amount?: number;
  channelUserMsisdn?: string;
  inittxnmessage?: string;
  confirmtxnmessage?: string;
  confirmtxnstatus?: string;
  subscriberMsisdn?: string;
  txnmode?: string;
  notifyUrl?: string;
  inittxnstatus?: string;
  payToken?: string;
  txnid?: string;
  status?: string;
}

export interface C2cEntity {
  createtime?: string;
  amount?: number;
  txnmode?: string;
  txnstatus?: number;
  fromChannelMsisdn?: string;
  txnmessage?: string;
  payToken?: string;
  txnid?: string;
  status?: string;
  toChannelMsisdn?: string;
}

export interface Ic2cEntity {
  createtime?: number;
  amount?: number;
  toChannelMsisdn?: string;
  inittxnmessage?: string;
  confirmtxnmessage?: string;
  confirmtxnstatus?: string;
  fromChannelMsisdn?: string;
  txnmode?: string;
  notifyUrl?: string;
  inittxnstatus?: string;
  payToken?: string;
  txnid?: string;
  status?: string;
}

export type MpPayResponseBody = MessageWrapper<MpEntity>;
export type CashinPayResponseBody = MessageWrapper<CashinEntity>;
export type CashoutPayResponseBody = MessageWrapper<CashoutEntity>;
export type C2cPayResponseBody = MessageWrapper<C2cEntity>;
export type Ic2cPayResponseBody = MessageWrapper<Ic2cEntity>;

export interface BulkPaymentStatusBody {
  payload: string;
}

export interface UserInfosBody {
  pin?: string;
  channelMsisdn: string;
}

export interface UserInfosData {
  firstname?: string;
  lastname?: string;
}

export type UserInfosResponse = MessageWrapper<UserInfosData>;
