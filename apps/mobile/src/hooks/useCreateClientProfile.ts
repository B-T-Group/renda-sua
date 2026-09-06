import { useMutation } from "@apollo/client";
import { gql } from "@apollo/client";

interface CreateClientProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  nationality?: string;
  dob?: string;
}

interface CreateClientProfileResponse {
  createClientProfile: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    nationality?: string;
    dob?: string;
  };
}

const CREATE_CLIENT_PROFILE = gql`
  mutation createClientProfile($input: CreateClientProfileInput!) {
    createClientProfile(input: $input) {
      id
      firstName
      lastName
      email
      phoneNumber
      nationality
      dob
    }
  }
`;

const useCreateClientProfile = () => {
  const [createProfile, { loading, error }] = useMutation<
    CreateClientProfileResponse,
    { input: CreateClientProfileInput }
  >(CREATE_CLIENT_PROFILE);

  const createClientProfile = async (input: CreateClientProfileInput) => {
    try {
      console.log('📝 [useCreateClientProfile] Création du profil backend:', input);
      
      const result = await createProfile({
        variables: { input },
      });
      
      console.log('✅ [useCreateClientProfile] Profil créé avec succès:', result.data?.createClientProfile);
      return result.data?.createClientProfile;
    } catch (err) {
      console.error("❌ [useCreateClientProfile] Erreur lors de la création du profil:", err);
      throw err;
    }
  };

  return {
    createClientProfile,
    loading,
    error,
  };
};

export default useCreateClientProfile;



