import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';

/**
 * Mutation GraphQL pour tester les notifications push
 * 
 * Mutation fournie par le backend:
 * mutation {
 *   testNotification
 * }
 */

interface TestNotificationResponse {
  testNotification: boolean;
}

const TEST_NOTIFICATION = gql`
  mutation TestNotification {
    testNotification
  }
`;

/**
 * Hook React pour tester les notifications via la mutation GraphQL
 * @returns Fonction pour tester les notifications et état de chargement/erreur
 */
const useTestNotification = () => {
  const [mutate, { loading, error }] = useMutation<TestNotificationResponse>(TEST_NOTIFICATION);

  const testNotification = async (): Promise<boolean> => {
    try {
      const result = await mutate();
      return result.data?.testNotification ?? false;
    } catch (err) {
      throw err;
    }
  };

  return {
    testNotification,
    loading,
    error,
  };
};

export default useTestNotification;

