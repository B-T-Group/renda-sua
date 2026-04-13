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
  enableCloudWatch?: boolean;
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
  resendApiKey?: string;
  resendFromEmail?: string;
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

/** Orange Money Core APIs (api-s1.orange.cm) — OAuth + Core X-AUTH-TOKEN. */
export interface OrangeMomoConfig {
  baseUrl: string;
  oauthTokenUrl: string;
  /** `password` (username/password in body) or `client_credentials` (body only grant_type). */
  oauthGrantType: 'password' | 'client_credentials';
  customerKey: string;
  customerSecret: string;
  apiUsername: string;
  apiPassword: string;
  /** Partner channel short MSISDN for mpPay. */
  channelMsisdn: string;
  /** Public URL Orange calls for mp notifications (e.g. https://dev.api.rendasua.com/api/orange-momo/webhook). */
  callbackUrl: string;
  /** Merchant channel PIN for mp/cash-in/cash-out; defaults to `2222` if unset. */
  channelPin: string;
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
  clientId?: string;
  clientSecret?: string;
  managementClientId?: string;
  managementClientSecret?: string;
}

export interface OrderConfig {
  /** Minutes to wait before payment timeout cancellation (default 10). Used by wait-and-execute state machine. */
  paymentTimeoutWaitMinutes?: number;
}

/** When agent has an active delivery, location update interval in ms (default 60s). */
export interface AgentTrackingConfig {
  activeDeliveryIntervalMs: number;
}

export interface GoogleCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
}

export interface OpenAIConfig {
  /** Used for image cleanup/edits (OpenAI Images API) and chat completions when provider is OpenAI. */
  apiKey: string;
  /** Vision-capable chat model for `generateImageItemSuggestions` when `provider` is `openai` (e.g. `gpt-4o-mini`). */
  chatModel: string;
}

export interface DeepseekConfig {
  apiKey: string;
  /**
   * Model for vision-style multimodal requests (OpenAI-compatible `image_url` parts).
   * Defaults to `deepseek-chat`. Hosted DeepSeek may reject vision payloads; the service falls back to text-only.
   */
  visionModel: string;
}

export interface MyPVitConfig {
  baseUrl: string;
  merchantSlug: string;
  airtelSecretKey: string; // RENAMED from secretKey
  moovSecretKey: string; // NEW
  environment: 'test' | 'production';
  callbackUrlCode: string;
  secretRefreshUrlCode: string;
  airtelMerchantOperationAccountCode: string; // RENAMED from merchantOperationAccountCode
  moovMerchantOperationAccountCode: string; // NEW
  paymentEndpointCode: string;
  /** Path segment for MyPVit status API (e.g. `/CODE/status/...`). */
  statusEndpointCode: string;
}

export interface FreemopayConfig {
  baseUrl: string;
  appKey: string;
  secretKey: string;
  callbackUrl: string;
}

export interface NotificationConfig {
  orderStatusChangeEnabled: boolean;
}

export interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  enabled: boolean;
  /** Optional EAS access token for Expo push API auth (recommended for production) */
  expoAccessToken?: string;
}

export interface SmsConfig {
  enabled: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
}

/** MTN SMS v3 API (api.mtn.com) — OAuth + short code from opco. */
export interface MtnSmsConfig {
  clientId: string;
  clientSecret: string;
  serviceCode: string;
  baseUrl: string;
  senderAddress?: string;
}

export interface PdfEndpointConfig {
  apiToken: string;
  sandbox: boolean;
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
  orangeMomo: OrangeMomoConfig;
  airtelMoney: AirtelMoneyConfig;
  mypvit: MyPVitConfig;
  freemopay: FreemopayConfig;
  order: OrderConfig;
  agentTracking: AgentTrackingConfig;
  auth0: Auth0Config;
  googleCache: GoogleCacheConfig;
  openai: OpenAIConfig;
  deepseek: DeepseekConfig;
  notification: NotificationConfig;
  push: PushConfig;
  sms: SmsConfig;
  mtnSms: MtnSmsConfig;
  pdfEndpoint: PdfEndpointConfig;
}

