import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PersonaSlug } from '../types/persona';

export type EnrollPersonaParams = { targetPersona: PersonaSlug };

export type EnrollStackParamList = {
  EnrollPersonaExplain: EnrollPersonaParams;
  EnrollPersonaSetup: EnrollPersonaParams;
  EnrollPersonaSuccess: EnrollPersonaParams;
};

export type SignupParams = {
  /** Preselect a persona from FTUE / hero / nudge CTAs. */
  preselectedPersona?: 'client' | 'agent' | 'business';
  /** Attribution source for analytics. */
  source?: 'onboarding' | 'hero' | 'nudge' | 'organic';
};

export type OtpVerificationParams =
  | {
      channel: 'phone';
      phoneE164: string;
      flow?: 'login' | 'signup';
      signupSource?: SignupParams['source'];
      /** Required when flow is signup (deferred account creation). */
      attemptId?: string;
    }
  | {
      channel: 'email';
      email: string;
      flow?: 'login' | 'signup';
      signupSource?: SignupParams['source'];
      /** Required when flow is signup (deferred account creation). */
      attemptId?: string;
    };

export type AuthStackParamList = {
  SavedAccounts: { mode?: 'continue' | 'switch' } | undefined;
  Login: undefined;
  Signup: SignupParams | undefined;
  ResetPassword: undefined;
  OtpVerification: OtpVerificationParams;
  About: undefined;
  DeveloperOptions: undefined;
};

export type SavedAccountsScreenProps = NativeStackScreenProps<AuthStackParamList, 'SavedAccounts'>;

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type SignupScreenProps = NativeStackScreenProps<AuthStackParamList, 'Signup'>;
export type ResetPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;
export type OtpVerificationScreenProps = NativeStackScreenProps<AuthStackParamList, 'OtpVerification'>;
export type AboutScreenProps = NativeStackScreenProps<AuthStackParamList, 'About'>;
export type DeveloperOptionsScreenProps = NativeStackScreenProps<
  AuthStackParamList,
  'DeveloperOptions'
>;

/** Params shared by guest and client stacks for catalog item detail. */
export type InventoryItemDetailParams = {
  inventoryItemId: string;
  availabilityResult?: 'confirmed' | 'adjusted' | 'unavailable';
  availabilityQuantity?: number;
};

/** Client stack: place order for one catalog line (mirrors web place order). */
export type PlaceOrderParams = { inventoryItemId: string; variantId?: string };

/** After checkout: next steps depend on payment timing (aligned with web OrderConfirmationPage). */
export type OrderPlacedSuccessParams = {
  /** One or more order numbers (multi-business cart → multiple orders). */
  orderNumbers: string[];
  paymentTiming: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
  /** True when payment is already settled (e.g. Stripe automatic capture), so no confirmation is required. */
  paymentCompleted?: boolean;
  /** Manual capture: card authorized at checkout; customer is not charged yet. */
  cardAuthorized?: boolean;
  /** Used for card-authorized copy (agent pickup vs store collect). */
  fulfillment?: 'delivery' | 'pickup' | 'shipping';
};

/** MoMo push pending: wait for customer to approve on their phone. */
export type MobileMoneyAwaitingPaymentParams = {
  orderIds: string[];
  phoneE164: string;
  source: 'checkout' | 'pickup' | 'retry';
  /** Optional labels for success navigation after checkout. */
  orderNumbers?: string[];
  /** Passed through to OrderPlacedSuccess after checkout MoMo completes. */
  fulfillment?: 'delivery' | 'pickup' | 'shipping';
};

/** Guest shell: root stack (tabs + item detail). */
export type CollectionDetailParams = { slug: string };

export type StoreDetailParams = {
  businessId: string;
  /** Merchant preview chrome + owner catalog visibility. */
  previewMode?: boolean;
};

export type GuestRootStackParamList = {
  GuestTabs: NavigatorScreenParams<GuestTabParamList> | undefined;
  InventoryItemDetail: InventoryItemDetailParams;
  CollectionDetail: CollectionDetailParams;
  StoresList: undefined;
  StoreDetail: StoreDetailParams;
  Cart: undefined;
  RentalListingDetail: { listingId: string };
};

