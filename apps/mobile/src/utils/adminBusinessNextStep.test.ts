import { formatBusinessNextStep } from './adminBusinessNextStep';

const t = (key: string, defaultValue: string, options?: Record<string, string>) => {
  if (options?.step) return defaultValue.replace('{{step}}', options.step);
  return defaultValue;
};

describe('formatBusinessNextStep', () => {
  it('asks for signed contract when lifecycle is created', () => {
    const text = formatBusinessNextStep(
      {
        lifecycle_status: 'created',
        verificationSummary: {
          contractStatus: 'missing',
          contractComplete: false,
          idDocumentStatus: 'missing',
          blockers: ['missing_signed_contract'],
        },
      },
      t
    );
    expect(text).toContain('Draft');
    expect(text).toContain('signed contract');
  });

  it('does not ask for contract when created but contract is already complete', () => {
    const text = formatBusinessNextStep(
      {
        lifecycle_status: 'created',
        verificationSummary: {
          contractStatus: 'signed',
          contractComplete: true,
          idDocumentStatus: 'missing',
          blockers: ['missing_payment_verification'],
        },
      },
      t
    );
    expect(text).toContain('Draft');
    expect(text).toContain('verified badge');
    expect(text).not.toContain('signed contract');
  });

  it('does not invent a payment blocker when contract and payment are done', () => {
    const text = formatBusinessNextStep(
      {
        lifecycle_status: 'created',
        verificationSummary: {
          contractStatus: 'signed',
          contractComplete: true,
          idDocumentStatus: 'approved',
          blockers: [],
        },
      },
      t
    );
    expect(text).toContain('updating');
    expect(text).not.toContain('payment verification');
  });

  it('asks for ID upload when contract signed and MoMo ID missing', () => {
    const text = formatBusinessNextStep(
      {
        lifecycle_status: 'contract_signed',
        verificationSummary: {
          contractStatus: 'signed',
          contractComplete: true,
          idDocumentStatus: 'missing',
          rail: 'mobile_money',
        },
      },
      t
    );
    expect(text).toContain('upload ID');
  });

  it('returns null for active businesses', () => {
    expect(
      formatBusinessNextStep(
        {
          lifecycle_status: 'active',
          verificationSummary: {
            contractStatus: 'signed',
            contractComplete: true,
            idDocumentStatus: 'approved',
          },
        },
        t
      )
    ).toBeNull();
  });
});
