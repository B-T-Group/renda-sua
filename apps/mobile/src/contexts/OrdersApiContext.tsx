import React, { createContext, useContext, useMemo } from 'react';
import { businessApi } from '../services/businessApi';
import { delegateApi } from '../services/delegateApi';
import { agentApi } from '../services/agentApi';
import type {
  BusinessOrder,
  BusinessOrderFilters,
  ConfirmOrderPayload,
  OrderActionPayload,
  ReconcileCashPayload,
} from '../types/business/orders';
import type { OrderActionResponse, OrdersResponse } from '../types/agent';
import type {
  MentionableParticipant,
  OrderMessage,
  QuickMessageTemplate,
} from '../services/agentApi';

export type OrdersApiMode = 'owner' | 'delegate';

export type OrdersApi = {
  mode: OrdersApiMode;
  list: (filters?: BusinessOrderFilters) => Promise<OrdersResponse>;
  getById: (orderId: string) => Promise<{ success: boolean; order: BusinessOrder }>;
  confirm: (body: ConfirmOrderPayload) => Promise<OrderActionResponse>;
  cancel: (body: OrderActionPayload) => Promise<OrderActionResponse>;
  completePreparation: (body: OrderActionPayload) => Promise<OrderActionResponse>;
  markShipped: (
    orderId: string,
    body?: { tracking_number?: string; carrier?: string }
  ) => Promise<OrderActionResponse>;
  updateTracking: (
    orderId: string,
    body: { tracking_number: string; carrier?: string }
  ) => Promise<OrderActionResponse>;
  complete?: (body: OrderActionPayload) => Promise<OrderActionResponse>;
  confirmClientPickup: (
    orderId: string,
    pin: string,
    options?: { useLatestSharedPin?: boolean; pinMessageId?: string }
  ) => Promise<{ success: boolean; message?: string }>;
  initiatePayAtPickupPayment: (
    orderId: string,
    body?: { phone_number?: string }
  ) => Promise<{ success: boolean; message?: string }>;
  getActiveDeliveryPin: (orderId: string) => Promise<{
    messageId: string;
    pin: string;
    pinVersion: number;
    sharedAt: string;
  } | null>;
  generateDeliveryOverwriteCode?: (
    orderId: string
  ) => Promise<{ success: boolean; overwriteCode?: string; message?: string }>;
  reconcileCashException?: (
    orderId: string,
    body: ReconcileCashPayload
  ) => Promise<{ success: boolean; message?: string }>;
  getMessages: (
    orderId: string
  ) => Promise<{ success: boolean; messages: OrderMessage[]; error?: string }>;
  sendMessage: (
    orderId: string,
    message: string,
    mentionedUserId?: string
  ) => Promise<{ success: boolean; message?: OrderMessage }>;
  getMentionableParticipants: (
    orderId: string
  ) => Promise<{ success: boolean; participants: MentionableParticipant[] }>;
  getQuickMessageTemplates: (orderId: string) => Promise<QuickMessageTemplate[]>;
  sendQuickMessage: (orderId: string, templateId: string) => Promise<void>;
};

function buildOwnerOrdersApi(): OrdersApi {
  return {
    mode: 'owner',
    list: (f) => businessApi.orders.list(f),
    getById: (id) => businessApi.orders.getById(id),
    confirm: (b) => businessApi.orders.confirm(b),
    cancel: (b) => businessApi.orders.cancel(b),
    completePreparation: (b) => businessApi.orders.completePreparation(b),
    markShipped: (id, body) => businessApi.orders.markShipped(id, body),
    updateTracking: (id, body) => businessApi.orders.updateTracking(id, body),
    complete: (b) => businessApi.orders.complete(b),
    confirmClientPickup: (id, pin, opts) =>
      businessApi.orders.confirmClientPickup(id, pin, opts),
    initiatePayAtPickupPayment: (id, body) =>
      businessApi.orders.initiatePayAtPickupPayment(id, body),
    getActiveDeliveryPin: (id) => businessApi.orders.getActiveDeliveryPin(id),
    generateDeliveryOverwriteCode: (id) =>
      businessApi.orders.generateDeliveryOverwriteCode(id),
    reconcileCashException: (id, body) =>
      businessApi.orders.reconcileCashException(id, body),
    getMessages: (id) => agentApi.orders.getMessages(id),
    sendMessage: (id, message, mentionedUserId) =>
      agentApi.orders.sendMessage(id, message, mentionedUserId),
    getMentionableParticipants: (id) =>
      agentApi.orders.getMentionableParticipants(id),
    getQuickMessageTemplates: (id) => agentApi.orders.getQuickMessageTemplates(id),
    sendQuickMessage: (id, templateId) =>
      agentApi.orders.sendQuickMessage(id, templateId),
  };
}

function buildDelegateOrdersApi(): OrdersApi {
  return {
    mode: 'delegate',
    list: (f) => delegateApi.orders.list(f),
    getById: (id) => delegateApi.orders.getById(id),
    confirm: (b) => delegateApi.orders.confirm(b),
    cancel: (b) => delegateApi.orders.cancel(b),
    completePreparation: (b) => delegateApi.orders.completePreparation(b),
    markShipped: (id, body) => delegateApi.orders.markShipped(id, body),
    updateTracking: (id, body) => delegateApi.orders.updateTracking(id, body),
    confirmClientPickup: (id, pin, opts) =>
      delegateApi.orders.confirmClientPickup(id, pin, opts),
    initiatePayAtPickupPayment: (id, body) =>
      delegateApi.orders.initiatePayAtPickupPayment(id, body),
    getActiveDeliveryPin: (id) => delegateApi.orders.getActiveDeliveryPin(id),
    getMessages: (id) => delegateApi.orders.getMessages(id),
    sendMessage: (id, message, mentionedUserId) =>
      delegateApi.orders.sendMessage(id, message, mentionedUserId),
    getMentionableParticipants: (id) =>
      delegateApi.orders.getMentionableParticipants(id),
    getQuickMessageTemplates: (id) =>
      delegateApi.orders.getQuickMessageTemplates(id),
    sendQuickMessage: (id, templateId) =>
      delegateApi.orders.sendQuickMessage(id, templateId),
  };
}

const ownerDefault = buildOwnerOrdersApi();

const OrdersApiContext = createContext<OrdersApi>(ownerDefault);

export function OwnerOrdersApiProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => buildOwnerOrdersApi(), []);
  return <OrdersApiContext.Provider value={value}>{children}</OrdersApiContext.Provider>;
}

export function DelegateOrdersApiProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => buildDelegateOrdersApi(), []);
  return <OrdersApiContext.Provider value={value}>{children}</OrdersApiContext.Provider>;
}

export function useOrdersApi(): OrdersApi {
  return useContext(OrdersApiContext);
}
