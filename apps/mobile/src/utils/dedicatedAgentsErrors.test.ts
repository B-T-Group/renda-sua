import { describe, it, expect } from 'vitest';
import {
  shouldHideOnError,
  shouldShowGate,
  mapDedicatedAgentsErrorCode,
  extractDedicatedAgentsError,
  isDedicatedAgentsFeatureHidden,
} from './dedicatedAgentsErrors';

describe('dedicatedAgentsErrors', () => {

  describe('shouldHideOnError', () => {
    it('should hide on 404', () => {
      expect(shouldHideOnError(404, undefined, undefined)).toBe(true);
    });

    it('should not hide on 403 no_address', () => {
      expect(shouldHideOnError(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_address')).toBe(false);
    });

    it('should not hide on 403 no_country', () => {
      expect(shouldHideOnError(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_country')).toBe(false);
    });

    it('should not hide on other status codes', () => {
      expect(shouldHideOnError(500, undefined, undefined)).toBe(false);
      expect(shouldHideOnError(401, undefined, undefined)).toBe(false);
    });
  });

  describe('shouldShowGate', () => {
    it('should show gate for not_verified', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'not_verified')).toBe(true);
    });

    it('should show gate for contract_unsigned', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'contract_unsigned')).toBe(true);
    });

    it('should show gate for suspended', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'suspended')).toBe(true);
    });

    it('should not show gate for no_address', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_address')).toBe(false);
    });

    it('should not show gate for no_country', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_country')).toBe(false);
    });

    it('should not show gate for non-403 status', () => {
      expect(shouldShowGate(404, undefined, undefined)).toBe(false);
      expect(shouldShowGate(500, undefined, undefined)).toBe(false);
    });
  });

  describe('mapDedicatedAgentsErrorCode', () => {
    it('maps posting conflict codes', () => {
      expect(mapDedicatedAgentsErrorCode('posting_filled')).toBe('errors.dedicated.posting_filled');
      expect(mapDedicatedAgentsErrorCode('posting_not_open')).toBe(
        'errors.dedicated.posting_not_open'
      );
      expect(mapDedicatedAgentsErrorCode('posting_expired')).toBe(
        'errors.dedicated.posting_not_open'
      );
      expect(mapDedicatedAgentsErrorCode('posting_already_open')).toBe(
        'errors.dedicated.posting_already_open'
      );
    });

    it('maps agent assignment conflict codes', () => {
      expect(mapDedicatedAgentsErrorCode('agent_holds_slot')).toBe(
        'errors.dedicated.agent_holds_slot'
      );
      expect(mapDedicatedAgentsErrorCode('dedicated_agent_assignment_cap_exceeded')).toBe(
        'errors.dedicated.cap_exceeded'
      );
    });

    it('maps slot state codes', () => {
      expect(mapDedicatedAgentsErrorCode('slot_disabled')).toBe('errors.dedicated.slot_disabled');
      expect(mapDedicatedAgentsErrorCode('assignment_removed')).toBe(
        'errors.dedicated.assignment_removed'
      );
      expect(mapDedicatedAgentsErrorCode('assignment_changed')).toBe(
        'errors.dedicated.assignment_changed'
      );
    });

    it('maps form validation codes', () => {
      expect(mapDedicatedAgentsErrorCode('pickup_time_outside_slot')).toBe(
        'errors.dedicated.pickup_time_outside_slot'
      );
      expect(mapDedicatedAgentsErrorCode('invalid_headcount')).toBe(
        'errors.dedicated.invalid_headcount'
      );
    });

    it('returns generic error for unknown code', () => {
      expect(mapDedicatedAgentsErrorCode('unknown_error')).toBe('errors.dedicated.generic');
    });
  });

  describe('extractDedicatedAgentsError', () => {
    it('extracts code from error object', () => {
      const error = {
        code: 'posting_filled',
        message: 'This request is already full',
      };

      const result = extractDedicatedAgentsError(error);
      expect(result.code).toBe('posting_filled');
      expect(result.message).toBe('This request is already full');
    });

    it('extracts code from nested response', () => {
      const error = {
        response: {
          data: {
            code: 'slot_disabled',
            message: 'Turn slot back on',
          },
        },
      };

      const result = extractDedicatedAgentsError(error);
      expect(result.code).toBe('slot_disabled');
    });

    it('extracts agentsToPause when present', () => {
      const error = {
        code: 'slot_has_dedicated_agents',
        agentsToPause: 3,
      };

      const result = extractDedicatedAgentsError(error);
      expect(result.agentsToPause).toBe(3);
    });

    it('returns null code for malformed error', () => {
      const result = extractDedicatedAgentsError({});
      expect(result.code).toBeNull();
    });
  });

  describe('isDedicatedAgentsFeatureHidden', () => {
    it('returns true for 404 status', () => {
      expect(
        isDedicatedAgentsFeatureHidden({
          status: 404,
        })
      ).toBe(true);

      expect(
        isDedicatedAgentsFeatureHidden({
          response: { status: 404 },
        })
      ).toBe(true);
    });

    it('returns true for 403 status', () => {
      expect(
        isDedicatedAgentsFeatureHidden({
          status: 403,
        })
      ).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(
        isDedicatedAgentsFeatureHidden({
          status: 400,
        })
      ).toBe(false);

      expect(
        isDedicatedAgentsFeatureHidden({
          status: 409,
        })
      ).toBe(false);
    });

    it('returns false for missing error', () => {
      expect(isDedicatedAgentsFeatureHidden(undefined)).toBe(false);
      expect(isDedicatedAgentsFeatureHidden({})).toBe(false);
    });
  });
});
