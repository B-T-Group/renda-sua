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

/** Sync invoke must finish before ALB/Nest timeouts; fall back to OpenAI after this. */
const REMBG_INVOKE_TIMEOUT_MS = 90_000;
/** Lambda sync payload limit is 6MB; leave headroom for JSON envelope. */
const REMBG_MAX_PAYLOAD_CHARS = 5_500_000;

@Injectable()
export class RembgCleanupService {
  private readonly logger = new Logger(RembgCleanupService.name);
  private readonly lambdaClient: LambdaClient;
  private readonly lambdaArn: string | undefined;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get('aws');
    const region = awsConfig?.region || process.env.AWS_REGION || 'ca-central-1';
    const accessKeyId = awsConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      awsConfig?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    this.lambdaClient = new LambdaClient({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
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

    const payload = JSON.stringify(input);
    if (payload.length > REMBG_MAX_PAYLOAD_CHARS) {
      throw new Error(
        `REMBG payload too large (${payload.length} chars); use OpenAI fallback`
      );
    }

    try {
      this.logger.log('Invoking REMBG Lambda for background removal');
      const response = await this.lambdaClient.send(
        new InvokeCommand({
          FunctionName: this.lambdaArn,
          Payload: payload,
        }),
        { abortSignal: AbortSignal.timeout(REMBG_INVOKE_TIMEOUT_MS) }
      );

      if (response.FunctionError) {
        const raw = response.Payload
          ? new TextDecoder().decode(response.Payload)
          : '';
        throw new Error(
          `REMBG Lambda FunctionError=${response.FunctionError}: ${raw.slice(0, 500)}`
        );
      }

      if (!response.Payload) {
        throw new Error('No payload returned from REMBG Lambda');
      }

      const result = JSON.parse(
        new TextDecoder().decode(response.Payload)
      ) as RembgCleanupResponse;

      if (result.success) {
        this.logger.log('REMBG Lambda completed successfully');
      } else {
        this.logger.warn(
          `REMBG Lambda returned error: ${result.error} (${result.errorType})`
        );
      }

      return result;
    } catch (error: any) {
      this.logger.error(
        `REMBG Lambda invocation failed: ${error?.message ?? error}`,
        error?.stack
      );
      throw error;
    }
  }
}
