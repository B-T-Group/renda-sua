import { HttpException, HttpStatus } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  assertMobileLocationConsentAccepted,
  parseLocationConsentPlatformHeader,
} from './agent-location-claim.util';

describe('agent-location-claim.util', () => {
  let hasuraSystemService: jest.Mocked<
    Pick<HasuraSystemService, 'getAgentLocationConsent'>
  >;

  beforeEach(() => {
    hasuraSystemService = { getAgentLocationConsent: jest.fn() };
  });

  describe('parseLocationConsentPlatformHeader', () => {
    it('normalizes supported platforms from request headers', () => {
      expect(parseLocationConsentPlatformHeader(' iOS ')).toBe('ios');
      expect(parseLocationConsentPlatformHeader('ANDROID')).toBe('android');
      expect(parseLocationConsentPlatformHeader('web')).toBe('web');
    });

    it('ignores missing or unsupported request headers', () => {
      expect(parseLocationConsentPlatformHeader(undefined)).toBeUndefined();
      expect(parseLocationConsentPlatformHeader('desktop')).toBeUndefined();
    });
  });

  describe('assertMobileLocationConsentAccepted', () => {
    it('does not query consent for missing, invalid, or web platform headers', async () => {
      await assertMobileLocationConsentAccepted(
        hasuraSystemService as unknown as HasuraSystemService,
        'agent-1',
        undefined
      );
      await assertMobileLocationConsentAccepted(
        hasuraSystemService as unknown as HasuraSystemService,
        'agent-1',
        'web'
      );
      await assertMobileLocationConsentAccepted(
        hasuraSystemService as unknown as HasuraSystemService,
        'agent-1',
        'desktop'
      );

      expect(hasuraSystemService.getAgentLocationConsent).not.toHaveBeenCalled();
    });

    it('allows mobile claims when platform consent is accepted', async () => {
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue('accepted');

      await expect(
        assertMobileLocationConsentAccepted(
          hasuraSystemService as unknown as HasuraSystemService,
          'agent-1',
          ' android '
        )
      ).resolves.toBeUndefined();
      expect(hasuraSystemService.getAgentLocationConsent).toHaveBeenCalledWith(
        'agent-1',
        'android'
      );
    });

    it('blocks mobile claims when platform consent is not accepted', async () => {
      hasuraSystemService.getAgentLocationConsent.mockResolvedValue('deferred');

      await expect(
        assertMobileLocationConsentAccepted(
          hasuraSystemService as unknown as HasuraSystemService,
          'agent-1',
          'ios'
        )
      ).rejects.toThrow(
        new HttpException(
          {
            success: false,
            error:
              'Location tracking consent is required to claim orders. Accept location disclosure and enable location permissions in the app.',
            errorCode: 'LOCATION_CONSENT_REQUIRED',
          },
          HttpStatus.FORBIDDEN
        )
      );
    });
  });
});
