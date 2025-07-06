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

export interface Configuration {
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
}

export default (): Configuration => ({
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
      process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql',
    adminSecret: process.env.HASURA_GRAPHQL_ADMIN_SECRET || 'myadminsecretkey',
  },
  aws: {
    region: process.env.AWS_REGION || 'ca-central-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3BucketName: process.env.S3_BUCKET_NAME,
    s3BucketRegion:
      process.env.S3_BUCKET_REGION || process.env.AWS_REGION || 'ca-central-1',
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
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
    apiKey: process.env.MTN_MOMO_API_KEY,
    apiUserId: process.env.MTN_MOMO_API_USER_ID,
    targetEnvironment: process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox',
    collectionPrimaryKey: process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY,
    collectionSecondaryKey: process.env.MTN_MOMO_COLLECTION_SECONDARY_KEY,
    disbursementPrimaryKey: process.env.MTN_MOMO_DISBURSEMENT_PRIMARY_KEY,
    disbursementSecondaryKey: process.env.MTN_MOMO_DISBURSEMENT_SECONDARY_KEY,
    remittancePrimaryKey: process.env.MTN_MOMO_REMITTANCE_PRIMARY_KEY,
    remittanceSecondaryKey: process.env.MTN_MOMO_REMITTANCE_SECONDARY_KEY,
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL,
  },
});
