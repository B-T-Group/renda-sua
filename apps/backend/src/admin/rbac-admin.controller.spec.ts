import 'reflect-metadata';
import { HttpException, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { RbacAdminController } from './rbac-admin.controller';
import { ScopedGrantError } from '../rbac/scoped-roles.service';

function make(setScopedRoles: jest.Mock) {
  return new RbacAdminController(
    {} as any,
    { setScopedRoles } as any,
    { getUser: jest.fn().mockResolvedValue({ id: 'su' }) } as any,
    {} as any,
    {} as any
  );
}
const ctx = {} as any;
const U = '11111111-1111-4111-8111-111111111111';

describe('RbacAdminController.setScopedRoles errors (F-CA3)', () => {
  it('shows our own validation message', async () => {
    const c = make(jest.fn().mockRejectedValue(new ScopedGrantError('Unknown country: ZZ')));
    await expect(c.setScopedRoles(ctx, U, { grants: [] } as any)).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { message: 'Unknown country: ZZ' },
    });
  });
  it('never leaks raw database text', async () => {
    const raw = 'Uniqueness violation. duplicate key value violates unique constraint "user_roles_user_role_country_key"';
    const c = make(jest.fn().mockRejectedValue(new Error(raw)));
    const err: HttpException = await c.setScopedRoles(ctx, U, { grants: [] } as any).catch((e) => e);
    expect(err.getStatus()).toBe(400);
    expect(JSON.stringify(err.getResponse())).not.toContain('constraint');
    expect(JSON.stringify(err.getResponse())).toContain('Failed to set scoped roles');
  });
  it('passes a 404 through', async () => {
    const { NotFoundException } = jest.requireActual('@nestjs/common');
    const c = make(jest.fn().mockRejectedValue(new NotFoundException('User not found')));
    await expect(c.setScopedRoles(ctx, U, { grants: [] } as any)).rejects.toMatchObject({ status: 404 });
  });
  it('userId must be a UUID', async () => {
    await expect(new ParseUUIDPipe().transform('not-a-uuid', { type: 'param' })).rejects.toMatchObject({ status: 400 });
    // the route actually uses the pipe
    const params = Reflect.getMetadata('__routeArguments__', RbacAdminController, 'setScopedRoles');
    const withPipe = Object.values(params as Record<string, any>).filter((p: any) => p.pipes?.length);
    expect(withPipe.length).toBeGreaterThan(0);
  });
});
