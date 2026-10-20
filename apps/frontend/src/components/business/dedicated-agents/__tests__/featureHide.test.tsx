import { isDedicatedAgentsFeatureHidden } from '../../../../utils/dedicatedAgentsErrors';

describe('Permission/Probe Hide Logic', () => {
  describe('isDedicatedAgentsFeatureHidden', () => {
    it('returns true for 404 status (feature off)', () => {
      const error = {
        response: {
          status: 404,
        },
      };

      expect(isDedicatedAgentsFeatureHidden(error)).toBe(true);
    });

    it('returns true for 403 status (no permission)', () => {
      const error = {
        response: {
          status: 403,
        },
      };

      expect(isDedicatedAgentsFeatureHidden(error)).toBe(true);
    });

    it('returns false for 400 status (validation error)', () => {
      const error = {
        response: {
          status: 400,
        },
      };

      expect(isDedicatedAgentsFeatureHidden(error)).toBe(false);
    });

    it('returns false for 409 status (conflict)', () => {
      const error = {
        response: {
          status: 409,
        },
      };

      expect(isDedicatedAgentsFeatureHidden(error)).toBe(false);
    });

    it('returns false for 500 status (server error)', () => {
      const error = {
        response: {
          status: 500,
        },
      };

      expect(isDedicatedAgentsFeatureHidden(error)).toBe(false);
    });

    it('returns false for missing error object', () => {
      expect(isDedicatedAgentsFeatureHidden(undefined)).toBe(false);
      expect(isDedicatedAgentsFeatureHidden(null)).toBe(false);
      expect(isDedicatedAgentsFeatureHidden({})).toBe(false);
    });

    it('returns false for error without response', () => {
      const error = {
        message: 'Network error',
      };

      expect(isDedicatedAgentsFeatureHidden(error)).toBe(false);
    });
  });

  describe('Feature Hide Use Cases', () => {
    it('hides section when probe returns 404 (flag off)', () => {
      const probeError = {
        response: {
          status: 404,
          data: {
            message: 'Not found',
          },
        },
      };

      const shouldHide = isDedicatedAgentsFeatureHidden(probeError);
      expect(shouldHide).toBe(true);
    });

    it('hides section when probe returns 403 (no permission)', () => {
      const probeError = {
        response: {
          status: 403,
          data: {
            message: 'Forbidden',
          },
        },
      };

      const shouldHide = isDedicatedAgentsFeatureHidden(probeError);
      expect(shouldHide).toBe(true);
    });

    it('shows error state for other failures', () => {
      const networkError = {
        response: {
          status: 500,
          data: {
            message: 'Internal server error',
          },
        },
      };

      const shouldHide = isDedicatedAgentsFeatureHidden(networkError);
      expect(shouldHide).toBe(false);
    });
  });
});
