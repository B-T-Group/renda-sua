import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

export interface UserRecord {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ClientRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  license_number: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessRecord {
  id: string;
  user_id: string;
  name: string;
  business_type: string;
  registration_number: string;
  created_at: string;
  updated_at: string;
}

@Injectable({ scope: Scope.REQUEST })
export class HasuraUserService {
  public identifier: string;
  private readonly hasuraUrl: string;
  private readonly authToken: string;

  constructor(@Inject(REQUEST) private readonly request: any) {
    this.hasuraUrl = process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql';
    this.authToken = this.extractAuthToken();
    this.identifier = this.extractSubClaim();
  }

  /**
   * Creates a GraphQL client with user's auth token
   */
  createGraphQLClient(): any {
    const { GraphQLClient } = require('graphql-request');
    return new GraphQLClient(this.hasuraUrl, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Execute a GraphQL query with user privileges
   */
  async executeQuery(query: string, variables?: any): Promise<any> {
    const client = this.createGraphQLClient();
    return client.request(query, variables);
  }

  /**
   * Execute a GraphQL mutation with user privileges
   */
  async executeMutation(mutation: string, variables?: any): Promise<any> {
    const client = this.createGraphQLClient();
    return client.request(mutation, variables);
  }

  /**
   * Create a new user record
   */
  async createUser(userData: { email: string; name?: string }): Promise<UserRecord> {
    const mutation = `
      mutation CreateUser($email: String!, $name: String) {
        insert_users_one(object: {
          email: $email,
          name: $name
        }) {
          id
          email
          created_at
          updated_at
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      email: userData.email,
      name: userData.name,
    });

    return result.insert_users_one;
  }

  /**
   * Create a new client record
   */
  async createClientRecord(clientData: { name: string; user_id: string }): Promise<ClientRecord> {
    const mutation = `
      mutation CreateClient($name: String!, $user_id: String!) {
        insert_clients_one(object: {
          name: $name,
          user_id: $user_id
        }) {
          id
          user_id
          name
          created_at
          updated_at
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      name: clientData.name,
      user_id: clientData.user_id,
    });

    return result.insert_clients_one;
  }

  /**
   * Create a new agent record
   */
  async createAgentRecord(agentData: { name: string; user_id: string; license_number: string }): Promise<AgentRecord> {
    const mutation = `
      mutation CreateAgent($name: String!, $user_id: String!, $license_number: String!) {
        insert_agents_one(object: {
          name: $name,
          user_id: $user_id,
          license_number: $license_number
        }) {
          id
          user_id
          name
          license_number
          created_at
          updated_at
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      name: agentData.name,
      user_id: agentData.user_id,
      license_number: agentData.license_number,
    });

    return result.insert_agents_one;
  }

  /**
   * Create a new business record
   */
  async createBusinessRecord(businessData: { 
    name: string; 
    user_id: string; 
    business_type: string; 
    registration_number: string 
  }): Promise<BusinessRecord> {
    const mutation = `
      mutation CreateBusiness($name: String!, $user_id: String!, $business_type: String!, $registration_number: String!) {
        insert_businesses_one(object: {
          name: $name,
          user_id: $user_id,
          business_type: $business_type,
          registration_number: $registration_number
        }) {
          id
          user_id
          name
          business_type
          registration_number
          created_at
          updated_at
        }
      }
    `;

    const result = await this.executeMutation(mutation, {
      name: businessData.name,
      user_id: businessData.user_id,
      business_type: businessData.business_type,
      registration_number: businessData.registration_number,
    });

    return result.insert_businesses_one;
  }

  /**
   * Extract auth token from request headers
   */
  private extractAuthToken(): string {
    const authHeader = this.request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid or missing authorization header');
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Extract sub claim from JWT token
   */
  private extractSubClaim(): string {
    try {
      // This is a simplified JWT decode - in production, you should use a proper JWT library
      const token = this.authToken;
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.user_id || payload.id;
    } catch (error) {
      throw new Error('Invalid JWT token or missing sub claim');
    }
  }

  /**
   * Get the user identifier (sub claim)
   */
  getIdentifier(): string {
    return this.identifier;
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.hasuraUrl && this.authToken && this.identifier);
  }
} 