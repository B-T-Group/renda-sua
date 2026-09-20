import type { AdminModuleSection } from '../components/business/BusinessDashboardModuleCard';
import type { BusinessDashboardModule } from '../components/business/BusinessDashboardModuleCard';

export const ADMIN_SECTION_ORDER: AdminModuleSection[] = [
  'people',
  'operations',
  'moderation',
  'catalog',
  'finance',
  'platform',
];

export const ADMIN_SECTION_LABELS: Record<
  AdminModuleSection,
  { key: string; fallback: string; hintKey: string; hintFallback: string }
> = {
  people: {
    key: 'business.dashboard.sections.adminPeople',
    fallback: 'People & businesses',
    hintKey: 'business.dashboard.sections.adminPeopleHint',
    hintFallback: 'Agents, clients, and business accounts.',
  },
  operations: {
    key: 'business.dashboard.sections.adminOperations',
    fallback: 'Operations',
    hintKey: 'business.dashboard.sections.adminOperationsHint',
    hintFallback: 'Orders, pickups, reliability, and follow-ups.',
  },
  moderation: {
    key: 'business.dashboard.sections.adminModeration',
    fallback: 'Moderation',
    hintKey: 'business.dashboard.sections.adminModerationHint',
    hintFallback: 'Approve listings, items, reels, and review AI decisions.',
  },
  catalog: {
    key: 'business.dashboard.sections.adminCatalog',
    fallback: 'Catalog',
    hintKey: 'business.dashboard.sections.adminCatalogHint',
    hintFallback: 'Brands and product taxonomy.',
  },
  finance: {
    key: 'business.dashboard.sections.adminFinance',
    fallback: 'Finance',
    hintKey: 'business.dashboard.sections.adminFinanceHint',
    hintFallback: 'Commissions, mobile payments, recharge, and programs.',
  },
  platform: {
    key: 'business.dashboard.sections.adminSystem',
    fallback: 'Platform',
    hintKey: 'business.dashboard.sections.adminSystemHint',
    hintFallback: 'Configuration, messaging, analytics, and onboarding.',
  },
};

export interface AdminModuleGroup {
  section: AdminModuleSection;
  modules: BusinessDashboardModule[];
}

export function groupAdminModules(
  modules: BusinessDashboardModule[],
  search = ''
): AdminModuleGroup[] {
  const query = search.trim().toLowerCase();
  const filtered = query
    ? modules.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query)
      )
    : modules;

  return ADMIN_SECTION_ORDER.map((section) => ({
    section,
    modules: filtered.filter((m) => m.section === section),
  })).filter((group) => group.modules.length > 0);
}

/** Longest matching module path wins (handles nested routes). */
export function findSelectedAdminPath(
  pathname: string,
  modules: BusinessDashboardModule[]
): string | null {
  const overview = '/business/dashboard/admin';
  if (pathname === overview) return overview;

  let best: string | null = null;
  for (const mod of modules) {
    if (
      pathname === mod.path ||
      pathname.startsWith(`${mod.path}/`)
    ) {
      if (!best || mod.path.length > best.length) {
        best = mod.path;
      }
    }
  }
  return best;
}
