import { useQuery } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { ProjectDepositInvestment, InvestmentDividend } from "../types/ClientTypes";

// Query cible alignée sur la référence Web (voir todo.md Étape 0)
const GET_CLIENT_INVESTMENTS = gql`
  query clientInvestments {
    clientProfile {
      investments {
        id
        productApplicationId
        deposit
        amount
        fees
        currency
        investing
        withdrawn
        canWithdraw
        withdrawalFee
        investedAmount
        investedCurrency
        investmentDatetime
        maturityDatetime
        dividends {
          id
          amount
          currency
          createdAt
          interestRate
        }
      }
    }
  }
`;

const mapDividends = (input: any[]): InvestmentDividend[] => {
  if (!Array.isArray(input)) return [];
  return input.map((d) => ({
    id: d.id,
    amount: d.amount,
    currency: d.currency,
    // Normalisation: createdAt → date (conforme aux types mobiles actuels)
    date: d.createdAt,
    description: d.description,
  }));
};

const mapInvestment = (raw: any): ProjectDepositInvestment => {
  const investedAmount = raw.investedAmount ?? raw.amount ?? 0;
  return {
    id: raw.id,
    productApplicationId: raw.productApplicationId,
    amount: raw.amount,
    deposit: raw.deposit,
    fees: raw.fees,
    currency: raw.currency,
    withdrawn: !!raw.withdrawn,
    investing: !!raw.investing,
    canWithdraw: !!raw.canWithdraw,
    withdrawalFee: raw.withdrawalFee ?? 0,
    investedAmount,
    investedCurrency: raw.investedCurrency ?? raw.currency,
    investmentDatetime: raw.investmentDatetime,
    maturityDatetime: raw.maturityDatetime,
    dividends: mapDividends(raw.dividends),
    createdAt: raw.investmentDatetime,
    updatedAt: raw.investmentDatetime,
  } as ProjectDepositInvestment;
};

const useClientInvestments = () => {
  const [investments, setInvestments] = useState<ProjectDepositInvestment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_CLIENT_INVESTMENTS, {
    skip: true,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({});
        const list = data?.clientProfile?.investments ?? [];
        setInvestments(list.map(mapInvestment));
      } catch (e: any) {
        console.error("Failed to load client investments", e);
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refetch]);

  const hasData = useMemo(() => investments.length > 0, [investments]);

  return { loading, investments, error, hasData, refetch };
};

export default useClientInvestments;
