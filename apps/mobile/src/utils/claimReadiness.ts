import type { IdDocumentStatus } from '../hooks/useAgentVerificationStatus';
import {
  agentIdVerificationPending,
  agentNeedsIdUpload,
  agentNeedsMomoSetup,
} from './agentClaimSetupGate';

export type ClaimReadiness = {
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
};

type Input = {
  isStripeRail: boolean;
  isVerified: boolean;
  idDocumentStatus: IdDocumentStatus;
  locationReady: boolean;
};

/** One setup message, or null when the agent can claim work. */
export function resolveClaimReadiness(input: Input): ClaimReadiness | null {
  if (!input.locationReady) {
    return {
      titleKey: 'agent.readiness.locationTitle',
      titleDefault: 'Turn on location',
      bodyKey: 'agent.readiness.locationBody',
      bodyDefault: 'Location is required before you can go online and claim deliveries.',
    };
  }
  if (agentNeedsIdUpload(input)) {
    return {
      titleKey: 'agent.readiness.idTitle',
      titleDefault: 'Add your ID',
      bodyKey: 'agent.readiness.idBody',
      bodyDefault: 'Upload a government ID so you can claim deliveries.',
    };
  }
  if (agentNeedsMomoSetup(input)) {
    return {
      titleKey: 'agent.readiness.momoTitle',
      titleDefault: 'Finish Mobile Money',
      bodyKey: 'agent.readiness.momoBody',
      bodyDefault: 'Add a payout number to start claiming deliveries.',
    };
  }
  if (agentIdVerificationPending(input)) {
    return {
      titleKey: 'agent.readiness.pendingTitle',
      titleDefault: 'ID under review',
      bodyKey: 'agent.readiness.pendingBody',
      bodyDefault: 'You can claim deliveries once your ID is approved.',
    };
  }
  return null;
}
