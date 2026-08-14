import { useAuth0 } from '@auth0/auth0-react';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from './SessionAuthContext';
import { useApiClient } from '../hooks/useApiClient';
import { useGraphQLRequest } from '../hooks/useGraphQLRequest';
import {
  readStoredActiveContext,
  writeStoredActivePersona,
  writeStoredActiveDelegation,
  clearStoredActivePersona,
} from '../utils/activePersonaStorage';
import type {
  ActiveContext,
  DelegationGrant,
} from '../types/delegation';

export interface Address {
  id: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
  address_type: string;
  instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** When set, account is scoped to a business location; header balance uses legacy (null) wallets only. */
  business_location_id?: string | null;
}

/** Personal / legacy wallet: not tied to a specific business location. */
export function isLegacyWalletAccount(
  account: Pick<Account, 'business_location_id'>
): boolean {
  return account.business_location_id == null;
}

export interface UserProfile {
  id: string;
  identifier: string;
  email: string;
  email_verified?: boolean | null;
  first_name: string;
  last_name: string;
  phone_number?: string;
  phone_number_verified?: boolean | null;
  profile_picture_url?: string;
  preferred_language?: string;
  /** IANA timezone (e.g. Africa/Douala) */
  timezone?: string;
  user_type_id: string;
  client?: {
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  };
  agent?: {
    id: string;
    user_id: string;
    vehicle_type_id: string;
    is_verified: boolean;
    is_internal: boolean;
    onboarding_complete: boolean;
    status?: 'active' | 'suspended';
    agent_code?: string;
    focus?: 'delivery' | 'commercial' | 'both';
    location_tracking_consent_web?: 'not_shown' | 'accepted' | 'deferred';
    created_at: string;
    updated_at: string;
  };
  business?: {
    id: string;
    user_id: string;
    name: string;
    main_interest?: 'sell_items' | 'rent_items';
    /** @deprecated Removed from API; use is_superuser / permissions */
    is_admin?: boolean;
    is_verified: boolean;
    ai_tokens?: number;
    account_type?: 'STANDARD' | 'PREMIUM' | 'ELITE';
    account_type_locked_until?: string | null;
    created_at: string;
    updated_at: string;
  };
  addresses?: Address[];
  accounts?: Account[];
  created_at: string;
  updated_at: string;
  /** From GET /users/me when backend sends it */
  personas?: UserType[];
  /** ISO alpha-2 from primary address */
  country?: string | null;
  /** Display currency from supported_country_states */
  currency?: string | null;
  is_stripe_enabled?: boolean;
  /** Platform RBAC from GET /users/me */
  roles?: string[];
  permissions?: string[];
  is_superuser?: boolean;
}

export interface UserProfileResponse {
  success: boolean;
  user: UserProfile;
  message: string;
  /** True when /me just created a legacy personal wallet for the user's country currency. */
  personalAccountCreated?: boolean;
  /** Location grants when location_delegations flag is on */
  delegations?: DelegationGrant[];
  active_context?: ActiveContext | null;
  active_persona?: UserType | null;
}

export interface GetAccountsResponse {
  success: boolean;
  message: string;
  data: { accounts: Account[] };
}

export type UserType = 'client' | 'agent' | 'business';

function derivePersonasFromProfile(userProfile: UserProfile): UserType[] {
  if (userProfile.personas?.length) {
    return [...new Set(userProfile.personas)];
  }
  const u: UserType[] = [];
  if (userProfile.client) u.push('client');
  if (userProfile.agent) u.push('agent');
  if (userProfile.business) u.push('business');
  return u;
}

const UPDATE_USER_PROFILE_PICTURE = `
  mutation UpdateUserProfilePicture($id: uuid!, $profile_picture_url: String) {
    update_users_by_pk(
      pk_columns: { id: $id }
      _set: { profile_picture_url: $profile_picture_url }
    ) {
      id
      profile_picture_url
    }
  }
`;

