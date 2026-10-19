import type { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  DedicatedAgentsConfigService,
  resolveDedicatedAgentsConfig,
  type DedicatedConfigRow,
} from './dedicated-agents-config.service';
import { DEFAULT_DEDICATED_AGENTS_CONFIG } from './dedicated-agents.constants';

const flag = (value: boolean | null, country: string | null = null): DedicatedConfigRow => ({
  config_key: 'dedicated_agents_enabled',
  boolean_value: value,
  country_code: country,
});
const num = (key: string, value: number | string | null, country: string | null = null): DedicatedConfigRow => ({
  config_key: key,
  number_value: value,
  country_code: country,
});

describe('resolveDedicatedAgentsConfig', () => {
  it('is off with seeded defaults when no rows exist', () => {
    expect(resolveDedicatedAgentsConfig([])).toEqual(DEFAULT_DEDICATED_AGENTS_CONFIG);
    expect(DEFAULT_DEDICATED_AGENTS_CONFIG.enabled).toBe(false);
  });

  it('reads the global flag and numbers', () => {
    const config = resolveDedicatedAgentsConfig([
      flag(true),
      num('dedicated_offer_ttl_seconds', '90.0000'),
      num('dedicated_max_active_orders', 8),
      num('dedicated_max_assignments_per_agent', 4),
      num('dedicated_auto_assign_release_seconds', 60),
      num('dedicated_slot_reminder_minutes', 45),
      num('dedicated_posting_expiry_days', 7),
      num('dedicated_slot_end_grace_minutes', 10),
    ]);
    expect(config).toEqual({
      enabled: true,
      offerTtlSeconds: 90,
      maxActiveOrders: 8,
      maxAssignmentsPerAgent: 4,
      autoAssignReleaseSeconds: 60,
      slotReminderMinutes: 45,
      postingExpiryDays: 7,
      slotEndGraceMinutes: 10,
    });
  });

  it('lets a country row override the global row', () => {
    const rows = [flag(false), flag(true, 'CM'), num('dedicated_max_active_orders', 10), num('dedicated_max_active_orders', 6, 'CM')];
    expect(resolveDedicatedAgentsConfig(rows, 'cm').enabled).toBe(true);
    expect(resolveDedicatedAgentsConfig(rows, 'cm').maxActiveOrders).toBe(6);
    expect(resolveDedicatedAgentsConfig(rows, 'GA').enabled).toBe(false);
    expect(resolveDedicatedAgentsConfig(rows, 'GA').maxActiveOrders).toBe(10);
  });

  it('keeps the flag off for null or non-true values', () => {
    expect(resolveDedicatedAgentsConfig([flag(null)]).enabled).toBe(false);
    expect(resolveDedicatedAgentsConfig([flag(false)]).enabled).toBe(false);
  });

  it('falls back on null, non-integer and out-of-range numbers', () => {
    const config = resolveDedicatedAgentsConfig([
      num('dedicated_offer_ttl_seconds', null),
      num('dedicated_max_active_orders', 0),
      num('dedicated_max_assignments_per_agent', 2.5),
      num('dedicated_posting_expiry_days', 'abc'),
      num('dedicated_slot_end_grace_minutes', 1000),
    ]);
    expect(config.offerTtlSeconds).toBe(120);
    expect(config.maxActiveOrders).toBe(10);
    expect(config.maxAssignmentsPerAgent).toBe(3);
    expect(config.postingExpiryDays).toBe(14);
    expect(config.slotEndGraceMinutes).toBe(15);
  });
});

describe('DedicatedAgentsConfigService', () => {
  let executeQuery: jest.Mock;
  let service: DedicatedAgentsConfigService;

  beforeEach(() => {
    executeQuery = jest.fn();
    service = new DedicatedAgentsConfigService({ executeQuery } as unknown as HasuraSystemService);
  });

  it('queries only the dedicated keys, active rows', async () => {
    executeQuery.mockResolvedValue({ application_configurations: [flag(true)] });
    await expect(service.isEnabled()).resolves.toBe(true);
    const [query, vars] = executeQuery.mock.calls[0];
    expect(query).toContain('status: { _eq: "active" }');
    expect(vars.keys).toEqual(
      expect.arrayContaining(['dedicated_agents_enabled', 'dedicated_max_active_orders', 'dedicated_offer_ttl_seconds'])
    );
    expect(vars.keys).toHaveLength(8);
  });

  it('stays off when the config query fails', async () => {
    executeQuery.mockRejectedValue(new Error('hasura down'));
    await expect(service.isEnabled('CM')).resolves.toBe(false);
  });

  it('caches rows for 30 s', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T12:00:00Z'));
    try {
      executeQuery.mockResolvedValue({ application_configurations: [flag(false)] });
      await service.isEnabled();
      await service.isEnabled();
      expect(executeQuery).toHaveBeenCalledTimes(1);
      jest.setSystemTime(new Date('2026-10-18T12:00:31Z'));
      await service.isEnabled();
      expect(executeQuery).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
