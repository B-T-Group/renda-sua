import {
  BusinessLocation,
  UpdateBusinessLocationData,
} from '../../../hooks/useBusinessLocations';

export interface LocationSectionActions {
  location: BusinessLocation;
  locations: BusinessLocation[];
  businessId?: string;
  isStripeRail: boolean;
  railLoading: boolean;
  isOwnBusiness: boolean;
  updateLocation: (
    id: string,
    data: UpdateBusinessLocationData
  ) => Promise<unknown>;
  deleteLocation: (id: string) => Promise<unknown>;
  onManageItems: () => void;
  /** Increments when the expectations card asks to add or verify a payout number. */
  phoneRequest?: number;
}

export function isOwnerForbidden(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return status === 403;
}
