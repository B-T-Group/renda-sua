import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { apiConfig } from '../config/api.config';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: apiConfig.backend.baseURL,
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
          console.error('Unauthorized access');
        }
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    // This will be set by the Auth0 context
    return localStorage.getItem('auth0_token');
  }

  // Generic request methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  // Specific API methods
  async getUserTypes() {
    return this.get('/user_types');
  }

  async getVehicleTypes() {
    return this.get('/vehicle_types');
  }

  async getCurrentUser() {
    return this.get('/users/me');
  }

  async createUser(userData: any) {
    return this.post('/users', userData);
  }
}

export const apiClient = new ApiClient(); 