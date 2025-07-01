import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLClient } from 'graphql-request';

@Injectable()
export class HasuraSystemService {
  private readonly hasuraUrl: string;
  private readonly adminSecret: string;
  private readonly client: GraphQLClient;

  constructor(private readonly configService: ConfigService) {
    console.log('configService', this.configService.get('hasura'));

    this.hasuraUrl =
      this.configService.get<string>('hasura.endpoint') ||
      'http://localhost:8080/v1/graphql';
    this.adminSecret =
      this.configService.get<string>('hasura.adminSecret') ||
      'myadminsecretkey';

    console.log('configService:headers', {
      'x-hasura-admin-secret': this.adminSecret,
      'Content-Type': 'application/json',
    });

    this.client = new GraphQLClient(this.hasuraUrl, {
      headers: {
        'x-hasura-admin-secret': this.adminSecret,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Creates a GraphQL client with admin secret for system operations
   */
  createClient(): any {
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
  async executeQuery(query: string, variables?: any): Promise<any> {
    return this.client.request(query, variables);
  }

  /**
   * Execute a GraphQL mutation with admin privileges
   */
  async executeMutation(mutation: string, variables?: any): Promise<any> {
    return this.client.request(mutation, variables);
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
