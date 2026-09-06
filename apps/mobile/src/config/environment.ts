/**
 * Configuration d'environnement pour BT Groupe Mobile
 */

interface Auth0Config {
  domain: string;
  clientId: string;
  redirectUri: string;
  audience: string;
}

export interface BTEnvironment {
  endpoint: string;
  stripe_client: string;
  paypal_client_id: string;
  agent_subscription_plan_id: string;
  defaultMortgageFee: number;
  defaultRenovationFee: number;
  auth0Config: Auth0Config;
  analytics?: {
    apiKey: string;
    endpoint: string;
    enabled: boolean;
  };
}

const environments: { [key: string]: BTEnvironment } = {
  dev: {
    endpoint:
      "https://oksbfmgba4.execute-api.ca-central-1.amazonaws.com/dev/graphql-client",
    // Must match the backend STRIPE_PUBLISHABLE_KEY (same Stripe account) so
    // PaymentIntents created server-side are accepted by the PaymentSheet.
    stripe_client:
      "pk_test_51TmILnLBaKicCErK28cHNMBxBBgho2lxbim2RfW7x4Zy5iVD8e1J9a16CvLiSdKvtTjjdQYxC4dcsxmSxIqb8Jj0009QRBgqT2",
    paypal_client_id:
      "ASH0BZZrFwoj5as53WeqRhCUHNzmxIUpNy5HQIbv3D6FMBngf_EEIcCSd1G3cp2tRHMzb-WByjGE6wMy",
    agent_subscription_plan_id: "P-7ES70860MU978534CMEIWNNA",
    defaultMortgageFee: 200,
    defaultRenovationFee: 75,
    auth0Config: {
      domain: "groupe-bt-client-dev.us.auth0.com",
      clientId: "dT3K2CchhtGx3CICL2x8ow6yXn6cMNJC",
      redirectUri: "http://localhost:4003/authorize",
      audience: "https://groupe-bt-client-dev.us.auth0.com/api/v2/",
    },
    analytics: {
      apiKey: "kVuw76gCQxlB5Jd5hzJVs8nsFol-MQg9wHDWnF8pkZ8",
      endpoint: "https://marketing.applyproject.com/analytics/event",
      enabled: true,
    },
  },
  prod: {
    endpoint:
      "https://0z2vwr0xm4.execute-api.ca-central-1.amazonaws.com/prod/graphql-client",
    // Must match backend production STRIPE_PUBLISHABLE_KEY (same Stripe account).
    stripe_client:
      "pk_live_51TmILaPzvx7093BNE1Fcm3DVbvEtNiN2KDYEvo0QMy1mkzI9kd7sik1IKiWw6wkx7nNDlTWVQGn26AOWMIaAasiF00nJ93YNJG",
    paypal_client_id:
      "AcX6eP7w8rPdf9dQvmj1dLlFkEJIg17PQJWSj_yjZyas4rpC6w6CPcGfN9KuOhPFHJBSAqk6FWXK0GgS",
    agent_subscription_plan_id: "P-8N57289616104031SMEJ3Z3I",
    defaultMortgageFee: 200,
    defaultRenovationFee: 75,
    auth0Config: {
      domain: "groupe-bt-client.us.auth0.com",
      clientId: "Vkp7IzfTF4dkIz6atPrTYWO6FtoKhqD2",
      redirectUri: "http://client.groupe-bt.com/authorize",
      audience: "https://groupe-bt-client.us.auth0.com/api/v2/",
    },
    analytics: {
      apiKey: "kVuw76gCQxlB5Jd5hzJVs8nsFol-MQg9wHDWnF8pkZ8",
      endpoint: "https://marketing.applyproject.com/analytics/event",
      enabled: true,
    },
  },
  local: {
    endpoint: "http://localhost:7010/local/graphql-client",
    // Must match the backend STRIPE_PUBLISHABLE_KEY (same Stripe account).
    stripe_client:
      "pk_test_51TmILnLBaKicCErK28cHNMBxBBgho2lxbim2RfW7x4Zy5iVD8e1J9a16CvLiSdKvtTjjdQYxC4dcsxmSxIqb8Jj0009QRBgqT2",
    paypal_client_id:
      "ASH0BZZrFwoj5as53WeqRhCUHNzmxIUpNy5HQIbv3D6FMBngf_EEIcCSd1G3cp2tRHMzb-WByjGE6wMy",
    agent_subscription_plan_id: "P-7ES70860MU978534CMEIWNNA",
    defaultMortgageFee: 200,
    defaultRenovationFee: 75,
    auth0Config: {
      domain: "groupe-bt-client-dev.us.auth0.com",
      clientId: "dT3K2CchhtGx3CICL2x8ow6yXn6cMNJC",
      redirectUri: "http://localhost:4003/authorize",
      audience: "https://groupe-bt-client-dev.us.auth0.com/api/v2/",
    },
    analytics: {
      apiKey: "kVuw76gCQxlB5Jd5hzJVs8nsFol-MQg9wHDWnF8pkZ8",
      endpoint: "https://marketing.applyproject.com/analytics/event",
      enabled: false, // Désactivé en local par défaut
    },
  },
};

export function getEnv(): BTEnvironment {
  // Utiliser l'environnement prod par défaut pour l'application mobile
  const env = environments[process.env.BT_ENV ?? "prod"];
  return env;
}

// Configuration par défaut
export const config = {
  app: {
    name: 'BT Groupe Mobile',
    version: '1.0.3',
    buildNumber: '1',
  },
  theme: {
    primaryColor: 'rgb(255, 255, 255)',
    backgroundColor: '#FFFFFF',
  },
  api: {
    timeout: 30000, // 30 secondes
    retryAttempts: 3,
  },
  storage: {
    prefix: '@BTGroupe:',
  },
};

export default config;



