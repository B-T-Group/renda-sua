import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import useClientProfile from "./useClientProfile";
import { gql } from "@apollo/client";

// Types pour les applications immobilières client
interface RealEstateApplication {
  id: number;
  type: string;
  status: string;
  dateCreated: string;
  dateModified?: string;
  client: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
  realEstateApplicationDetail?: {
    id: number;
    type: string;
    currency: string;
    purchaseDetails?: {
      budget: number;
      downPayment: number;
      financeRequired: boolean;
      estimatedMonthlyPayments?: number;
      type: string;
      plotListingId?: number;
      plotListing?: {
        id: number;
        name: string;
        price: number;
        currency: string;
        address?: {
          address: string;
          city: string;
          state: string;
          country: string;
        };
      };
    };
    constructionDetails?: {
      isLandOwner: boolean;
      landArea: number;
      projectEstimate: number;
      downPayment: number;
      financeRequired: boolean;
      estimatedMonthlyPayments?: number;
      existingMortgage: boolean;
    };
  };
}

const GET_CLIENT_REAL_ESTATE_APPLICATIONS = gql`
  query myProductApplications($filter: ProductApplicationFilter, $pagination: PaginationParams) {
    myProductApplications(filter: $filter, pagination: $pagination) {
      count
      products {
      id
      type
      applicationStatus
      dateCreated
      dateModified
      client {
        id
        firstName
        lastName
        email
      }
      realEstateApplicationDetail {
        id
        type
        currency
        purchaseDetails {
          budget
          downPayment
          financeRequired
          estimatedMonthlyPayments
          type
          plotListingId
          plotListing {
            id
            name
            price
            currency
            address {
              address
              city
              state
              country
            }
          }
        }
        constructionDetails {
          isLandOwner
          landArea
          projectEstimate
          downPayment
          financeRequired
          estimatedMonthlyPayments
          existingMortgage
        }
      }
      }
    }
  }
`;

const useClientRealEstate = () => {
  const [applications, setApplications] = useState<RealEstateApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const { client } = useClientProfile();

  const { refetch } = useQuery(GET_CLIENT_REAL_ESTATE_APPLICATIONS, {
    skip: true,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await refetch({ filter: { clientId: client?.id, type: 'Mortgage' }, pagination: { page: 1, pageSize: 50 } });
        const list = data.data?.myProductApplications?.products || [];
        const realEstateApps = list.map((app: any) => ({ ...app, status: app.applicationStatus }));
        setApplications(realEstateApps);
      } catch (e) {
        console.log(
          `An error occured while trying to load real estate applications`,
          e
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [client?.id]);

  return { loading, applications };
};

export default useClientRealEstate;


