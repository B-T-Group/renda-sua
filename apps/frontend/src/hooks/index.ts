// Auth and user hooks
export { useAccountInfo } from './useAccountInfo';
export { useAccountManager } from './useAccountManager';
export { useAddressManager } from './useAddressManager';
export { useAuthFlow } from './useAuthFlow';
export { useLoginFlow } from './useLoginFlow';
export { useProfile } from './useProfile';
export { useUserProfile } from './useUserProfile';
export { useUserTypes } from './useUserTypes';

// GraphQL hooks
export { useGraphQLClient } from './useGraphQLClient';
export { useGraphQLRequest } from './useGraphQLRequest';

// Data hooks
export { useBackendOrders } from './useBackendOrders';
export { useClients } from './useClients';
export { useCreateOrder } from './useCreateOrder';
export { useDeliveryFees } from './useDeliveryFees';
export { useInventoryItems } from './useInventoryItems';
export { useOrderById } from './useOrderById';
export type { OrderData } from './useOrderById';
export { useOrders } from './useOrders';
export type { Order, OrderFilters } from './useOrders';

// Agent hooks
export { useAgentOrders } from './useAgentOrders';

// Business hooks
export { useBusinessInventory } from './useBusinessInventory';
export { useBusinessLocations } from './useBusinessLocations';
export { useBusinessOrders } from './useBusinessOrders';
export { useEditItemFlow } from './useEditItemFlow';
export { useItems } from './useItems';

// Client hooks
export { useClientOrders } from './useClientOrders';

// API client
export { useApiClient } from './useApiClient';

// AI hooks
export { useAi } from './useAi';
export type {
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
} from './useAi';

// Payment hooks
export { useAirtelMoney } from './useAirtelMoney';
export { useMtnMomoTopUp } from './useMtnMomoTopUp';

// AWS hooks
export { useAws } from './useAws';

// SEO hooks
export { useSEO } from './useSEO';
export type { PageSEOConfig } from './useSEO';

// Image types
export type { CreateItemImageData, ImageType, ItemImage } from '../types/image';

// Loading Components
export { default as LoadingPage } from '../components/common/LoadingPage';
export { default as LoadingSpinner } from '../components/common/LoadingSpinner';

// New export
export { usePublicItems } from './usePublicItems';

export { useAdminAgents } from './useAdminAgents';
export { useAdminBusinesses } from './useAdminBusinesses';
export { useAdminClients } from './useAdminClients';
export { useApiWithLoading } from './useApiWithLoading';
export { useCurrentLocation } from './useCurrentLocation';
export * from './useDistanceMatrix';
export { useVehicleTypes } from './useVehicleTypes';

// Document management hooks
export { useDocumentApprove } from './useDocumentApprove';
export type { ApproveUploadResponse } from './useDocumentApprove';
export { useDocumentDelete } from './useDocumentDelete';
export type { DeleteUploadResponse } from './useDocumentDelete';
export { useDocumentManagement } from './useDocumentManagement';

// User messages hooks
export type {
  DocumentFilters,
  DocumentType,
  UserDocument,
} from './useDocumentManagement';
export { useDocumentPreview } from './useDocumentPreview';
export type { DocumentPreviewResponse } from './useDocumentPreview';
export { useDocumentUpload } from './useDocumentUpload';
export type {
  UploadProgress,
  UploadUrlRequest,
  UploadUrlResponse,
} from './useDocumentUpload';
export { useUserMessages } from './useUserMessages';
export type {
  EntityType,
  MessageFilters,
  UserMessage,
} from './useUserMessages';

// Admin message hooks
export { useAdminMessage } from './useAdminMessage';
export type {
  AdminMessageRequest,
  AdminMessageResponse,
} from './useAdminMessage';

// User details hook
export { useUserDetails } from './useUserDetails';

// Search hooks
export { useItemSearch } from './useItemSearch';
export type { SearchResult } from './useItemSearch';
