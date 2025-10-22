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
  sendGridApiKey?: string;
  sendGridFromEmail?: string;
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

export interface AirtelMoneyConfig {
  clientId?: string;
  clientSecret?: string;
  targetEnvironment?: string;
  callbackUrl?: string;
  country?: string;
  currency?: string;
  disbursementPrimaryKey?: string;
  disbursementSecondaryKey?: string;
  remittancePrimaryKey?: string;
  remittanceSecondaryKey?: string;
}

export interface Auth0Config {
  domain: string;
  audience: string;
  managementClientId?: string;
  managementClientSecret?: string;
}

export interface OrderConfig {
  agentHoldPercentage: number;
}

export interface GoogleCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
}

export interface OpenAIConfig {
  apiKey: string;
}

export interface MyPVitConfig {
  baseUrl: string;
  merchantSlug: string;
  secretKey: string;
  environment: 'test' | 'production';
  callbackUrlCode: string;
  secretRefreshUrlCode: string;
  merchantOperationAccountCode: string;
  paymentEndpointCode: string;
}

export interface NotificationConfig {
  orderStatusChangeEnabled: boolean;
}

export interface Configuration {
  GOOGLE_MAPS_API_KEY: string;
  GOOGLE_CACHE_ENABLED: boolean;
  GOOGLE_CACHE_TTL: number;
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
  airtelMoney: AirtelMoneyConfig;
  mypvit: MyPVitConfig;
  order: OrderConfig;
  auth0: Auth0Config;
  googleCache: GoogleCacheConfig;
  openai: OpenAIConfig;
  notification: NotificationConfig;
}

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

async function getSecrets(): Promise<Record<string, string>> {
  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'ca-central-1',
  });

  // More explicit environment detection
  const nodeEnv = process.env.NODE_ENV || 'development';
  const deploymentEnv = process.env.DEPLOYMENT_ENV || nodeEnv;

  const secretName =
    deploymentEnv === 'production'
      ? 'production-rendasua-backend-secrets'
      : 'development-rendasua-backend-secrets';

  console.log(
    `Loading secrets for environment: ${deploymentEnv} (NODE_ENV: ${nodeEnv})`
  );
  console.log(`Using secret name: ${secretName}`);

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const data = await client.send(command);

    if (data.SecretString) {
      const secrets = JSON.parse(data.SecretString);
      console.log(`Successfully loaded secrets from: ${secretName}`);
      return secrets;
    } else if (data.SecretBinary) {
      const buff = Buffer.from(data.SecretBinary as Uint8Array);
      const secrets = JSON.parse(buff.toString('ascii'));
      console.log(`Successfully loaded binary secrets from: ${secretName}`);
      return secrets;
    }
    console.log(`No secret data found in: ${secretName}`);
    return {};
  } catch (err) {
    console.error(`Failed to load secrets from ${secretName}:`, err);
    // Fallback to empty object if secrets cannot be loaded
    return {};
  }
}

export default async (): Promise<Configuration> => {
  const secrets = await getSecrets();

  return {
    GOOGLE_MAPS_API_KEY: secrets.GOOGLE_MAPS_API_KEY,
    GOOGLE_CACHE_ENABLED: process.env.GOOGLE_CACHE_ENABLED !== 'false', // Default to true
    GOOGLE_CACHE_TTL: parseInt(process.env.GOOGLE_CACHE_TTL || '86400', 10), // Default to 1 day
    airtelMoney: {
      clientId:
        process.env.AIRTEL_MONEY_CLIENT_ID ??
        '80d9a954-e12a-43a8-8fd5-7dcb926ce6af',
      clientSecret: secrets.AIRTEL_MONEY_CLIENT_SECRET ?? '',
      targetEnvironment:
        process.env.AIRTEL_MONEY_TARGET_ENVIRONMENT ?? 'sandbox',
      callbackUrl: process.env.AIRTEL_MONEY_CALLBACK_URL ?? '',
      country: process.env.AIRTEL_MONEY_COUNTRY ?? 'UG',
      currency: process.env.AIRTEL_MONEY_CURRENCY ?? 'UGX',
      disbursementPrimaryKey:
        secrets.AIRTEL_MONEY_DISBURSEMENT_PRIMARY_KEY ?? '',
      disbursementSecondaryKey:
        secrets.AIRTEL_MONEY_DISBURSEMENT_SECONDARY_KEY ?? '',
      remittancePrimaryKey: secrets.AIRTEL_MONEY_REMITTANCE_PRIMARY_KEY ?? '',
      remittanceSecondaryKey:
        secrets.AIRTEL_MONEY_REMITTANCE_SECONDARY_KEY ?? '',
    },
    mypvit: {
      baseUrl: process.env.MYPVIT_BASE_URL || 'https://api.mypvit.pro',
      merchantSlug: process.env.MYPVIT_MERCHANT_SLUG || 'MR_1755783875',
      secretKey: process.env.MYPVIT_SECRET_KEY || 'CTCNJRBWZIDALEGT',
      environment:
        (process.env.MYPVIT_ENVIRONMENT as 'test' | 'production') || 'test',
      callbackUrlCode: process.env.MYPVIT_CALLBACK_URL_CODE || 'FJXSU',
      secretRefreshUrlCode:
        process.env.MYPVIT_SECRET_REFRESH_URL_CODE || 'TRUVU',
      merchantOperationAccountCode:
        process.env.MYPVIT_MERCHANT_OPERATION_ACCOUNT_CODE ||
        'ACC_68A722C33473B',
      paymentEndpointCode:
        process.env.MYPVIT_PAYMENT_ENDPOINT_CODE || 'X5T3RIBYQUDFBZSH',
    },
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
      adminSecret:
        process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
        secrets.HASURA_GRAPHQL_ADMIN_SECRET ||
        'myadminsecretkey',
    },
    aws: {
      region: process.env.AWS_REGION || 'ca-central-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || secrets.AWS_ACCESS_KEY_ID,
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY || secrets.AWS_SECRET_ACCESS_KEY,
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
      sendGridApiKey: secrets.SENDGRID_API_KEY,
      sendGridFromEmail: 'noreply@rendasua.com',
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
    auth0: {
      domain: process.env.AUTH0_DOMAIN || 'rendasua.ca.auth0.com',
      audience:
        process.env.AUTH0_AUDIENCE || 'https://rendasua.ca.auth0.com/api/v2/',
      managementClientId:
        process.env.AUTH0_MGMT_CLIENT_ID || secrets.AUTH0_MGMT_CLIENT_ID,
      managementClientSecret:
        process.env.AUTH0_MGMT_CLIENT_SECRET ||
        secrets.AUTH0_MGMT_CLIENT_SECRET,
    },
    googleCache: {
      enabled: process.env.GOOGLE_CACHE_ENABLED !== 'false', // Default to true
      ttl: parseInt(process.env.GOOGLE_CACHE_TTL || '86400', 10), // Default to 1 day
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || secrets.OPENAI_API_KEY || '',
    },
    notification: {
      orderStatusChangeEnabled: process.env.NODE_ENV === 'production',
    },
  };
};
