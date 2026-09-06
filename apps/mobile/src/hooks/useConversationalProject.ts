import { gql, useMutation } from '@apollo/client';
import { useState } from 'react';

export interface ConversationMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface ProjectConversationResponse {
  project: {
    id: number;
    name?: string;
    projectStatus?: string;
    currency?: string;
    investmentTypeId?: number;
    clientId?: number;
    agentId?: number;
    title?: string;
    description?: string;
    category?: string;
    country?: string;
    city?: string;
    projectCost?: string;
    personalContribution?: string;
    operations?: {
      id?: number;
      serviceOffering?: string;
      unitPrice?: string;
      projectedSalesYearOne?: string;
      projectedSalesYearTwo?: string;
      mainExpenses?: string;
      hoursOfOperation?: string;
      keySuppliers?: string;
      mainCustomers?: string;
      prospectDetails?: string;
    };
    financialInfo?: {
      id?: number;
      isBusinessWithBank?: boolean;
      bankName?: string;
      hasOutstandingLoan?: boolean;
      loanAmount?: string;
    };
  };
  nextQuestion?: string;
  isComplete: boolean;
  extractedData?: any;
  conversationHistory?: ConversationMessage[];
}

export interface UseConversationalProjectReturn {
  createProject: (
    name: string,
    country: string,
    city: string,
    language?: string
  ) => Promise<ProjectConversationResponse | null>;
  continueConversation: (
    projectId: number,
    answer: string
  ) => Promise<ProjectConversationResponse | null>;
  loading: boolean;
  error: Error | null;
}

const CREATE_PROJECT_CONVERSATION = gql`
  mutation CreateProjectConversation($input: CreateProjectConversationInput!) {
    createProjectConversation(input: $input) {
      project {
        id
        name
        projectStatus
        currency
        investmentTypeId
        clientId
        agentId
        title
        description
        category
        country
        city
        projectCost
        personalContribution
        operations {
          id
          serviceOffering
          unitPrice
          projectedSalesYearOne
          projectedSalesYearTwo
          mainExpenses
          hoursOfOperation
          keySuppliers
          mainCustomers
          prospectDetails
        }
        financialInfo {
          id
          isBusinessWithBank
          bankName
          hasOutstandingLoan
          loanAmount
        }
      }
      nextQuestion
      isComplete
      extractedData
      conversationHistory {
        role
        content
        timestamp
      }
    }
  }
`;

const CONTINUE_PROJECT_CONVERSATION = gql`
  mutation ContinueProjectConversation(
    $input: ContinueProjectConversationInput!
  ) {
    continueProjectConversation(input: $input) {
      project {
        id
        name
        projectStatus
        currency
        investmentTypeId
        clientId
        agentId
        title
        description
        category
        country
        city
        projectCost
        personalContribution
        operations {
          id
          serviceOffering
          unitPrice
          projectedSalesYearOne
          projectedSalesYearTwo
          mainExpenses
          hoursOfOperation
          keySuppliers
          mainCustomers
          prospectDetails
        }
        financialInfo {
          id
          isBusinessWithBank
          bankName
          hasOutstandingLoan
          loanAmount
        }
      }
      nextQuestion
      isComplete
      extractedData
      conversationHistory {
        role
        content
        timestamp
      }
    }
  }
`;

export const useConversationalProject = (): UseConversationalProjectReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [createProjectConversation] = useMutation(CREATE_PROJECT_CONVERSATION);
  const [continueProjectConversation] = useMutation(CONTINUE_PROJECT_CONVERSATION);

  const createProject = async (
    name: string,
    country: string,
    city: string,
    language?: string
  ): Promise<ProjectConversationResponse | null> => {
    try {
      setLoading(true);
      setError(null);

      const result = await createProjectConversation({
        variables: {
          input: {
            name,
            country,
            city,
            language: language || 'en',
          },
        },
      });

      if (result.data?.createProjectConversation) {
        return result.data.createProjectConversation;
      }

      return null;
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Failed to create project conversation');
      setError(error);
      console.error('Error creating project conversation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const continueConversation = async (
    projectId: number,
    answer: string
  ): Promise<ProjectConversationResponse | null> => {
    try {
      setLoading(true);
      setError(null);

      const result = await continueProjectConversation({
        variables: {
          input: {
            projectId,
            answer,
          },
        },
      });

      if (result.data?.continueProjectConversation) {
        return result.data.continueProjectConversation;
      }

      return null;
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error('Failed to continue conversation');
      setError(error);
      console.error('Error continuing conversation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    createProject,
    continueConversation,
    loading,
    error,
  };
};

export default useConversationalProject;


