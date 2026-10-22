import {
  mapDedicatedAgentsErrorCode,
  extractDedicatedAgentsError,
  isDedicatedAgentsFeatureHidden,
} from './dedicatedAgentsErrors';

describe('dedicatedAgentsErrors', () => {
  describe('mapDedicatedAgentsErrorCode', () => {
    it('maps posting conflict codes', () => {
      expect(mapDedicatedAgentsErrorCode('posting_filled')).toBe('dedicatedAgents.errors.posting_filled');
      expect(mapDedicatedAgentsErrorCode('posting_not_open')).toBe(
        'dedicatedAgents.errors.posting_not_open'
      );
      expect(mapDedicatedAgentsErrorCode('posting_expired')).toBe(
        'dedicatedAgents.errors.posting_not_open'
      );
      expect(mapDedicatedAgentsErrorCode('posting_already_open')).toBe(
        'dedicatedAgents.errors.posting_already_open'
      );
      expect(mapDedicatedAgentsErrorCode('application_closed')).toBe(
        'dedicatedAgents.errors.posting_not_open'
      );
      expect(mapDedicatedAgentsErrorCode('application_not_pending')).toBe(
        'dedicatedAgents.errors.application_not_pending'
      );
    });

    it('maps agent assignment conflict codes', () => {
      expect(mapDedicatedAgentsErrorCode('agent_holds_slot')).toBe(
        'dedicatedAgents.errors.agent_holds_slot'
      );
      expect(mapDedicatedAgentsErrorCode('dedicated_agent_assignment_cap_exceeded')).toBe(
        'dedicatedAgents.errors.cap_exceeded'
      );
      expect(mapDedicatedAgentsErrorCode('dedicated_agent_assignment_duplicate')).toBe(
        'dedicatedAgents.errors.duplicate'
      );
      expect(mapDedicatedAgentsErrorCode('agent_not_verified')).toBe(
        'dedicatedAgents.errors.agent_not_verified'
      );
      expect(mapDedicatedAgentsErrorCode('agent_suspended')).toBe(
        'dedicatedAgents.errors.agent_suspended'
      );
      expect(mapDedicatedAgentsErrorCode('agent_ineligible')).toBe(
        'dedicatedAgents.errors.agent_ineligible'
      );
    });

    it('maps slot/assignment state codes', () => {
      expect(mapDedicatedAgentsErrorCode('slot_disabled')).toBe('dedicatedAgents.errors.slot_disabled');
      expect(mapDedicatedAgentsErrorCode('assignment_removed')).toBe(
        'dedicatedAgents.errors.assignment_removed'
      );
      expect(mapDedicatedAgentsErrorCode('assignment_changed')).toBe(
        'dedicatedAgents.errors.assignment_changed'
      );
      expect(mapDedicatedAgentsErrorCode('slot_has_dedicated_agents')).toBe(
        'dedicatedAgents.errors.slot_has_dedicated_agents'
      );
    });

    it('maps form validation codes', () => {
      expect(mapDedicatedAgentsErrorCode('pickup_time_outside_slot')).toBe(
        'dedicatedAgents.errors.pickup_time_outside_slot'
      );
      expect(mapDedicatedAgentsErrorCode('invalid_headcount')).toBe(
        'dedicatedAgents.errors.invalid_headcount'
      );
      expect(mapDedicatedAgentsErrorCode('invalid_slot_keys')).toBe(
        'dedicatedAgents.errors.invalid_slot_keys'
      );
      expect(mapDedicatedAgentsErrorCode('invalid_days_of_week')).toBe(
        'dedicatedAgents.errors.invalid_days_of_week'
      );
      expect(mapDedicatedAgentsErrorCode('terms_too_long')).toBe(
        'dedicatedAgents.errors.terms_too_long'
      );
    });

    it('returns generic error for unknown code', () => {
      expect(mapDedicatedAgentsErrorCode('unknown_error')).toBe('dedicatedAgents.errors.generic');
      expect(mapDedicatedAgentsErrorCode('')).toBe('dedicatedAgents.errors.generic');
    });
  });

  describe('extractDedicatedAgentsError', () => {
    it('extracts code and message from error response', () => {
      const error = {
        response: {
          data: {
            code: 'posting_filled',
            message: 'This request is already full',
          },
        },
      };

      const result = extractDedicatedAgentsError(error);
      expect(result.code).toBe('posting_filled');
      expect(result.message).toBe('This request is already full');
    });

    it('extracts agentsToPause when present', () => {
      const error = {
        response: {
          data: {
            code: 'slot_has_dedicated_agents',
            message: 'Turn off {{slot}}?',
            agentsToPause: 3,
          },
        },
      };

      const result = extractDedicatedAgentsError(error);
      expect(result.agentsToPause).toBe(3);
    });

    it('returns null code and default message for malformed error', () => {
      const error = {};
      const result = extractDedicatedAgentsError(error);
      expect(result.code).toBeNull();
      expect(result.message).toBe('An error occurred');
    });

    it('handles undefined error', () => {
      const result = extractDedicatedAgentsError(undefined);
      expect(result.code).toBeNull();
      expect(result.message).toBe('An error occurred');
    });
  });

  describe('isDedicatedAgentsFeatureHidden', () => {
    it('returns true for 404 status', () => {
      const error = {
        response: {
          status: 404,
        },
      };
      expect(isDedicatedAgentsFeatureHidden(error)).toBe(true);
    });

    it('returns true for 403 status', () => {
      const error = {
        response: {
          status: 403,
        },
      };
      expect(isDedicatedAgentsFeatureHidden(error)).toBe(true);
    });

    it('returns false for other statuses', () => {
      expect(
        isDedicatedAgentsFeatureHidden({
          response: { status: 400 },
        })
      ).toBe(false);

      expect(
        isDedicatedAgentsFeatureHidden({
          response: { status: 409 },
        })
      ).toBe(false);

      expect(
        isDedicatedAgentsFeatureHidden({
          response: { status: 500 },
        })
      ).toBe(false);
    });

    it('returns false for missing error', () => {
      expect(isDedicatedAgentsFeatureHidden(undefined)).toBe(false);
      expect(isDedicatedAgentsFeatureHidden({})).toBe(false);
    });
  });
});
