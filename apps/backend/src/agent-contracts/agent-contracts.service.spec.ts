import { AgentContractsService } from './agent-contracts.service';
import { AgentContractProfileService } from './agent-contract-profile.service';

describe('AgentContractsService webhook', () => {
  it('marks the agent contract signed when BoldSign completes it', async () => {
    const contract = {
      id: 'c1',
      agent_id: 'a1',
      status: 'sent',
      boldsign_document_id: 'doc-1',
    };
    const db = {
      getByDocumentId: jest.fn().mockResolvedValue(contract),
      updateContract: jest.fn().mockResolvedValue(undefined),
    };
    const artifacts = { storeSigned: jest.fn().mockResolvedValue(undefined) };
    const profiles = { verifyEmailAfterSign: jest.fn().mockResolvedValue(undefined) };
    const service = new AgentContractsService(
      db as never,
      {} as never,
      profiles as never,
      {} as never,
      artifacts as never,
      {} as never
    );

    await service.handleWebhookEvent({
      event: { eventType: 'Completed' },
      data: { documentId: 'doc-1' },
    });

    expect(artifacts.storeSigned).toHaveBeenCalledWith(contract);
    expect(db.updateContract).toHaveBeenCalledWith('c1', {
      status: 'signed',
      signed_at: expect.any(String),
    });
    expect(profiles.verifyEmailAfterSign).toHaveBeenCalledWith('a1', undefined);
  });

  it('ignores documents that are not agent contracts', async () => {
    const db = {
      getByDocumentId: jest.fn().mockResolvedValue(null),
      updateContract: jest.fn(),
    };
    const service = new AgentContractsService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      { storeSigned: jest.fn() } as never,
      {} as never
    );
    await service.handleWebhookEvent({
      event: { eventType: 'Completed' },
      data: { documentId: 'other' },
    });
    expect(db.updateContract).not.toHaveBeenCalled();
  });
});

describe('AgentContractsService ensure', () => {
  const profile = {
    userId: 'u1',
    agentId: 'a1',
    agentCode: 'X1',
    email: 'agent@example.com',
    phone: '+237600000000',
    signerName: 'Sam Agent',
    preferredLanguage: 'en',
    country: 'CA',
    addressCountry: null,
    addressLine: null,
    city: null,
    referralCode: null,
  };

  it('reuses nationality from the failed prefill when retrying without a body', async () => {
    const failed = {
      id: 'c-failed',
      agent_id: 'a1',
      status: 'failed',
      boldsign_document_id: 'doc-failed',
      prefill_snapshot: { nationality: 'Canadian' },
    };
    const db = {
      getInFlight: jest.fn().mockResolvedValue(null),
      getLatest: jest.fn().mockResolvedValue(failed),
      hasSigned: jest.fn().mockResolvedValue(false),
      insertContract: jest.fn().mockImplementation(async (row) => ({
        id: 'c-new',
        ...row,
      })),
      updateContract: jest.fn().mockResolvedValue(undefined),
    };
    const boldsign = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendUsingTemplate: jest.fn().mockResolvedValue({ documentId: 'doc-new' }),
    };
    const service = new AgentContractsService(
      db as never,
      { isRequired: jest.fn().mockResolvedValue(true) } as never,
      { forUser: jest.fn().mockResolvedValue(profile) } as never,
      boldsign as never,
      {} as never,
      { get: jest.fn().mockReturnValue({ expirationDays: 30, reminderIntervalDays: 3 }) } as never
    );

    await service.ensureForUser('u1');

    const fields = boldsign.sendUsingTemplate.mock.calls[0][0].existingFormFields;
    expect(fields).toEqual(
      expect.arrayContaining([{ id: 'rep_nationality', value: 'Canadian' }])
    );
  });

  it('sends the French Canada template when the agent chooses French', async () => {
    const db = {
      getInFlight: jest.fn().mockResolvedValue(null),
      getLatest: jest.fn().mockResolvedValue(null),
      hasSigned: jest.fn().mockResolvedValue(false),
      insertContract: jest.fn().mockImplementation(async (row) => ({ id: 'c-new', ...row })),
      updateContract: jest.fn().mockResolvedValue(undefined),
    };
    const boldsign = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendUsingTemplate: jest.fn().mockResolvedValue({ documentId: 'doc-fr' }),
    };
    const service = new AgentContractsService(
      db as never,
      { isRequired: jest.fn().mockResolvedValue(true) } as never,
      { forUser: jest.fn().mockResolvedValue(profile) } as never,
      boldsign as never,
      {} as never,
      { get: jest.fn().mockReturnValue({ expirationDays: 30, reminderIntervalDays: 3 }) } as never
    );

    await service.ensureForUser('u1', {
      language: 'fr',
      nationality: 'Canadian',
      idNumber: 'AB123',
    });

    expect(boldsign.sendUsingTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'a6d79255-d0d4-4b02-b218-d55a8dcd367b',
      })
    );
  });
});

