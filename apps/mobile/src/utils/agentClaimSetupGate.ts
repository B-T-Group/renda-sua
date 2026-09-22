import type { IdDocumentStatus } from '../hooks/useAgentVerificationStatus';

type AgentClaimGateInput = {
  isStripeRail: boolean;
  isVerified: boolean;
  idDocumentStatus: IdDocumentStatus;
};

/**
 * MoMo agents need a government ID before claiming. Approved docs still leave
 * `is_verified` false until payout phone setup is done — that is not an ID upload.
 */
export function agentNeedsIdUpload(input: AgentClaimGateInput): boolean {
  return (
    !input.isStripeRail &&
    !input.isVerified &&
    (input.idDocumentStatus === 'missing' ||
      input.idDocumentStatus === 'rejected')
  );
}

/** ID approved on MoMo rail but agent not verified yet → finish mobile money / payout. */
export function agentNeedsMomoSetup(input: AgentClaimGateInput): boolean {
  return (
    !input.isStripeRail &&
    !input.isVerified &&
    input.idDocumentStatus === 'approved'
  );
}

export function agentIdVerificationPending(input: AgentClaimGateInput): boolean {
  return (
    !input.isStripeRail &&
    !input.isVerified &&
    input.idDocumentStatus === 'pending'
  );
}
