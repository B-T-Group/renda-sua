import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { apiConfig } from '../config/api.config';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export class HasuraClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: apiConfig.hasura.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          console.error('Unauthorized access to Hasura');
        }
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    // This will be set by the Auth0 context
    return localStorage.getItem('auth0_token');
  }

  // Execute GraphQL query
  async query<T = any>(request: GraphQLRequest): Promise<GraphQLResponse<T>> {
    try {
      const response = await this.client.post<GraphQLResponse<T>>('', request);
      return response.data;
    } catch (error: any) {
      console.error('GraphQL query error:', error);
      throw error;
    }
  }

  // Execute GraphQL mutation
  async mutate<T = any>(request: GraphQLRequest): Promise<GraphQLResponse<T>> {
    try {
      const response = await this.client.post<GraphQLResponse<T>>('', request);
      return response.data;
    } catch (error: any) {
      console.error('GraphQL mutation error:', error);
      throw error;
    }
  }

  // Specific Hasura queries
  async getUsers() {
    const query = `
      query GetUsers {
        users {
          id
          identifier
          email
          first_name
          last_name
          user_type_id
          created_at
          updated_at
        }
      }
    `;
    return this.query({ query });
  }

  async getUserByIdentifier(identifier: string) {
    const query = `
      query GetUserByIdentifier($identifier: String!) {
        users(where: {identifier: {_eq: $identifier}}) {
          id
          identifier
          email
          first_name
          last_name
          user_type_id
          created_at
          updated_at
        }
      }
    `;
    return this.query({ query, variables: { identifier } });
  }

  async getUserTypes() {
    const query = `
      query GetUserTypes {
        user_types {
          id
          comment
        }
      }
    `;
    return this.query({ query });
  }

  async getVehicleTypes() {
    const query = `
      query GetVehicleTypes {
        vehicle_types {
          id
          comment
        }
      }
    `;
    return this.query({ query });
  }
}

export const hasuraClient = new HasuraClient(); 