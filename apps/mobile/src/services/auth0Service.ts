/**
 * Service Auth0 pour l'application mobile BT Groupe
 * Utilise expo-auth-session pour l'authentification
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '../config/auth0';

// Configuration Auth0
const AUTH0_DOMAIN = env.auth0Config.domain;
const AUTH0_CLIENT_ID = env.auth0Config.clientId;
const AUTH0_AUDIENCE = env.auth0Config.audience;

// Configuration de l'authentification
const discovery = {
  authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
  tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
  revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
};

// Types
export interface Auth0User {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface Auth0Tokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface Auth0Response {
  type: 'success' | 'error';
  user?: Auth0User;
  tokens?: Auth0Tokens;
  error?: string;
}

// Clés de stockage
const STORAGE_KEYS = {
  accessToken: '@BTGroupe:accessToken',
  refreshToken: '@BTGroupe:refreshToken',
  user: '@BTGroupe:user',
  expiresAt: '@BTGroupe:expiresAt',
};

/**
 * Service d'authentification Auth0
 */
export class Auth0Service {
  private static instance: Auth0Service;

  private constructor() {
    // Configuration WebBrowser pour Auth0
    WebBrowser.maybeCompleteAuthSession();
  }

  static getInstance(): Auth0Service {
    if (!Auth0Service.instance) {
      Auth0Service.instance = new Auth0Service();
    }
    return Auth0Service.instance;
  }

  /**
   * Connexion avec Auth0
   */
  async login(): Promise<Auth0Response> {
    try {
      // Générer le state et PKCE
      const state = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(),
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      // Générer un code verifier aléatoire (base64url compatible)
      const codeVerifier = await this.generateCodeVerifier();

      // Générer le code challenge (SHA256 du verifier, encodé en base64url)
      const codeChallenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        codeVerifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      // Convertir en base64url (remplacer + par -, / par _, et supprimer =)
      const codeChallengeUrl = codeChallenge.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      // Configuration de la requête d'autorisation
      const authRequest = new AuthSession.AuthRequest({
        clientId: AUTH0_CLIENT_ID,
        scopes: ['openid', 'profile', 'email', 'read:current_user', 'update:current_user_metadata'],
        redirectUri: AuthSession.makeRedirectUri({
          scheme: 'btgroupe',
          path: 'callback',
        }),
        responseType: AuthSession.ResponseType.Code,
        state,
        codeChallenge: codeChallengeUrl,
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        extraParams: {
          audience: AUTH0_AUDIENCE,
        },
      });

      // Lancer l'authentification
      const result = await authRequest.promptAsync(discovery);

      if (result.type === 'success') {
        // Échanger le code contre des tokens
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: AUTH0_CLIENT_ID,
            code: result.params.code,
            redirectUri: AuthSession.makeRedirectUri({
              scheme: 'btgroupe',
              path: 'callback',
            }),
            extraParams: {
              code_verifier: codeVerifier,
            },
          },
          discovery
        );

        // Récupérer les informations utilisateur
        const userInfo = await this.getUserInfo(tokenResult.accessToken);

        // Sauvegarder les tokens et informations utilisateur
        await this.saveTokens({
          access_token: tokenResult.accessToken,
          refresh_token: tokenResult.refreshToken,
          expires_in: tokenResult.expiresIn || 3600,
          token_type: tokenResult.tokenType,
          scope: tokenResult.scope || '',
        });

        await this.saveUser(userInfo);

        return {
          type: 'success',
          user: userInfo,
          tokens: {
            access_token: tokenResult.accessToken,
            refresh_token: tokenResult.refreshToken,
            expires_in: tokenResult.expiresIn || 3600,
            token_type: tokenResult.tokenType,
            scope: tokenResult.scope || '',
          },
        };
      } else {
        return {
          type: 'error',
          error: 'Authentification annulée',
        };
      }
    } catch (error) {
      console.error('Erreur lors de l\'authentification Auth0:', error);
      return {
        type: 'error',
        error: error instanceof Error ? error.message : 'Erreur d\'authentification',
      };
    }
  }

  /**
   * Récupérer les informations utilisateur depuis Auth0
   */
  private async getUserInfo(accessToken: string): Promise<Auth0User> {
    const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Impossible de récupérer les informations utilisateur');
    }

    return response.json();
  }

  /**
   * Rafraîchir le token d'accès
   */
  async refreshAccessToken(): Promise<Auth0Tokens | null> {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
      
      if (!refreshToken) {
        return null;
      }

      const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: AUTH0_CLIENT_ID,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Impossible de rafraîchir le token');
      }

      const tokens: Auth0Tokens = await response.json();
      
      // Sauvegarder les nouveaux tokens
      await this.saveTokens(tokens);

      return tokens;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      return null;
    }
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<void> {
    try {
      const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
      
      if (accessToken) {
        // Révoquer le token côté Auth0
        await fetch(`https://${AUTH0_DOMAIN}/oauth/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: AUTH0_CLIENT_ID,
            token: accessToken,
          }),
        });
      }

      // Supprimer les données locales
      await this.clearStoredData();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Supprimer les données locales même en cas d'erreur
      await this.clearStoredData();
    }
  }

  /**
   * Vérifier si l'utilisateur est connecté
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
      const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.expiresAt);
      
      if (!accessToken || !expiresAt) {
        return false;
      }

      // Vérifier si le token n'est pas expiré
      const expirationTime = parseInt(expiresAt, 10);
      if (Date.now() >= expirationTime) {
        // Token expiré, essayer de le rafraîchir
        const refreshedTokens = await this.refreshAccessToken();
        return !!refreshedTokens;
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'authentification:', error);
      return false;
    }
  }

  /**
   * Récupérer le token d'accès
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
      const expiresAt = await AsyncStorage.getItem(STORAGE_KEYS.expiresAt);
      
      if (!accessToken || !expiresAt) {
        return null;
      }

      // Vérifier si le token n'est pas expiré
      const expirationTime = parseInt(expiresAt, 10);
      if (Date.now() >= expirationTime) {
        // Token expiré, essayer de le rafraîchir
        const refreshedTokens = await this.refreshAccessToken();
        return refreshedTokens?.access_token || null;
      }

      return accessToken;
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return null;
    }
  }

  /**
   * Récupérer les informations utilisateur stockées
   */
  async getUser(): Promise<Auth0User | null> {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.user);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Erreur lors de la récupération des informations utilisateur:', error);
      return null;
    }
  }

  /**
   * Sauvegarder les tokens
   */
  private async saveTokens(tokens: Auth0Tokens): Promise<void> {
    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.accessToken, tokens.access_token),
      AsyncStorage.setItem(STORAGE_KEYS.expiresAt, expiresAt.toString()),
    ]);

    if (tokens.refresh_token) {
      await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refresh_token);
    }
  }

  /**
   * Sauvegarder les informations utilisateur
   */
  private async saveUser(user: Auth0User): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }

  /**
   * Supprimer toutes les données stockées
   */
  private async clearStoredData(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.accessToken),
      AsyncStorage.removeItem(STORAGE_KEYS.refreshToken),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
      AsyncStorage.removeItem(STORAGE_KEYS.expiresAt),
    ]);
  }

  /**
   * Générer un code verifier pour PKCE (compatible Auth0)
   */
  private async generateCodeVerifier(): Promise<string> {
    // Générer 32 bytes aléatoires avec expo-crypto
    const randomString = Math.random().toString(36) + Date.now().toString(36);
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      randomString,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    
    // Convertir en base64url (remplacer + par -, / par _, et supprimer =)
    return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}

export default Auth0Service.getInstance();


