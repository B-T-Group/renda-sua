import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  DevOnlyGuard,
  RepresentativeCommissionAdminController,
} from './representative-commission-admin.controller';
import { RepresentativeCommissionService, parseAdminPeriod } from './representative-commission.service';

/** QA #559 item 7: DEV-only, superuser-only month-close trigger; double / parallel close is idempotent. */
describe('portfolio month-close admin trigger', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  describe('DevOnlyGuard', () => {
    it.each([
      [{ NODE_ENV: 'production' }],
      [{ NODE_ENV: 'development', DEPLOYMENT_ENV: 'production' }],
      [{ NODE_ENV: 'Production ' }],
    ])('404s in production runtime %j', (vars) => {
      Object.assign(process.env, { DEPLOYMENT_ENV: '' }, vars);
      expect(() => new DevOnlyGuard().canActivate()).toThrow(NotFoundException);
    });

    it('allows DEV', () => {
      Object.assign(process.env, { NODE_ENV: 'development', DEPLOYMENT_ENV: 'development' });
      expect(new DevOnlyGuard().canActivate()).toBe(true);
    });

    it('runs before AdminAuthGuard on the route', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        RepresentativeCommissionAdminController.prototype.close
      );
      expect(guards[0]).toBe(DevOnlyGuard);
      expect(guards).toHaveLength(2);
    });
  });

  describe('controller', () => {
    const commissions = { closeMonthForAdmin: jest.fn() };
    const users = { getUser: jest.fn() };
    const rbac = { getEffectiveAccess: jest.fn() };
    const controller = new RepresentativeCommissionAdminController(
      commissions as never,
      users as never,
      rbac as never
    );
    beforeEach(() => {
      jest.resetAllMocks();
      users.getUser.mockResolvedValue({ id: 'u1' });
    });

    it('rejects a platform admin who is not superuser', async () => {
      rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: false, roles: ['ops'], permissions: ['x'] });
      await expect(controller.close('2026-09')).rejects.toBeInstanceOf(ForbiddenException);
      expect(commissions.closeMonthForAdmin).not.toHaveBeenCalled();
    });

    it('rejects when there is no user', async () => {
      users.getUser.mockResolvedValue(null);
      await expect(controller.close()).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets a superuser close a period', async () => {
      rbac.getEffectiveAccess.mockResolvedValue({ isSuperuser: true, roles: [], permissions: [] });
      commissions.closeMonthForAdmin.mockResolvedValue({ closed: 1 });
      await expect(controller.close('2026-09')).resolves.toEqual({ closed: 1 });
      expect(commissions.closeMonthForAdmin).toHaveBeenCalledWith('2026-09');
    });
  });

  describe('parseAdminPeriod', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    it('maps YYYY-MM to Douala month bounds', () => {
      expect(parseAdminPeriod('2026-09', now)).toEqual({ start: '2026-09-01', end: '2026-10-01' });
      expect(parseAdminPeriod('2025-12', now)).toEqual({ start: '2025-12-01', end: '2026-01-01' });
    });
    it.each(['2026-13', '2026-9', 'sept', '2026-09-01', '2026-11'])('rejects %s', (value) => {
      expect(() => parseAdminPeriod(value, now)).toThrow(BadRequestException);
    });
  });

  describe('closeMonthForAdmin', () => {
    const build = () => {
      const svc = new RepresentativeCommissionService(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never
      );
      return svc as any;
    };

    it('parallel same-period calls share one close run', async () => {
      const svc = build();
      let release!: (n: number) => void;
      svc.closePeriodOnce = jest.fn(
        () => new Promise<number>((resolve) => (release = resolve))
      );

      const a = svc.closeMonthForAdmin('2026-09');
      const b = svc.closeMonthForAdmin('2026-09');
      release(3);

      const [ra, rb] = await Promise.all([a, b]);
      expect(svc.closePeriodOnce).toHaveBeenCalledTimes(1);
      expect(ra).toEqual({ period: { start: '2026-09-01', end: '2026-10-01' }, closed: 3, joined: false });
      expect(rb.joined).toBe(true);
      expect(rb.closed).toBe(3);
    });

    it('a later call runs again and the run lock is released on error', async () => {
      const svc = build();
      svc.closePeriodOnce = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(0);

      await expect(svc.closeMonthForAdmin('2026-09')).rejects.toThrow('boom');
      await expect(svc.closeMonthForAdmin('2026-09')).resolves.toMatchObject({ closed: 0 });
      expect(svc.closePeriodOnce).toHaveBeenCalledTimes(2);
    });

    it('the cron and the admin trigger share the lock for the same month', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-13T12:00:00Z'));
      try {
        const svc = build();
        let release!: (n: number) => void;
        svc.closePeriodOnce = jest.fn(() => new Promise<number>((r) => (release = r)));
        const cron = svc.closePreviousMonth();
        const admin = svc.closeMonthForAdmin();
        release(2);
        await expect(cron).resolves.toBe(2);
        await expect(admin).resolves.toMatchObject({ closed: 2, joined: true });
        expect(svc.closePeriodOnce).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('a second (sequential) close of a credited statement is a no-op', async () => {
      const svc = build();
      svc.closeAllowed = jest.fn().mockResolvedValue(true);
      svc.loadStatement = jest.fn().mockResolvedValue({ id: 's1', status: 'credited' });
      svc.gridForPeriod = jest.fn();
      svc.finishClose = jest.fn();
      svc.agentsWithAccruals = jest.fn().mockResolvedValue([{ agent_id: 'a1', currency: 'XAF' }]);
      svc.premiumAgents = jest.fn().mockResolvedValue([]);
      svc.agentsWithOpenStatements = jest.fn().mockResolvedValue([]);

      await expect(svc.closeMonthForAdmin('2026-09')).resolves.toMatchObject({ closed: 0 });
      expect(svc.finishClose).not.toHaveBeenCalled();
    });

    it('a parallel loser whose statement insert hit the period key pays nothing', async () => {
      const svc = build();
      svc.insertStatement = jest.fn().mockResolvedValue(null);
      svc.payStatement = jest.fn();
      svc.recordPremiums = jest.fn();
      const closed = await svc.finishClose('a1', 'XAF', { start: '2026-09-01', end: '2026-10-01' }, { id: 'g', holdDays: 90 }, { month: {}, premiums: [] });
      expect(closed).toBe(0);
      expect(svc.payStatement).not.toHaveBeenCalled();
      expect(svc.recordPremiums).not.toHaveBeenCalled();
    });
  });
});
