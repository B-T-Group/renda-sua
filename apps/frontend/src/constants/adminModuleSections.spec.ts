import {
  findSelectedAdminPath,
  groupAdminModules,
} from './adminModuleSections';
import type { BusinessDashboardModule } from '../components/business/BusinessDashboardModuleCard';

const mod = (
  path: string,
  section: BusinessDashboardModule['section'],
  title = path
): BusinessDashboardModule => ({
  title,
  description: `${title} description`,
  icon: null,
  count: null,
  color: '#000',
  path,
  section,
});

describe('adminModuleSections', () => {
  const modules = [
    mod('/admin/agents', 'people', 'Manage Agents'),
    mod('/admin/orders', 'operations', 'Order operations'),
    mod('/admin/items/moderation', 'moderation', 'Sale item moderation'),
    mod('/content-management/brands', 'catalog', 'Manage Brands'),
    mod('/admin/payment-programs', 'finance', 'Payment programs'),
    mod('/admin/configurations', 'platform', 'Manage Configurations'),
  ];

  it('groups modules in section order and skips empty sections', () => {
    const groups = groupAdminModules(modules);
    expect(groups.map((g) => g.section)).toEqual([
      'people',
      'operations',
      'moderation',
      'catalog',
      'finance',
      'platform',
    ]);
    expect(groups[0].modules).toHaveLength(1);
  });

  it('filters by title or description search', () => {
    const groups = groupAdminModules(modules, 'payment');
    expect(groups).toHaveLength(1);
    expect(groups[0].section).toBe('finance');
    expect(groups[0].modules[0].path).toBe('/admin/payment-programs');
  });

  it('selects overview and longest matching path', () => {
    expect(
      findSelectedAdminPath('/business/dashboard/admin', modules)
    ).toBe('/business/dashboard/admin');
    expect(findSelectedAdminPath('/admin/orders/abc', modules)).toBe(
      '/admin/orders'
    );
    expect(
      findSelectedAdminPath('/admin/payment-programs/schedules', modules)
    ).toBe('/admin/payment-programs');
  });
});
