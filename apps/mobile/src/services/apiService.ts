import Auth0DirectService from './auth0DirectService';

/**
 * Service API avec gestion automatique des erreurs 401
 */
export class ApiService {
  private static instance: ApiService;
  private baseUrl: string;

  private constructor() {
    // URL de base pour les API REST (pas GraphQL)
    this.baseUrl = 'https://oksbfmgba4.execute-api.ca-central-1.amazonaws.com/dev';
  }

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Récupère le token d'authentification
   */
  private async getAuthToken(): Promise<string | null> {
    const token = Auth0DirectService.getAccessToken();
    if (!token) {
      console.log('❌ Aucun token d\'accès disponible');
      return null;
    }

    // Vérifier si le token est valide
    if (!(Auth0DirectService as any).isTokenValid()) {
      // console.log('🔄 Token expiré, tentative de rafraîchissement...');
      const refreshed = await Auth0DirectService.refreshAccessToken();
      if (!refreshed) {
        return null;
      }
      return Auth0DirectService.getAccessToken();
    }

    return token;
  }

  /**
   * Effectue une requête API avec gestion automatique de l'authentification
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      // Récupérer le token d'authentification
      const token = await this.getAuthToken();
      
      // Préparer les headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Ajouter le token d'authentification si disponible
      if (token) {
        (headers as any)['Authorization'] = `Bearer ${token}`;
      }

      // Effectuer la requête
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`Erreur API ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erreur requête API:', error);
      throw error;
    }
  }

  /**
   * Requête GET
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = params 
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;
    
    return this.request<T>(url, { method: 'GET' });
  }

  /**
   * Requête POST
   */
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Requête PUT
   */
  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Requête DELETE
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Instance singleton
export default ApiService.getInstance();


