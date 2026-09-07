import { gql, useMutation } from '@apollo/client';

export interface SubmitProjectReserveInput {
  agencyId: number;
  projectReserve: {
    accountType: string; // e.g., "Individual" | "Company"
    projectHorizon: number; // e.g., 1 | 2 | 3
    projectType: string; // e.g., "RealEstate" | "Business"
    projectTypeId?: number;
    delegateAuthority?: {
      isCorporation?: boolean;
      companyName?: string;
      positionHeld?: string;
      name?: string;
      country?: string;
      city?: string;
      phoneNumber?: string;
    };
  };
}

const SUBMIT_PROJECT_RESERVE = gql`
  mutation submitProjectReserve($input: SubmitProjectReserveInput!, $complete: Boolean) {
    submitProjectReserve(input: $input, complete: $complete) {
      id
      productApplicationId
    }
  }
`;

export const useSubmitProjectReserve = () => {
  const [mutate, { loading, error }] = useMutation<
    { submitProjectReserve: { id: number; productApplicationId: number } },
    { input: SubmitProjectReserveInput; complete?: boolean }
  >(SUBMIT_PROJECT_RESERVE);

  const submit = async (input: SubmitProjectReserveInput, complete = true) => {
    const { data } = await mutate({ variables: { input, complete } });
    return data?.submitProjectReserve;
  };

  return { submit, loading, error };
};

export default useSubmitProjectReserve;







