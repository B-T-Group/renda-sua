/** Matches backend PlatformPermissions keys. */
export const PlatformPermissions = {
  MODERATE_ITEMS: 'platform.moderate.items',
  MODERATE_RENTALS: 'platform.moderate.rentals',
  OPS_USER_DOCUMENTS: 'platform.ops.user_documents',
  MANAGE_AGENTS: 'platform.manage.agents',
  MANAGE_CLIENTS: 'platform.manage.clients',
  MANAGE_BUSINESSES: 'platform.manage.businesses',
  OPS_USER_MESSAGES: 'platform.ops.user_messages',
  FINANCIAL_REFUNDS: 'platform.financial.refunds',
  FINANCIAL_COMMISSIONS: 'platform.financial.commissions',
  FINANCIAL_MOBILE_PAYMENTS: 'platform.financial.mobile_payments',
  LOCATIONS_COMMISSION: 'platform.locations.commission',
  CONTENT_TAXONOMY: 'platform.content.taxonomy',
  CONTENT_BRANDS: 'platform.content.brands',
  CONTENT_STRIPE_TAX: 'platform.content.stripe_tax',
  CONFIG_APPLICATION: 'platform.config.application',
  CONFIG_COUNTRY_ONBOARDING: 'platform.config.country_onboarding',
  CONFIG_APPLICATION_SETUP: 'platform.config.application_setup',
  OPS_SITE_EVENTS: 'platform.ops.site_events',
  CATALOG_CROSS_BUSINESS: 'platform.catalog.cross_business',
  ORDERS_CROSS_BUSINESS: 'platform.orders.cross_business',
  LOCATIONS_TRANSFERS_ADMIN: 'platform.locations.transfers_admin',
  DASHBOARD_PLATFORM_STATS: 'platform.dashboard.platform_stats',
  MANAGE_CONTRACTS: 'platform.manage.contracts',
  RBAC_MANAGE: 'platform.rbac.manage',
  RECHARGE_ACCOUNT: 'platform.financial.recharge_account',
} as const;

export type PlatformPermission =
  (typeof PlatformPermissions)[keyof typeof PlatformPermissions];