const INSERT_AGENT_ADDRESS = `
  mutation InsertAgentAddress($agentAddress: agent_addresses_insert_input!) {
    insert_agent_addresses_one(object: $agentAddress) {
      id
      agent_id
      address_id
      created_at
      updated_at
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        is_primary
        address_type
        latitude
        longitude
        instructions
        created_at
        updated_at
      }
    }
  }
`;

const INSERT_CLIENT_ADDRESS = `
  mutation InsertClientAddress($clientAddress: client_addresses_insert_input!) {
    insert_client_addresses_one(object: $clientAddress) {
      id
      client_id
      address_id
      created_at
      updated_at
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        is_primary
        address_type
        latitude
        longitude
        instructions
        created_at
        updated_at
      }
    }
  }
`;

const INSERT_BUSINESS_ADDRESS = `
  mutation InsertBusinessAddress($businessAddress: business_addresses_insert_input!) {
    insert_business_addresses_one(object: $businessAddress) {
      id
      business_id
      address_id
      created_at
      updated_at
      address {
        id
        address_line_1
        address_line_2
        city
        state
        postal_code
        country
        is_primary
        address_type
        latitude
        longitude
        instructions
        created_at
        updated_at
        status
      }
    }
  }
`;

const UPDATE_ADDRESS = `
  mutation UpdateAddress($id: uuid!, $address: addresses_set_input!) {
    update_addresses_by_pk(
      pk_columns: { id: $id }
      _set: $address
    ) {
      id
      address_line_1
      address_line_2
      city
      state
      postal_code
      country
      is_primary
      address_type
      latitude
      longitude
      instructions
      created_at
      updated_at
      status
    }
  }
`;

interface AddressFormData {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  address_type: string;
  is_primary: boolean;
  instructions?: string;
}

