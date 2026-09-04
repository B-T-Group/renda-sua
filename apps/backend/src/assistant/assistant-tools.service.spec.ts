import { AssistantToolsService } from './assistant-tools.service';
import type { AssistantIdentity } from './assistant.types';

describe('AssistantToolsService', () => {
  const hasura = { executeQuery: jest.fn() };
  const service = new AssistantToolsService(hasura as any);

  const anonymous: AssistantIdentity = {
    isVerified: false,
    userId: null,
    firstName: null,
    preferredLanguage: null,
    country: 'GA',
    phoneE164: '2416000000',
    accountType: null,
  };

  const verified: AssistantIdentity = {
    ...anonymous,
    isVerified: true,
    userId: 'u1',
    firstName: 'Ada',
    accountType: 'client',
  };

  it('exposes only knowledge + handoff tools for anonymous users', () => {
    const tools = service.buildToolConfig(anonymous).tools.map(
      (t) => t.toolSpec?.name
    );
    expect(tools).toEqual(['get_knowledge', 'request_human_support']);
  });

  it('adds client order tools only for client accounts', () => {
    const clientTools = service.buildToolConfig(verified).tools.map(
      (t) => t.toolSpec?.name
    );
    expect(clientTools).toContain('get_my_recent_orders');
    expect(clientTools).toContain('get_order_status');

    const businessTools = service
      .buildToolConfig({ ...verified, accountType: 'business' })
      .tools.map((t) => t.toolSpec?.name);
    expect(businessTools).not.toContain('get_my_recent_orders');
    expect(businessTools).not.toContain('get_order_status');
    expect(businessTools).toContain('get_my_addresses');
    expect(businessTools).toContain('get_my_profile_summary');
  });

  it('adds user-scoped tools for verified clients', () => {
    const tools = service.buildToolConfig(verified).tools.map(
      (t) => t.toolSpec?.name
    );
    expect(tools).toContain('get_my_recent_orders');
    expect(tools).toContain('get_order_status');
    expect(tools).toContain('get_my_addresses');
    expect(tools).toContain('get_my_profile_summary');
  });

  it('returns curated knowledge for payments', async () => {
    const result = await service.executeTool({
      name: 'get_knowledge',
      input: { topic: 'payments', country: 'CM' },
      identity: anonymous,
      locale: 'en',
    });
    expect(result.content).toMatch(/MTN Mobile Money/i);
    expect(result.content).toMatch(/Cameroon/i);
  });

  it('marks human support as handoff', async () => {
    const result = await service.executeTool({
      name: 'request_human_support',
      input: { reason: 'unknown', issue_type: 'no_answer' },
      identity: anonymous,
      locale: 'en',
    });
    expect(result.handoff).toBe(true);
    expect(result.content).toMatch(/get back/i);
  });
});
