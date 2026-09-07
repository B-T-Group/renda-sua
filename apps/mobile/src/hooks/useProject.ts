import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

// Interface complète alignée avec ProjectFieldsFragment du web
export interface ProjectDetails {
  id: number;
  agentId?: number;
  canEdit: boolean;
  categoryId?: number;
  liked: boolean;
  canApprove: boolean;
  canEvaluate: boolean;
  canAddTransaction: boolean;
  paidForEvaluation: boolean;
  investmentTypeId: number;
  clientId: number;
  externalId: string;
  ratingComments?: string;
  rating: number;
  name?: string;
  title: string;
  description?: string;
  category?: string;
  city?: string;
  country?: string;
  projectCost?: string;
  personalContribution?: string;
  currency: string;
  shareUnits: number;
  identifier?: string;
  projectStatus?: string;
  conversations?: any;
  businessPlan?: string;
  language: string;
  dateCreated: string;
  dateModified?: string;
  financeEligible: boolean;
  canOpenInvestmentWindow: boolean;
  likes: Array<{
    projectId: number;
  clientId: number;
  }>;
  agency?: {
    id: number;
    name: string;
    agent?: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    };
    address?: {
      address: string;
      state: string;
      city: string;
      country: string;
      postCode: string;
      appartmentNumber?: string;
    };
  };
  projectManager?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  activeServiceApplications: Array<{
    id: number;
    notes?: string;
    startDate: string;
    endDate?: string;
    status: string;
    recurrency: string;
    client: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    };
    service: {
    id: number;
    name: string;
      description?: string;
    };
    contract?: {
      id: number;
      status: string;
      startDate: string;
      endDate?: string;
    };
  }>;
  activeInvestmentWindow?: {
    id: number;
    target: number;
    currency: string;
    startDate?: string;
    endDate?: string;
    shareCapital: number;
    status: string;
    investments?: Array<{
      amount: number;
      currency: string;
    }>;
  };
  depositProjects: Array<{
    id: number;
    type: string;
    investmentDeposits: Array<{
      amount: number;
      currency: string;
      createdAt: string;
      investing?: boolean;
    }>;
  }>;
  financialInfo?: {
    id: number;
    projectId: number;
    isBusinessWithBank?: boolean;
    bankName?: string;
    hasOutstandingLoan?: boolean;
    loanAmount?: string;
  };
  operations?: {
    id: number;
    projectId: number;
    serviceOffering?: string;
    unitPrice?: string;
    hoursOfOperation?: string;
    projectedSalesYearOne?: string;
    projectedSalesYearTwo?: string;
    keySuppliers?: string;
    mainExpenses?: string;
    mainCustomers?: string;
    prospectDetails?: string;
  };
  projectCompany?: {
    id: number;
    projectId: number;
    name: string;
    creationDate?: string;
    type?: string;
    website?: string;
    hasBusinessPlan?: string;
    hasCoFounders?: boolean;
    numCoFounders?: number;
    hasEmployees?: boolean;
    numEmployees?: number;
  };
  client?: {
    id: number;
    uuid?: string;
    firstName: string;
    name: string;
    clientType: string;
    lastName: string;
    phoneNumber: string;
    secondaryPhoneNumber?: string;
    languagePreference: string;
    salutation: string;
    dob: string;
    nationality: string;
    gender: string;
    email: string;
    address?: {
      id: number;
      country: string;
      city: string;
      state: string;
      postCode: string;
      address: string;
      appartmentNumber?: string;
      phoneNumber?: string;
    };
  };
  agent?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
    dob?: string;
    nationality?: string;
    gender?: string;
  };
  financeApplication?: {
    id: number;
    agentId: number;
    projectId: number;
    status: string;
    applicationType: string;
    canProposeLoan: boolean;
    canProcess: boolean;
    country: string;
    state: string;
    createdOn: string;
    language: string;
    legalStatus: string;
    signedAt?: string;
    signedOn?: string;
    dateCreated: string;
    dateModified?: string;
    proposals: Array<{
      id: number;
      financeApplicationId: number;
      amount: number;
      currency: string;
      status: string;
      interestRate: number;
      paymentStartDate: string;
      monthlyPayments: number;
      lengthMonths: number;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  valuation?: {
    id: number;
    projectId: number;
    valuation: number;
    currency: string;
    sharePrice: number;
  };
  shareHolders: Array<{
    id: number;
    projectId: number;
    clientId: number;
    shares: number;
  }>;
}

// Requête complète alignée avec le web - ProjectFieldsFragment
// Inclut tous les champs du fragment pour parité complète avec le web
const GET_PROJECT = gql`
  query getProject($id: Int!) {
    getProject(id: $id) {
      id
      agentId
      canEdit
      categoryId
      liked
      canApprove
      canEvaluate
      canAddTransaction
      paidForEvaluation
      investmentTypeId
      clientId
      externalId
      ratingComments
      rating
      name
      title
      description
      category
      city
      country
      projectCost
      personalContribution
      currency
      shareUnits
      identifier
      projectStatus
      conversations
      businessPlan
      language
      dateCreated
      dateModified
      financeEligible
      canOpenInvestmentWindow
      likes {
        projectId
      clientId
      }
      agency {
        id
        name
        agent {
        id
        firstName
        lastName
        email
        }
        address {
          address
          state
          city
          country
          postCode
          appartmentNumber
        }
      }
      projectManager {
        firstName
        lastName
        email
      }
      activeServiceApplications {
        id
        notes
        startDate
        endDate
        status
        recurrency
        client {
          id
          firstName
          lastName
          email
        }
        service {
        id
        name
          description
        }
        contract {
          id
          status
          startDate
          endDate
        }
      }
      activeInvestmentWindow {
        id
        target
        currency
        startDate
        endDate
        shareCapital
        status
        investments {
          amount
          currency
        }
      }
      depositProjects {
        id
        type
        investmentDeposits {
          amount
          currency
          createdAt
          investing
        }
      }
      financialInfo {
        id
        projectId
        isBusinessWithBank
        bankName
        hasOutstandingLoan
        loanAmount
      }
      operations {
        id
        projectId
        serviceOffering
        unitPrice
        hoursOfOperation
        projectedSalesYearOne
        projectedSalesYearTwo
        keySuppliers
        mainExpenses
        mainCustomers
        prospectDetails
      }
      projectCompany {
        id
        projectId
        name
        creationDate
        type
        website
        hasBusinessPlan
        hasCoFounders
        numCoFounders
        hasEmployees
        numEmployees
      }
      client {
        id
        uuid
        firstName
        name
        clientType
        lastName
        phoneNumber
        secondaryPhoneNumber
        languagePreference
        salutation
        dob
        nationality
        gender
        email
        address {
          id
          country
          city
          state
          postCode
          address
          appartmentNumber
          phoneNumber
        }
      }
      agent {
        id
        firstName
        lastName
        email
        phoneNumber
        dob
        nationality
        gender
      }
      financeApplication {
        id
        agentId
        projectId
        status
        applicationType
        canProposeLoan
        canProcess
        country
        state
        createdOn
        language
        legalStatus
        signedAt
        signedOn
        dateCreated
        dateModified
        proposals {
          id
          financeApplicationId
          amount
          currency
          status
          interestRate
          paymentStartDate
          monthlyPayments
          lengthMonths
          createdAt
          updatedAt
        }
      }
      valuation {
        id
        projectId
        valuation
        currency
        sharePrice
      }
      shareHolders {
        id
        projectId
        clientId
        shares
      }
    }
  }
`;

const useProject = (projectId?: number) => {
  const [project, setProject] = useState<ProjectDetails | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { refetch } = useQuery(GET_PROJECT, { skip: true });

  useEffect(() => {
    (async () => {
      if (!projectId) {
        setProject(undefined);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const { data } = await refetch({ id: projectId });
        setProject(data?.getProject ?? undefined);
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, refetch]);

  return { loading, project, error, refetch };
};

export default useProject;




