import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';

/**
 * Mutation GraphQL pour enregistrer le token push dans le backend
 * 
 * Mutation fournie par le backend:
 * mutation UpdatePushToken($pushToken: String!) {
 *   updatePushToken(pushToken: $pushToken) {
 *     id
 *     pushToken
 *   }
 * }
 */

interface UpdatePushTokenResponse {
  updatePushToken: {
    id: number;
    pushToken: string;
  };
}

interface UpdatePushTokenVariables {
  pushToken: string;
}

const UPDATE_PUSH_TOKEN = gql`
  mutation UpdatePushToken($pushToken: String!) {
    updatePushToken(pushToken: $pushToken) {
      id
      pushToken
    }
  }
`;

/**
 * Hook React pour enregistrer le token push via la mutation GraphQL
 * @returns Fonction pour enregistrer le token et état de chargement/erreur
 */
const useUpdatePushToken = () => {
  const [mutate, { loading, error }] = useMutation<
    UpdatePushTokenResponse,
    UpdatePushTokenVariables
  >(UPDATE_PUSH_TOKEN);

  const updatePushToken = async (pushToken: string): Promise<{ id: number; pushToken: string } | null> => {
    try {
      console.log('📱 [useUpdatePushToken] ===== DÉBUT mutation GraphQL =====');
      console.log('📋 [useUpdatePushToken] Token à envoyer:', pushToken.substring(0, 30) + '...');
      console.log('📋 [useUpdatePushToken] Variables:', { pushToken: pushToken.substring(0, 30) + '...' });

      const result = await mutate({
        variables: { pushToken },
      });

      console.log('📥 [useUpdatePushToken] Réponse GraphQL reçue');
      console.log('📋 [useUpdatePushToken] Réponse complète:', JSON.stringify(result, null, 2));
      console.log('📋 [useUpdatePushToken] Data:', result.data ? '✅ Présente' : '❌ Absente');
      
      if (result.data?.updatePushToken) {
        console.log('📋 [useUpdatePushToken] Détails du token enregistré:', {
          id: result.data.updatePushToken.id,
          pushToken: result.data.updatePushToken.pushToken.substring(0, 30) + '...',
          tokenComplet: result.data.updatePushToken.pushToken,
        });
        console.log('✅ [useUpdatePushToken] ===== SUCCÈS: Token enregistré via GraphQL =====');
        console.log('📋 [useUpdatePushToken] Réponse backend:', JSON.stringify(result.data.updatePushToken, null, 2));
      } else {
        console.log('⚠️ [useUpdatePushToken] Réponse GraphQL vide ou sans updatePushToken');
        console.log('📋 [useUpdatePushToken] Structure de la réponse:', JSON.stringify(result, null, 2));
      }

      return result.data?.updatePushToken || null;
    } catch (err) {
      console.error('❌ [useUpdatePushToken] ===== ERREUR mutation GraphQL =====');
      console.error('❌ [useUpdatePushToken] Type d\'erreur:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('❌ [useUpdatePushToken] Message:', err instanceof Error ? err.message : String(err));
      
      if (err instanceof Error && err.stack) {
        console.error('❌ [useUpdatePushToken] Stack trace:', err.stack);
      }
      
      // Détails GraphQL
      if ((err as any)?.graphQLErrors) {
        console.error('❌ [useUpdatePushToken] Erreurs GraphQL:', JSON.stringify((err as any).graphQLErrors, null, 2));
      }
      if ((err as any)?.networkError) {
        console.error('❌ [useUpdatePushToken] Erreur réseau:', {
          message: (err as any).networkError.message,
          statusCode: (err as any).networkError.statusCode,
          result: (err as any).networkError.result,
        });
      }
      
      throw err;
    }
  };

  return {
    updatePushToken,
    loading,
    error,
  };
};

export default useUpdatePushToken;

