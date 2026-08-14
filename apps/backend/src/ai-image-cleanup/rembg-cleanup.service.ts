import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { Configuration } from '../config/configuration';

export interface RembgCleanupInput {
  imageBase64: string;
  format: 'jpeg' | 'png';
}

export interface RembgCleanupResponse {
  success: boolean;
  imageBase64?: string;
  format?: string;
  model?: string;
  error?: string;
  errorType?: string;
}

@Injectable()
export class RembgCleanupService {
  private readonly logger = new Logger(RembgCleanupService.name);
  private readonly lambdaClient: LambdaClient;
  private readonly lambdaArn: string | undefined;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region = awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    this.lambdaClient = new LambdaClient({ region });
    this.lambdaArn = this.resolveLambdaArn();

    if (this.lambdaArn) {
      this.logger.log(`REMBG Lambda ARN: ${this.lambdaArn}`);
    } else {
      this.logger.warn('REMBG Lambda ARN not configured');
    }
  }

  private resolveLambdaArn(): string | undefined {
    const explicit = process.env.REMBG_CLEANUP_LAMBDA_ARN;
    if (explicit) return explicit;

    const nodeEnv = process.env.NODE_ENV || 'development';
    const envName = nodeEnv === 'production' ? 'production' : 'development';
    const accountId = process.env.AWS_ACCOUNT_ID || '235680477887';
    const awsConfig = this.configService.get('aws');
    const region = awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';

    return `arn:aws:lambda:${region}:${accountId}:function:rembg-cleanup-handler-${envName}`;
  }

  async removeBackground(
    input: RembgCleanupInput
  ): Promise<RembgCleanupResponse> {
    if (!this.lambdaArn) {
      throw new Error('REMBG Lambda ARN not configured');
    }

    try {
      this.logger.log('Invoking REMBG Lambda for background removal');

      const command = new InvokeCommand({
        FunctionName: this.lambdaArn,
        Payload: JSON.stringify(input),
      });

      const response = await this.lambdaClient.send(command);

      if (!response.Payload) {
        throw new Error('No payload returned from REMBG Lambda');
      }

      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      ) as RembgCleanupResponse;

      if (payload.success) {
        this.logger.log('REMBG Lambda completed successfully');
      } else {
        this.logger.warn(
          `REMBG Lambda returned error: ${payload.error} (${payload.errorType})`
        );
      }

      return payload;
    } catch (error: any) {
      this.logger.error(
        `REMBG Lambda invocation failed: ${error?.message ?? error}`,
        error?.stack
      );
      throw error;
    }
  }
}