/** Guest shell: browse catalog + rentals + food + auth stack in bottom tabs. */
export type GuestTabParamList = {
  GuestBrowse: undefined;
  GuestRentals: undefined;
  GuestFoods: undefined;
  GuestAuth: NavigatorScreenParams<AuthStackParamList>;
};

export type ClientMainTabParamList = {
  ClientBrowse: undefined;
  ClientRentals: undefined;
  ClientFoods: undefined;
  ClientOrders: undefined;
  ClientMenu: undefined;
};

export type ClientRootStackParamList = {
  ClientMainTabs: NavigatorScreenParams<ClientMainTabParamList> | undefined;
  NotificationsCenter: undefined;
  InventoryItemDetail: InventoryItemDetailParams;
  CollectionDetail: CollectionDetailParams;
  StoresList: undefined;
  StoreDetail: StoreDetailParams;
  PlaceOrder: PlaceOrderParams;
  Cart: undefined;
  CartCheckout: undefined;
  OrderPlacedSuccess: OrderPlacedSuccessParams;
  MobileMoneyAwaitingPayment: MobileMoneyAwaitingPaymentParams;
  OrderDetail: {
    orderId: string;
    openMessages?: boolean;
    highlightMessageId?: string;
    rate?: 'agent' | 'item';
  };
  OrderMessages: {
    orderId: string;
    highlightMessageId?: string;
    draftMessage?: string;
  };
  Profile: undefined;
  UserLikes: undefined;
  ClientProductInterest: undefined;
  NotificationPreferences: undefined;
  SavedAccounts: { mode?: 'continue' | 'switch' };
  AccountManagement: undefined;
  Documents: undefined;
  Terms: undefined;
  Privacy: undefined;
  FAQ: undefined;
  AssistantChat: undefined;
  Messages: undefined;
  ThreadDetail: { threadId: string };
  SupportTickets: undefined;
  ClientAccounts: undefined;
  RentalListingDetail: { listingId: string };
  RentalRequestSubmitted: { requestId?: string };
  ClientMyRentals: undefined;
  RentalBookingDetail: { bookingId: string };
  RentalRateBooking: { bookingId: string };
  NotificationPermission: undefined;
  EnrollPersonaExplain: EnrollPersonaParams;
  EnrollPersonaSetup: EnrollPersonaParams;
  EnrollPersonaSuccess: EnrollPersonaParams;
};

export type ClientAppNavScreen = keyof ClientRootStackParamList | keyof ClientMainTabParamList;

export type BusinessMainTabParamList = {
  BusinessDashboard: undefined;
  BusinessOrders: { cashReconciliation?: boolean } | undefined;
  BusinessCatalog:
    | {
        locationId?: string;
        moderationStatus?: 'rejected' | 'proposal_pending';
        /** Rentals studio tab when main_interest is rentals. */
        tab?: 'catalog' | 'requests' | 'schedule';
      }
    | undefined;
  BusinessMenu: undefined;
};

export type BusinessPickupPaymentAwaitingParams = {
  orderId: string;
  phoneE164: string;
  orderNumber?: string;
  amount?: string;
};

