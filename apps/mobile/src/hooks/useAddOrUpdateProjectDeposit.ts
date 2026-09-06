import { gql, useMutation } from '@apollo/client';

export interface AddOrUpdateProjectDepositInput {
  clientId: number;
  productApplicationId?: number;
  agentReferralCode?: string;
  duration?: number;
  amount?: number;
  currency?: string;
  accountType: string; // GraphQL enum InvestmentAccountType, e.g., "Individual"
  delegateAuthority?: {
    isCorporation?: boolean;
    companyName?: string;
    positionHeld?: string;
    name?: string;
    country?: string;
    city?: string;
    phoneNumber?: string;
  };
  financialKnowledge?: any;
  projectDetails?: { projectId: number };
  // Aligné sur ProjectDepositFundInput (fundId, percentage)
  funds: Array<{ fundId: number; percentage: number }>;
}

const ADD_OR_UPDATE_PROJECT_DEPOSIT = gql`
  mutation addOrUpdateProjectDeposit($input: AddOrUpdateProjectDepositInput!) {
    addOrUpdateProjectDeposit(input: $input) { id }
  }
`;

export const useAddOrUpdateProjectDeposit = () => {
  const [mutate, { loading, error }] = useMutation<
    { addOrUpdateProjectDeposit: { id: number } },
    { input: AddOrUpdateProjectDepositInput }
  >(ADD_OR_UPDATE_PROJECT_DEPOSIT);

  const submit = async (input: AddOrUpdateProjectDepositInput) => {
    const { data } = await mutate({ variables: { input } });
    return data?.addOrUpdateProjectDeposit;
  };

  return { submit, loading, error };
};

export default useAddOrUpdateProjectDeposit;