interface UserProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  userType: UserType | null;
  /** Enabled profile kinds for this account */
  personas: UserType[];
  /** Active location grants from /users/me */
  delegations: DelegationGrant[];
  /** Current session context (persona or location grant) */
  activeContext: ActiveContext | null;
  /** Grant matching the active delegation context */
  activeDelegation: DelegationGrant | null;
  /** True when user is operating under a location grant */
  isDelegationContext: boolean;
  /** More than one persona and no valid stored choice yet */
  needsPersonaSelection: boolean;
  /** Needs to pick persona and/or delegation (multi-context or no stored choice) */
  needsContextSelection: boolean;
  setActivePersona: (persona: UserType) => Promise<void>;
  setActiveContext: (context: ActiveContext) => Promise<void>;
  isProfileComplete: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  accounts: Account[];
  accountsLoading: boolean;
  accountsError: string | null;
  refetch: () => Promise<void>;
  refetchAccounts: () => Promise<void>;
  clearProfile: () => void;
  updateBusinessAiTokens: (aiTokens: number) => void;
  updateProfile: (
    userId: string,
    firstName: string,
    lastName: string,
    phoneNumber: string,
    timezone: string
  ) => Promise<boolean>;
  updateProfilePicture: (
    userId: string,
    profilePictureUrl: string
  ) => Promise<boolean>;
  addAddress: (
    addressData: AddressFormData,
    userType: string,
    profileId: string
  ) => Promise<boolean>;
  updateAddress: (
    addressId: string,
    addressData: AddressFormData
  ) => Promise<boolean>;
  clearMessages: () => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(
  undefined
);

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({
  children,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [delegations, setDelegations] = useState<DelegationGrant[]>([]);
  const [activeContext, setActiveContextState] = useState<ActiveContext | null>(
    null
  );

  const { isLoading, getAccessTokenSilently } = useAuth0();
  const { isAuthenticated } = useSessionAuth();
  const apiClient = useApiClient();
  const { i18n } = useTranslation();

  // GraphQL hooks for mutations
  const { execute: updateUserProfilePicture } = useGraphQLRequest(
    UPDATE_USER_PROFILE_PICTURE
  );
  const { execute: insertAgentAddress } =
    useGraphQLRequest(INSERT_AGENT_ADDRESS);
  const { execute: insertClientAddress } = useGraphQLRequest(
    INSERT_CLIENT_ADDRESS
  );
  const { execute: insertBusinessAddress } = useGraphQLRequest(
    INSERT_BUSINESS_ADDRESS
  );
  const { execute: updateAddress } = useGraphQLRequest(UPDATE_ADDRESS);


  const checkProfile = useCallback(async () => {
    if (!apiClient || !isAuthenticated) {
      setError('API client not available or not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<UserProfileResponse>('/users/me');

      if (response.data.success) {
        const userProfile = response.data.user;
        setProfile(userProfile);

        const lang = userProfile.preferred_language;
        if (lang === 'en' || lang === 'fr') {
          i18n.changeLanguage(lang);
        }

        const personasList = derivePersonasFromProfile(userProfile);
        const grants = response.data.delegations ?? [];
        setDelegations(grants);

        let stored = readStoredActiveContext();
        if (stored?.userId !== userProfile.id) {
          stored = null;
        } else if (
          stored.kind === 'persona' &&
          stored.persona &&
          !personasList.includes(stored.persona)
        ) {
          clearStoredActivePersona();
          stored = null;
        } else if (
          stored.kind === 'delegation' &&
          stored.delegationId &&
          !grants.some((g) => g.id === stored!.delegationId)
        ) {
          clearStoredActivePersona();
          stored = null;
        }

        let effectivePersona: UserType | null = null;
        let nextContext: ActiveContext | null = null;

        if (stored?.kind === 'delegation' && stored.delegationId) {
          nextContext = {
            kind: 'delegation',
            delegationId: stored.delegationId,
          };
        } else if (
          stored?.kind === 'persona' &&
          stored.persona &&
          personasList.includes(stored.persona)
        ) {
          effectivePersona = stored.persona;
          nextContext = { kind: 'persona', persona: stored.persona };
        } else if (personasList.length === 1 && grants.length === 0) {
          effectivePersona = personasList[0];
          nextContext = { kind: 'persona', persona: effectivePersona };
          writeStoredActivePersona(userProfile.id, effectivePersona);
        } else if (personasList.length === 0 && grants.length === 1) {
          nextContext = {
            kind: 'delegation',
            delegationId: grants[0].id,
          };
          writeStoredActiveDelegation(userProfile.id, grants[0].id);
        }
        // Multiple contexts: user must pick on /select-persona.

        setUserType(effectivePersona);
        setActiveContextState(nextContext);

        const personaComplete = (t: UserType): boolean => {
          if (t === 'client') return !!userProfile.client;
          if (t === 'agent') return !!userProfile.agent;
          return !!userProfile.business;
        };

        const complete =
          (personasList.length > 0 &&
            personasList.every((p) => personaComplete(p))) ||
          (personasList.length === 0 && grants.length > 0);

        setIsProfileComplete(complete);
      } else {
        setError(response.data.message || 'Failed to fetch user profile');
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { status?: number; data?: { error?: string } };
        message?: string;
      };
      if (error.response?.status === 404) {
        setError('Profile not found');
        setIsProfileComplete(false);
      } else {
        setError(
          error.response?.data?.error ||
            error.message ||
            'Failed to fetch user profile'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, isAuthenticated, i18n]);

  const checkAccounts = useCallback(async () => {
    if (!isAuthenticated) {
      setAccountsError('Not authenticated');
      setAccountsLoading(false);
      return;
    }

    if (!apiClient) {
      setAccountsError('API client not available');
      setAccountsLoading(false);
      return;
    }

    setAccountsLoading(true);
    setAccountsError(null);

    try {
      const response = await apiClient.get<GetAccountsResponse>('/accounts');
      const result = response.data;
      if (result.success && result.data?.accounts) {
        setAccounts(result.data.accounts);
      } else {
        setAccounts([]);
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setAccountsError(error.message || 'Failed to fetch accounts');
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [isAuthenticated, apiClient]);

  const clearProfile = () => {
    setProfile(null);
    setUserType(null);
    setIsProfileComplete(false);
    setError(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setAccounts([]);
    setAccountsError(null);
    setDelegations([]);
    setActiveContextState(null);
    clearStoredActivePersona();
  };

  const updateBusinessAiTokens = (aiTokens: number) => {
    setProfile((prev) => {
      if (!prev?.business) return prev;
      return {
        ...prev,
        business: {
          ...prev.business,
          ai_tokens: aiTokens,
        },
      };
    });
  };

  const personas = useMemo(
    () => (profile ? derivePersonasFromProfile(profile) : []),
    [profile]
  );

  const activeDelegation = useMemo(() => {
    if (activeContext?.kind !== 'delegation') return null;
    return (
      delegations.find((d) => d.id === activeContext.delegationId) ?? null
    );
  }, [activeContext, delegations]);

  const isDelegationContext = activeContext?.kind === 'delegation';

  const needsPersonaSelection = useMemo(() => {
    if (!profile?.id) return false;
    const contextCount = personas.length + delegations.length;
    if (contextCount <= 1) return false;
    const s = readStoredActiveContext();
    if (s?.userId === profile.id) {
      if (
        s.kind === 'persona' &&
        s.persona &&
        personas.includes(s.persona)
      ) {
        return false;
      }
      if (
        s.kind === 'delegation' &&
        s.delegationId &&
        delegations.some((d) => d.id === s.delegationId)
      ) {
        return false;
      }
    }
    if (activeContext?.kind === 'persona' && activeContext.persona) {
      return false;
    }
    if (activeContext?.kind === 'delegation' && activeContext.delegationId) {
      return false;
    }
    if (userType && personas.includes(userType) && delegations.length === 0) {
      return false;
    }
    return true;
  }, [
    profile?.id,
    personas,
    userType,
    delegations,
    activeContext,
  ]);

  const needsContextSelection = needsPersonaSelection;

  const setActiveContext = useCallback(
    async (context: ActiveContext) => {
      if (!apiClient || !profile?.id) return;
      try {
        await apiClient.post('/users/me/active-context', context);
      } catch (e: any) {
        // Flag off or older backend: fall back to persona endpoint.
        if (context.kind === 'persona' && context.persona) {
          await apiClient.post('/users/me/active-persona', {
            persona: context.persona,
          });
        } else {
          throw e;
        }
      }
      if (context.kind === 'persona' && context.persona) {
        writeStoredActivePersona(profile.id, context.persona);
        setUserType(context.persona);
        setActiveContextState(context);
        setProfile((prev) =>
          prev ? { ...prev, user_type_id: context.persona } : null
        );
        try {
          await getAccessTokenSilently({
            cacheMode: 'off',
            authorizationParams: { active_persona: context.persona },
          });
        } catch (err) {
          console.warn('Token refresh with active_persona:', err);
        }
        return;
      }
      if (context.kind === 'delegation' && context.delegationId) {
        writeStoredActiveDelegation(profile.id, context.delegationId);
        setUserType(null);
        setActiveContextState(context);
        try {
          await getAccessTokenSilently({
            cacheMode: 'off',
          });
        } catch (err) {
          console.warn('Token refresh for delegation context:', err);
        }
      }
    },
    [apiClient, profile?.id, getAccessTokenSilently]
  );

  const setActivePersona = useCallback(
    async (persona: UserType) => {
      await setActiveContext({ kind: 'persona', persona });
    },
    [setActiveContext]
  );

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const updateProfile = async (
    userId: string,
    firstName: string,
    lastName: string,
    phoneNumber: string,
    timezone: string
  ): Promise<boolean> => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (!apiClient) {
        setErrorMessage('API client not available');
        return false;
      }

      const response = await apiClient.post<UserProfileResponse>(
        '/users/me/update',
        {
          firstName,
          lastName,
          phoneNumber,
          timezone,
        }
      );

      if (response.data.success) {
        setSuccessMessage('Profile updated successfully!');
        await checkProfile(); // Refresh the profile data
        return true;
      } else {
        setErrorMessage('Failed to update profile.');
        return false;
      }
    } catch (err: unknown) {
      setErrorMessage('Failed to update profile.');
      console.error('Error updating profile:', err);
      return false;
    }
  };

  const updateProfilePicture = async (
    userId: string,
    profilePictureUrl: string
  ): Promise<boolean> => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const result = await updateUserProfilePicture({
        id: userId,
        profile_picture_url: profilePictureUrl,
      });

      if (result?.update_users_by_pk) {
        setSuccessMessage('Profile picture updated successfully!');
        await checkProfile();
        return true;
      } else {
        setErrorMessage('Failed to update profile picture.');
        return false;
      }
    } catch (err: unknown) {
      setErrorMessage('Failed to update profile picture.');
      console.error('Error updating profile picture:', err);
      return false;
    }
  };

  const addAddress = async (
    addressData: AddressFormData,
    userType: string,
    profileId: string
  ): Promise<boolean> => {
    try {
      const addressInput = {
        data: {
          ...addressData,
        },
      };

      switch (userType) {
        case 'agent':
          await insertAgentAddress({
            agentAddress: {
              agent_id: profileId,
              address: addressInput,
            },
          });
          break;
        case 'client':
          await insertClientAddress({
            clientAddress: {
              client_id: profileId,
              address: addressInput,
            },
          });
          break;
        case 'business':
          await insertBusinessAddress({
            businessAddress: {
              business_id: profileId,
              address: addressInput,
            },
          });
          break;
        default:
          throw new Error('Invalid user type for address creation');
      }

      setSuccessMessage('Address saved successfully!');
      await checkProfile(); // Refresh the profile data
      return true;
    } catch (error) {
      setErrorMessage('Failed to save address');
      console.error('Error saving address:', error);
      return false;
    }
  };

  const updateAddressMutation = async (
    addressId: string,
    addressData: AddressFormData
  ): Promise<boolean> => {
    try {
      await updateAddress({
        id: addressId,
        address: addressData,
      });

      setSuccessMessage('Address updated successfully!');
      await checkProfile(); // Refresh the profile data
      return true;
    } catch (error) {
      setErrorMessage('Failed to update address');
      console.error('Error updating address:', error);
      return false;
    }
  };

  // Fetch profile then accounts so /me can create a wallet before accounts load.
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      let cancelled = false;
      void (async () => {
        await checkProfile();
        if (!cancelled) {
          await checkAccounts();
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    clearProfile();
  }, [isAuthenticated, isLoading, checkProfile, checkAccounts]);

  const value: UserProfileContextType = {
    profile,
    loading: loading || isLoading,
    error,
    userType,
    personas,
    delegations,
    activeContext,
    activeDelegation,
    isDelegationContext,
    needsPersonaSelection,
    needsContextSelection,
    setActivePersona,
    setActiveContext,
    isProfileComplete,
    successMessage,
    errorMessage,
    accounts,
    accountsLoading,
    accountsError,
    refetch: checkProfile,
    refetchAccounts: checkAccounts,
    clearProfile,
    updateBusinessAiTokens,
    updateProfile,
    updateProfilePicture,
    addAddress,
    updateAddress: updateAddressMutation,
    clearMessages,
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfileContext = (): UserProfileContextType => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error(
      'useUserProfileContext must be used within a UserProfileProvider'
    );
  }
  return context;
};
