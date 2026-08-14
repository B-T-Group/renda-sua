export interface DelegationRoleSummary {
  id: string;
  key: string;
  name: string;
}

export interface DelegationGrant {
  id: string;
  locationId: string;
  locationName: string;
  businessId: string;
  businessName: string;
  role: DelegationRoleSummary;
  permissions: string[];
}

export interface DelegationAccessContext {
  userId: string;
  delegationId: string;
  businessId: string;
  locationId: string;
  role: DelegationRoleSummary;
  permissions: string[];
}

export type ActiveContext =
  | { kind: 'persona'; persona: 'client' | 'agent' | 'business' }
  | { kind: 'delegation'; delegationId: string };
