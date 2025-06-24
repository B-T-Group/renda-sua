import { Injectable } from '@nestjs/common';
import { GraphQLClient } from 'graphql-request';

@Injectable()
export class HasuraSystemService {
  private readonly hasuraUrl: string;
  private readonly adminSecret: string;

  constructor() {
    this.hasuraUrl = process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql';
    this.adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET || 'myadminsecretkey';
  }

  /**
   * Creates a GraphQL client with admin secret for system operations
   */
  createClient(): GraphQLClient {
    return new GraphQLClient(this.hasuraUrl, {
      headers: {
        'x-hasura-admin-secret': this.adminSecret,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute a GraphQL query with admin privileges
   */
  async executeQuery<T = any>(query: string, variables?: any): Promise<T> {
    const client = this.createClient();
    return client.request<T>(query, variables);
  }

  /**
   * Execute a GraphQL mutation with admin privileges
   */
  async executeMutation<T = any>(mutation: string, variables?: any): Promise<T> {
    const client = this.createClient();
    return client.request<T>(mutation, variables);
  }

  /**
   * Get the Hasura endpoint URL
   */
  getHasuraUrl(): string {
    return this.hasuraUrl;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.hasuraUrl && this.adminSecret);
  }
} 