// Secrets are now loaded in main.ts before NestJS starts
// This function is synchronous and reads from process.env
export default (): Configuration => {
  const mypvitEnvironment =
    (process.env.MYPVIT_ENVIRONMENT as 'test' | 'production') || 'test';

  return {
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
    GOOGLE_CACHE_ENABLED: process.env.GOOGLE_CACHE_ENABLED !== 'false', // Default to true
    GOOGLE_CACHE_TTL: parseInt(process.env.GOOGLE_CACHE_TTL || '86400', 10), // Default to 1 day
    airtelMoney: {
      clientId:
        process.env.AIRTEL_MONEY_CLIENT_ID ??
        '80d9a954-e12a-43a8-8fd5-7dcb926ce6af',
      clientSecret: process.env.AIRTEL_MONEY_CLIENT_SECRET ?? '',
      targetEnvironment:
        process.env.AIRTEL_MONEY_TARGET_ENVIRONMENT ?? 'sandbox',
      callbackUrl: process.env.AIRTEL_MONEY_CALLBACK_URL ?? '',
      country: process.env.AIRTEL_MONEY_COUNTRY ?? 'UG',
      currency: process.env.AIRTEL_MONEY_CURRENCY ?? 'UGX',
      disbursementPrimaryKey:
        process.env.AIRTEL_MONEY_DISBURSEMENT_PRIMARY_KEY ?? '',
      disbursementSecondaryKey:
        process.env.AIRTEL_MONEY_DISBURSEMENT_SECONDARY_KEY ?? '',
      remittancePrimaryKey:
        process.env.AIRTEL_MONEY_REMITTANCE_PRIMARY_KEY ?? '',
      remittanceSecondaryKey:
        process.env.AIRTEL_MONEY_REMITTANCE_SECONDARY_KEY ?? '',
    },
    mypvit: {
      baseUrl: process.env.MYPVIT_BASE_URL || 'https://api.mypvit.pro',
      merchantSlug: process.env.MYPVIT_MERCHANT_SLUG || 'MR_1755783875',
      airtelSecretKey: process.env.AIRTEL_MYPVIT_SECRET_KEY || '', // RENAMED
      moovSecretKey: process.env.MOOV_MYPVIT_SECRET_KEY || '', // NEW
      environment: mypvitEnvironment,
      callbackUrlCode: process.env.MYPVIT_CALLBACK_URL_CODE || 'FJXSU',
      secretRefreshUrlCode:
        process.env.MYPVIT_SECRET_REFRESH_URL_CODE || 'TRUVU',
      airtelMerchantOperationAccountCode:
        process.env.MYPVIT_AIRTEL_MERCHANT_OPERATION_ACCOUNT_CODE ||
        'ACC_68A722C33473B', // RENAMED
      moovMerchantOperationAccountCode:
        process.env.MYPVIT_MOOV_MERCHANT_OPERATION_ACCOUNT_CODE ||
        'ACC_68A722C33473B', // NEW
      paymentEndpointCode:
        process.env.MYPVIT_PAYMENT_ENDPOINT_CODE || 'X5T3RIBYQUDFBZSH',
      statusEndpointCode:
        process.env.MYPVIT_STATUS_ENDPOINT_CODE ||
        (mypvitEnvironment === 'production'
          ? 'XI1OVAQBUCK8WEJC'
          : 'RYXA6SLFNRBFFQJX'),
    },
    freemopay: {
      baseUrl: process.env.FREEMOPAY_BASE_URL || 'https://api-v2.freemopay.com',
      appKey:
        process.env.FREEMOPAY_APP_KEY || '5b084323-3fff-47e4-bbcb-a1970efe3051',
      secretKey: process.env.FREEMOPAY_SECRET_KEY || '',
      callbackUrl: process.env.FREEMOPAY_CALLBACK_URL || '',
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
        process.env.HASURA_GRAPHQL_ADMIN_SECRET || 'myadminsecretkey',
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
      enableCloudWatch: process.env.ENABLE_CLOUDWATCH === 'true',
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
      resendApiKey: process.env.RESEND_API_KEY,
      resendFromEmail:
        process.env.RESEND_FROM_EMAIL || 'Rendasua <noreply@rendasua.com>',
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
      subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY || '',
      apiKey: process.env.MTN_MOMO_API_KEY || '',
      apiUserId: process.env.MTN_MOMO_API_USER_ID,
      targetEnvironment: process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox',
      collectionPrimaryKey: process.env.MTN_MOMO_COLLECTION_PRIMARY_KEY || '',
      collectionSecondaryKey:
        process.env.MTN_MOMO_COLLECTION_SECONDARY_KEY || '',
      disbursementPrimaryKey:
        process.env.MTN_MOMO_DISBURSEMENT_PRIMARY_KEY || '',
      disbursementSecondaryKey:
        process.env.MTN_MOMO_DISBURSEMENT_SECONDARY_KEY || '',
      remittancePrimaryKey: process.env.MTN_MOMO_REMITTANCE_PRIMARY_KEY || '',
      remittanceSecondaryKey:
        process.env.MTN_MOMO_REMITTANCE_SECONDARY_KEY || '',
      callbackUrl: process.env.MTN_MOMO_CALLBACK_URL,
    },
    orangeMomo: {
      baseUrl:
        process.env.ORANGE_MOMO_BASE_URL ||
        'https://api-s1.orange.cm/omcoreapis/1.0.2',
      oauthTokenUrl:
        process.env.ORANGE_MOMO_OAUTH_TOKEN_URL ||
        'https://api-s1.orange.cm/token',
      oauthGrantType:
        process.env.ORANGE_MOMO_OAUTH_GRANT_TYPE === 'client_credentials'
          ? 'client_credentials'
          : 'password',
      customerKey: process.env.ORANGE_MOMO_CUSTOMER_KEY || '',
      customerSecret: process.env.ORANGE_MOMO_CUSTOMER_SECRET || '',
      apiUsername: process.env.ORANGE_MOMO_API_USERNAME || '',
      apiPassword: process.env.ORANGE_MOMO_API_PASSWORD || '',
      channelMsisdn: process.env.ORANGE_MOMO_CHANNEL_MSISDN || '',
      callbackUrl:
        process.env.ORANGE_MOMO_CALLBACK_URL ||
        (process.env.API_BASE_URL
          ? `${process.env.API_BASE_URL.replace(/\/$/, '')}/api/orange-momo/webhook`
          : ''),
      channelPin: process.env.ORANGE_MOMO_CHANNEL_PIN || '2222',
    },
    order: {
      paymentTimeoutWaitMinutes: parseInt(
        process.env.PAYMENT_TIMEOUT_WAIT_MINUTES || '10',
        10
      ),
    },
    agentTracking: {
      activeDeliveryIntervalMs: parseInt(
        process.env.AGENT_TRACKING_INTERVAL_ACTIVE_MS || '60000',
        10
      ),
    },
    auth0: {
      domain: process.env.AUTH0_DOMAIN || 'rendasua.ca.auth0.com',
      audience:
        process.env.AUTH0_AUDIENCE || 'https://rendasua.ca.auth0.com/api/v2/',
      clientId: process.env.AUTH0_CLIENT_ID || '',
      clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
      managementClientId: process.env.AUTH0_MGMT_CLIENT_ID || '',
      managementClientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET || '',
    },
    googleCache: {
      enabled: process.env.GOOGLE_CACHE_ENABLED !== 'false', // Default to true
      ttl: parseInt(process.env.GOOGLE_CACHE_TTL || '86400', 10), // Default to 1 day
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      visionModel: process.env.DEEPSEEK_VISION_MODEL || 'deepseek-chat',
    },
    notification: {
      orderStatusChangeEnabled:
        process.env.ORDER_STATUS_NOTIFICATIONS_ENABLED !== 'false',
    },
    push: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
      enabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true',
      expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
    },
    sms: {
      enabled: process.env.SMS_ENABLED === 'true',
      twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
      twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? '',
    },
    mtnSms: {
      clientId: process.env.MTN_SMS_CLIENT_ID ?? '',
      clientSecret: process.env.MTN_SMS_CLIENT_SECRET ?? '',
      serviceCode: process.env.MTN_SMS_SERVICE_CODE ?? '',
      baseUrl: process.env.MTN_SMS_BASE_URL ?? 'https://api.mtn.com',
      senderAddress: process.env.MTN_SMS_SENDER_ADDRESS,
    },
    pdfEndpoint: {
      apiToken: process.env.PDF_ENDPOINT_TOKEN || '',
      sandbox: process.env.NODE_ENV !== 'production',
    },
  };
};