describe('AgentContractsService status', () => {
  const profile = {
    userId: 'u1',
    agentId: 'a1',
    agentCode: 'X1',
    email: 'agent@example.com',
    phone: '+237600000000',
    signerName: 'Sam Agent',
    preferredLanguage: 'en',
    country: 'CM',
    addressCountry: null,
    addressLine: null,
    city: null,
    referralCode: null,
  };

  function serviceFor(latest: Record<string, unknown> | null, inFlight?: Record<string, unknown> | null) {
    const db = {
      getInFlight: jest.fn().mockResolvedValue(inFlight ?? null),
      getLatest: jest.fn().mockResolvedValue(latest),
      hasSigned: jest.fn().mockResolvedValue(false),
      insertContract: jest.fn().mockImplementation(async (row) => ({ id: 'c-new', ...row })),
      updateContract: jest.fn().mockResolvedValue(undefined),
    };
    const boldsign = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendUsingTemplate: jest.fn().mockResolvedValue({ documentId: 'doc-new' }),
    };
    const service = new AgentContractsService(
      db as never,
      { isRequired: jest.fn().mockResolvedValue(true) } as never,
      { forUser: jest.fn().mockResolvedValue(profile) } as never,
      boldsign as never,
      {} as never,
      { get: jest.fn().mockReturnValue({ expirationDays: 30, reminderIntervalDays: 3 }) } as never
    );
    return { service, boldsign, db };
  }

  it('does not email until the agent confirms language on the agreement screen', async () => {
    const { service, boldsign } = serviceFor(null);
    await service.statusForUser('u1');
    expect(boldsign.sendUsingTemplate).not.toHaveBeenCalled();
  });

  it('does not send again when the latest contract already failed', async () => {
    const { service, boldsign, db } = serviceFor({
      id: 'c-failed',
      status: 'failed',
      boldsign_document_id: 'doc-failed',
      prefill_snapshot: { nationality: 'Cameroonian' },
    });
    await service.statusForUser('u1');
    expect(boldsign.sendUsingTemplate).not.toHaveBeenCalled();
    expect(db.insertContract).not.toHaveBeenCalled();
  });

  it('does not resend an in-flight pending document on status', async () => {
    const { service, boldsign } = serviceFor(null, {
      id: 'c-pending',
      status: 'not_sent',
      boldsign_document_id: 'pending:a1:1',
      prefill_snapshot: {},
    });
    await service.statusForUser('u1');
    expect(boldsign.sendUsingTemplate).not.toHaveBeenCalled();
  });
});

describe('AgentContractProfileService.verifyEmailAfterSign', () => {
  function serviceFor(user: Record<string, unknown> | null) {
    const hasura = {
      executeQuery: jest.fn().mockResolvedValue({
        agents_by_pk: user ? { user } : null,
      }),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    return { hasura, profiles: new AgentContractProfileService(hasura as never) };
  }

  it('marks the matching unverified email as verified', async () => {
    const { hasura, profiles } = serviceFor({
      id: 'u1',
      email: 'agent@example.com',
      email_verified: false,
    });
    await profiles.verifyEmailAfterSign('a1', 'Agent@example.com');
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('email_verified: true'),
      { id: 'u1' }
    );
  });

  it('does not verify a different email than the one that signed', async () => {
    const { hasura, profiles } = serviceFor({
      id: 'u1',
      email: 'new@example.com',
      email_verified: false,
    });
    await profiles.verifyEmailAfterSign('a1', 'old@example.com');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('leaves an already verified email unchanged', async () => {
    const { hasura, profiles } = serviceFor({
      id: 'u1',
      email: 'agent@example.com',
      email_verified: true,
    });
    await profiles.verifyEmailAfterSign('a1', 'agent@example.com');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});
