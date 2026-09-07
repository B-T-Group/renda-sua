import { useQuery, DocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";

// Types pour le profil client
interface ClientProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  uuid?: string;
  name?: string;
  clientType?: string;
  secondaryPhoneNumber?: string;
  languagePreference?: string;
  salutation?: string;
  dob?: string;
  nationality?: string;
  gender?: string;
  agentId?: number;
  pushToken?: string;
  productsAndServices?: Array<{
    id: number;
    description?: string;
    type?: string;
    createdAt?: string;
    country?: string;
    status?: string;
  }>;
}

const GET_CLIENT_PROFILE = gql`
  query clientProfile {
    clientProfile {
      id
      uuid
      firstName
      lastName
      name
      clientType
      phoneNumber
      secondaryPhoneNumber
      languagePreference
      salutation
      dob
      nationality
      gender
      email
      agentId
      pushToken
      productsAndServices {
        id
        description
        type
        createdAt
        country
        status
      }
    }
  }
`;

const useClientProfile = (customQuery?: DocumentNode) => {
  const query = customQuery || GET_CLIENT_PROFILE;
  const { data, loading, error, refetch } = useQuery<{ clientProfile: ClientProfile }>(query);

  return { 
    data,
    loading, 
    client: data?.clientProfile || null,
    error,
    refetch 
  };
};

export default useClientProfile;
