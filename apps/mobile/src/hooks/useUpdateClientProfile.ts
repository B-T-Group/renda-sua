import { useCallback, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { MeUser, SetMyPhoneResponse } from '../types/me';

export interface UpdateProfilePhoneInput {
  phoneNumber: string;
}

/**
 * Updates the signed-in user's profile phone via Nest `POST /users/me/phone`.
 */
export function useUpdateClientProfile() {
  const [loading, setLoading] = useState(false);

  const updateClientProfile = useCallback(async (input: UpdateProfilePhoneInput): Promise<MeUser | undefined> => {
    const phone = input.phoneNumber?.trim();
    if (!phone) {
      throw new Error('Phone number is required');
    }
    setLoading(true);
    try {
      const res: SetMyPhoneResponse = await agentApi.users.setMyPhone({ phoneNumber: phone });
      if (!res.success || !res.user) {
        throw new Error(res.error ?? 'Could not update phone number');
      }
      return res.user as MeUser;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateClientProfile, loading };
}

export default useUpdateClientProfile;
