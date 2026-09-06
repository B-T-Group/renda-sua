import { gql, useMutation } from '@apollo/client';

const WITHDRAW_INVESTMENT = gql`
  mutation withdrawInvestment($id: Int!, $amount: Float, $excludeFees: Boolean) {
    withdrawInvestment(id: $id, amount: $amount, excludeFees: $excludeFees)
  }
`;

interface WithdrawVariables {
  id: number;
  amount?: number;
  excludeFees?: boolean;
}

export const useWithdrawInvestment = () => {
  const [mutate, { loading, error }] = useMutation<{ withdrawInvestment: boolean }, WithdrawVariables>(WITHDRAW_INVESTMENT);

  const withdraw = async (id: number, amount?: number, excludeFees: boolean = false): Promise<boolean> => {
    const { data } = await mutate({ variables: { id, amount, excludeFees } });
    return !!data?.withdrawInvestment;
  };

  return { withdraw, loading, error };
};

export default useWithdrawInvestment;







