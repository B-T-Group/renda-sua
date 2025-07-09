import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

export interface SecretValue {
  [key: string]: string | number | boolean;
}

@Injectable()
export class AwsSecretsManagerService {
  private readonly logger = new Logger(AwsSecretsManagerService.name);
  private secretsManagerClient: SecretsManagerClient;
  private cache: Map<string, { value: SecretValue; expiresAt: number }> =
    new Map();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    this.secretsManagerClient = new SecretsManagerClient({
      region: awsConfig?.region || 'ca-central-1',
      credentials: {
        accessKeyId: awsConfig?.accessKeyId || '',
        secretAccessKey: awsConfig?.secretAccessKey || '',
      },
    });
  }

  /**
   * Get a secret value from AWS Secrets Manager
   * @param secretName The name of the secret
   * @param forceRefresh Force refresh the cache
   * @returns Promise<SecretValue> The secret value as a key-value object
   */
  async getSecret(
    secretName: string,
    forceRefresh: boolean = false
  ): Promise<SecretValue> {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = this.cache.get(secretName);
        if (cached && cached.expiresAt > Date.now()) {
          this.logger.debug(`Returning cached secret for: ${secretName}`);
          return cached.value;
        }
      }

      this.logger.debug(
        `Fetching secret from AWS Secrets Manager: ${secretName}`
      );

      const command = new GetSecretValueCommand({
        SecretId: secretName,
      });

      const response = await this.secretsManagerClient.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} has no string value`);
      }

      // Parse the secret string as JSON
      const secretValue: SecretValue = JSON.parse(response.SecretString);

      // Cache the result
      this.cache.set(secretName, {
        value: secretValue,
        expiresAt: Date.now() + this.cacheExpiryMs,
      });

      this.logger.debug(`Successfully retrieved secret: ${secretName}`);
      return secretValue;
    } catch (error: any) {
      this.logger.error(`Failed to get secret ${secretName}: ${error.message}`);
      throw new Error(`Failed to get secret ${secretName}: ${error.message}`);
    }
  }

  /**
   * Get a specific key from a secret
   * @param secretName The name of the secret
   * @param key The specific key to retrieve
   * @param defaultValue Default value if key doesn't exist
   * @returns Promise<string | undefined> The value of the specific key
   */
  async getSecretKey(
    secretName: string,
    key: string,
    defaultValue?: string
  ): Promise<string | undefined> {
    try {
      const secret = await this.getSecret(secretName);
      return (secret[key] as string) || defaultValue;
    } catch (error: any) {
      this.logger.warn(
        `Failed to get secret key ${key} from ${secretName}: ${error.message}`
      );
      return defaultValue;
    }
  }

  /**
   * Get multiple secrets and merge them into a single object
   * @param secretNames Array of secret names to retrieve
   * @returns Promise<SecretValue> Merged secret values
   */
  async getMultipleSecrets(secretNames: string[]): Promise<SecretValue> {
    const mergedSecrets: SecretValue = {};

    for (const secretName of secretNames) {
      try {
        const secret = await this.getSecret(secretName);
        Object.assign(mergedSecrets, secret);
      } catch (error: any) {
        this.logger.warn(
          `Failed to get secret ${secretName}: ${error.message}`
        );
      }
    }

    return mergedSecrets;
  }

  /**
   * Clear the cache for a specific secret or all secrets
   * @param secretName Optional secret name to clear, if not provided clears all
   */
  clearCache(secretName?: string): void {
    if (secretName) {
      this.cache.delete(secretName);
      this.logger.debug(`Cleared cache for secret: ${secretName}`);
    } else {
      this.cache.clear();
      this.logger.debug('Cleared all secret cache');
    }
  }

  /**
   * Get cache statistics
   * @returns Object with cache information
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  /**
   * Test the connection to AWS Secrets Manager
   * @returns Promise<boolean> True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to list secrets (this is a lightweight operation)
      const command = new GetSecretValueCommand({
        SecretId: 'test-connection',
      });

      // This will fail with a specific error if the connection works but secret doesn't exist
      await this.secretsManagerClient.send(command);
      return true;
    } catch (error: any) {
      // If it's a ResourceNotFoundException, the connection works but secret doesn't exist
      if (error.name === 'ResourceNotFoundException') {
        return true;
      }

      this.logger.error(
        `AWS Secrets Manager connection test failed: ${error.message}`
      );
      return false;
    }
  }
}
