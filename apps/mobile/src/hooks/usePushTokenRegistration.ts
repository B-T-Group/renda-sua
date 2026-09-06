import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useStore } from '../stores/RootStore';
import { NotificationRegistrationService } from '../services/notificationRegistrationService';
import useUpdatePushToken from './useUpdatePushToken';
import { useApolloClient } from '@apollo/client';

/**
 * Enregistre le token Expo Push auprès du backend après login et au retour au
 * premier plan. `expo-notifications` est chargé paresseusement (jamais en Expo Go).
 */
const usePushTokenRegistration = () => {
  const { auth } = useStore();
  const { updatePushToken } = useUpdatePushToken();
  const apolloClient = useApolloClient();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const isRegistering = useRef<boolean>(false);

  // Fonction pour enregistrer le token push (réutilisable avec useCallback)
  const registerToken = useCallback(async (reason: string = 'triggered') => {
    // Éviter les appels multiples simultanés
    if (isRegistering.current) {
      console.log('⏭️ [usePushTokenRegistration] Enregistrement déjà en cours, abandon');
      return;
    }

    console.log(`🔔 [usePushTokenRegistration] registerToken appelé - Raison: ${reason}`);

    if (!auth.isAuthenticated || !auth.user) {
      console.log('⚠️ [usePushTokenRegistration] Utilisateur non authentifié, abandon');
      return;
    }

    console.log('✅ [usePushTokenRegistration] Utilisateur authentifié:', {
      userId: auth.user.id,
      email: auth.user.email || auth.user.phoneNumber || 'N/A',
    });

    isRegistering.current = true;

    try {
      // Enregistrer le token via le service d'enregistrement
      console.log('📱 [usePushTokenRegistration] Démarrage de l\'enregistrement du token...');
      const result = await NotificationRegistrationService.registerPushToken(updatePushToken, apolloClient);
      
      if (result && result.pushToken) {
        console.log('✅ [usePushTokenRegistration] Token push enregistré avec succès dans le backend');
        console.log('📋 [usePushTokenRegistration] Token enregistré:', result.pushToken.substring(0, 30) + '...');
      } else {
        console.log('⚠️ [usePushTokenRegistration] Token push non enregistré (résultat null)');
      }
    } catch (error) {
      // Ne pas bloquer l'utilisateur en cas d'erreur
      console.error('❌ [usePushTokenRegistration] ERREUR lors de l\'enregistrement du token:', error);
      if (error instanceof Error) {
        console.error('❌ [usePushTokenRegistration] Détails de l\'erreur:', {
          message: error.message,
          stack: error.stack,
        });
      }
    } finally {
      isRegistering.current = false;
    }
  }, [auth.isAuthenticated, auth.user, updatePushToken]);

  // Vérifier et enregistrer le token quand l'utilisateur est connecté
  useEffect(() => {
    console.log('🔔 [usePushTokenRegistration] Hook déclenché - Auth:', {
      isAuthenticated: auth.isAuthenticated,
      hasUser: !!auth.user,
      userId: auth.user?.id || 'N/A',
    });

    // Enregistrer le token quand l'utilisateur est connecté (y compris au démarrage si déjà connecté)
    if (auth.isAuthenticated && auth.user) {
      console.log('⏰ [usePushTokenRegistration] Planification de l\'enregistrement du token (délai 2s pour laisser l\'hydratation se terminer)...');
      // Délai plus long pour s'assurer que l'hydratation est complète
      const timer = setTimeout(() => {
        // Vérifier à nouveau que l'utilisateur est toujours connecté avant d'enregistrer
        if (auth.isAuthenticated && auth.user) {
          registerToken('utilisateur connecté');
        } else {
          console.log('⏭️ [usePushTokenRegistration] Utilisateur déconnecté pendant le délai, abandon');
        }
      }, 2000);

      return () => {
        console.log('🧹 [usePushTokenRegistration] Nettoyage du timer');
        clearTimeout(timer);
      };
    } else {
      console.log('⏭️ [usePushTokenRegistration] Utilisateur non authentifié, pas d\'enregistrement');
    }
  }, [auth.isAuthenticated, auth.user, updatePushToken, apolloClient, registerToken]);

  // Vérifier quand l'app revient au premier plan
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Si l'app revient au premier plan et que l'utilisateur est connecté, vérifier le token
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        auth.isAuthenticated &&
        auth.user
      ) {
        console.log('📱 [usePushTokenRegistration] App revient au premier plan, vérification du token...');
        // Petit délai pour s'assurer que l'app est complètement active
        setTimeout(() => {
          registerToken('app au premier plan');
        }, 500);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [auth.isAuthenticated, auth.user, registerToken]);

  // Réinitialiser lors de la déconnexion
  useEffect(() => {
    if (!auth.isAuthenticated) {
      console.log('🚪 [usePushTokenRegistration] Utilisateur déconnecté, réinitialisation...');
      NotificationRegistrationService.reset();
      isRegistering.current = false;
    }
  }, [auth.isAuthenticated]);
};

export default usePushTokenRegistration;

