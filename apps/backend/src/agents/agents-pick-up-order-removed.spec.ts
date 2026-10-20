import { readFileSync } from 'fs';
import { join } from 'path';
import { PATH_METADATA } from '@nestjs/common/constants';

jest.mock('../commissions/commissions.service', () => ({ CommissionsService: jest.fn() }));
jest.mock('../hasura/hasura-system.service', () => ({ HasuraSystemService: jest.fn() }));
jest.mock('../hasura/hasura-user.service', () => ({ HasuraUserService: jest.fn() }));
jest.mock('./agent-hold.service', () => ({ AgentHoldService: jest.fn() }));
jest.mock('./agent-referrals.service', () => ({ AgentReferralsService: jest.fn() }));

import { AgentsController } from './agents.controller';

// POST /agents/pick_up_order assigned any order to the calling agent as system, with no
// status check and no hold. Agents claim through /orders/claim and pick up via /orders/pick_up.
describe('POST /agents/pick_up_order is removed', () => {
  it('no AgentsController handler is routed at pick_up_order', () => {
    const proto = AgentsController.prototype as any;
    const routes = Object.getOwnPropertyNames(proto)
      .map((k) => Reflect.getMetadata(PATH_METADATA, proto[k]))
      .filter((p) => p !== undefined);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes).not.toContain('pick_up_order');
    expect(proto.pickUpOrder).toBeUndefined();
  });

  it('the source no longer declares the route', () => {
    const src = readFileSync(join(__dirname, 'agents.controller.ts'), 'utf8');
    expect(src).not.toMatch(/['"]\/?pick_up_order['"]/);
  });
});