export type BusinessRootStackParamList = {
  BusinessMainTabs: NavigatorScreenParams<BusinessMainTabParamList> | undefined;
  NotificationsCenter: undefined;
  BusinessOrdersList: { cashReconciliation?: boolean } | undefined;
  BusinessOrderDetail: { orderId: string; openMessages?: boolean; highlightMessageId?: string };
  OrderMessages: {
    orderId: string;
    highlightMessageId?: string;
    draftMessage?: string;
  };
  BusinessPickupPaymentAwaiting: BusinessPickupPaymentAwaitingParams;
  BusinessFailedDeliveriesList: undefined;
  BusinessRefundsList: undefined;
  BusinessLocationsList:
    | { transferRequestId?: string; hoursUpdated?: boolean }
    | undefined;
  BusinessTeam: undefined;
  BusinessLocationForm: { locationId?: string };
  BusinessLocationHours: { locationId: string };
  BusinessItemsList:
    | { locationId?: string; moderationStatus?: 'rejected' | 'proposal_pending' }
    | undefined;
  BusinessAddItemFromImage: { locationId?: string; returnToDashboard?: boolean } | undefined;
  BusinessItemDetail: { itemId: string };
  BusinessItemForm: { itemId: string };
  BusinessItemFulfillment: { itemId: string };
  BusinessItemAiProposal: { itemId: string };
  BusinessAiImageCleanupReview: { jobId: string };
  BusinessStockAvailabilityConfirm: { messageId: string };
  BusinessRentalsStudio:
    | {
        tab?: 'catalog' | 'requests' | 'schedule';
        moderationStatus?: 'rejected' | 'proposal_pending';
      }
    | undefined;
  BusinessProductInterest: undefined;
  BusinessAddRentalFromImage: { returnToDashboard?: boolean } | undefined;
  BusinessRentalItemDetail: { itemId: string };
  BusinessRentalItemEdit: { itemId: string };
  BusinessRentalAddListing: { itemId: string };
  BusinessRentalAiProposal: { listingId: string };
  BusinessRentalBookingDetail: { bookingId: string };
  AdminRentalListingsModeration: undefined;
  AdminRentalAiReviews: undefined;
  AdminItemModeration: undefined;
  AdminItemAiReviews: { reviewId?: string; openedAt?: number } | undefined;
  AdminItemsBrowser: undefined;
  AdminItemDetail: { itemId: string };
  AdminBusinessesList: undefined;
  AdminBusinessVerification: { businessId: string };
  AdminPerformance: undefined;
  BusinessReferralReview: { businessId: string };
  BusinessReferredBusinesses: undefined;
  AdminUsers: undefined;
  AdminBroadcasts: undefined;
  AdminWhatsAppInbox: undefined;
  AdminWhatsAppConversation: { conversationId: string };
  AdminOrders: undefined;
  AdminOrderDetail: { orderId: string };
  AdminCredits: undefined;
  AccountRecharge: undefined;
  BusinessAccounts: undefined;
  BusinessAiTokens: undefined;
  BusinessAccountTypeScreen: undefined;
  BusinessClientCities: undefined;
  BusinessInsights: undefined;
  BusinessMerchantAgreement: undefined;
  BusinessSetupStepSuccess: {
    step: 'agreement' | 'identity' | 'mobileMoney' | 'payouts' | 'catalog';
    variant?: 'continue' | 'complete';
    isRental?: boolean;
  };
  BusinessConfigurePayments: undefined;
  BusinessMobilePaymentPhones: undefined;
  StoresList: undefined;
  StoreDetail: StoreDetailParams;
  Profile: undefined;
  NotificationPreferences: undefined;
  SavedAccounts: { mode?: 'continue' | 'switch' };
  AccountManagement: undefined;
  Documents: { returnToDashboard?: boolean } | undefined;
  Terms: undefined;
  Privacy: undefined;
  FAQ: undefined;
  AssistantChat: undefined;
  Messages: undefined;
  ThreadDetail: { threadId: string };
  SupportTickets: undefined;
  NotificationPermission: undefined;
  EnrollPersonaExplain: EnrollPersonaParams;
  EnrollPersonaSetup: EnrollPersonaParams;
  EnrollPersonaSuccess: EnrollPersonaParams;
};

export type BusinessAppNavScreen = keyof BusinessRootStackParamList | keyof BusinessMainTabParamList;

export type DelegateMainTabParamList = {
  DelegateOrders: undefined;
  DelegateMenu: undefined;
};

export type DelegateRootStackParamList = {
  DelegateMainTabs: NavigatorScreenParams<DelegateMainTabParamList> | undefined;
  DelegateOrdersList: undefined;
  DelegateOrderDetail: {
    orderId: string;
    openMessages?: boolean;
    highlightMessageId?: string;
  };
  OrderMessages: {
    orderId: string;
    highlightMessageId?: string;
    draftMessage?: string;
  };
};

export type DelegateAppNavScreen =
  | keyof DelegateRootStackParamList
  | keyof DelegateMainTabParamList;

export type AccountManagementScreenProps = NativeStackScreenProps<
  ClientRootStackParamList,
  'AccountManagement'
>;
