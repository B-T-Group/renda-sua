export interface DatabaseConfig {
  url: string;
}

export interface HasuraConfig {
  endpoint: string;
  adminSecret: string;
}

export interface AwsConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  s3BucketName?: string;
  s3BucketRegion?: string;
  cloudWatchLogGroup?: string;
  cloudWatchLogStream?: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface CorsConfig {
  origin: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  logLevel: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface ExternalApiConfig {
  googleMapsApiKey?: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
}

export interface MtnMomoConfig {
  subscriptionKey?: string;
  apiKey?: string;
  apiUserId?: string;
  targetEnvironment?: string;
  collectionPrimaryKey?: string;
  collectionSecondaryKey?: string;
  disbursementPrimaryKey?: string;
  disbursementSecondaryKey?: string;
  remittancePrimaryKey?: string;
  remittanceSecondaryKey?: string;
  callbackUrl?: string;
}

export interface OrderConfig {
  agentHoldPercentage: number;
}

export interface Configuration {
  GOOGLE_MAPS_API_KEY: string;
  app: AppConfig;
  database: DatabaseConfig;
  hasura: HasuraConfig;
  aws: AwsConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
  email: EmailConfig;
  redis: RedisConfig;
  externalApi: ExternalApiConfig;
  mtnMomo: MtnMomoConfig;
  order: OrderConfig;
}

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

async function getSecrets(): Promise<Record<string, string>> {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'ca-central-1',
  });

  const secretName =
    process.env.NODE_ENV === 'production'
      ? 'production-rendasua-backend-secrets'
      : 'development-rendasua-backend-secrets';

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const data = await client.send(command);

    if (data.SecretString) {
      return JSON.parse(data.SecretString);
    } else if (data.SecretBinary) {
      const buff = Buffer.from(data.SecretBinary as Uint8Array);
      return JSON.parse(buff.toString('ascii'));
    }
    return {};
  } catch (err) {
    // Fallback to empty object if secrets cannot be loaded
    return {};
  }
}

export default async (): Promise<Configuration> => {
  const secrets = await getSecrets();

  return {
    GOOGLE_MAPS_API_KEY: secrets.GOOGLE_MAPS_API_KEY,
    app: {
      port: parseInt(process.env.PORT || '3000', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'debug',
    },
    database: {
      url:
        process.env.DATABASE_URL ||
        'postgresql://username:password@localhost:5432/rendasua',
    },
    hasura: {
      endpoint:
        process.env.HASURA_GRAPHQL_ENDPOINT ||
        'http://localhost:8080/v1/graphql',
      adminSecret: secrets.HASURA_GRAPHQL_ADMIN_SECRET || 'myadminsecretkey',
    },
    aws: {
      region: process.env.AWS_REGION || 'ca-central-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      s3BucketName: process.env.S3_BUCKET_NAME,
      s3BucketRegion:
        process.env.S3_BUCKET_REGION ||
        process.env.AWS_REGION ||
        'ca-central-1',
      cloudWatchLogGroup:
        process.env.CLOUDWATCH_LOG_GROUP || 'rendasua-backend-logs',
      cloudWatchLogStream: process.env.CLOUDWATCH_LOG_STREAM || 'application',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'your_jwt_secret_key',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    },
    email: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
    },
    externalApi: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
    mtnMomo: {
      subscriptionKey: secrets.MTN_MOMO_SUBSCRIPTION_KEY,
      apiKey: secrets.MTN_MOMO_API_KEY,
      apiUserId: process.env.MTN_MOMO_API_USER_ID,
      targetEnvironment: process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox',
      collectionPrimaryKey: secrets.MTN_MOMO_COLLECTION_PRIMARY_KEY,
      collectionSecondaryKey: secrets.MTN_MOMO_COLLECTION_SECONDARY_KEY,
      disbursementPrimaryKey: secrets.MTN_MOMO_DISBURSEMENT_PRIMARY_KEY,
      disbursementSecondaryKey: secrets.MTN_MOMO_DISBURSEMENT_SECONDARY_KEY,
      remittancePrimaryKey: secrets.MTN_MOMO_REMITTANCE_PRIMARY_KEY,
      remittanceSecondaryKey: secrets.MTN_MOMO_REMITTANCE_SECONDARY_KEY,
      callbackUrl: process.env.MTN_MOMO_CALLBACK_URL,
    },
    order: {
      agentHoldPercentage: parseFloat(
        process.env.AGENT_HOLD_PERCENTAGE || '80'
      ),
    },
  };
};
