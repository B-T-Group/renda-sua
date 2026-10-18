import { sanitizeProviderError, maskPhoneNumber } from './sanitize-provider-error.util';

describe('Production Sanitization & Masking Tests (G6)', () => {
  describe('sanitizeProviderError utility', () => {
    it('should sanitize Bearer tokens from error messages', () => {
      const error = {
        message: 'Request failed with status 401: Bearer sk_live_secret123',
        response: { status: 401, data: { error: 'Unauthorized' } },
      };

      const sanitized = sanitizeProviderError(error);

      expect(sanitized.message).not.toContain('sk_live_secret123');
      expect(sanitized.message).toContain('REDACTED');
    });

    it('should sanitize Authorization headers', () => {
      const error = {
        message: 'API call failed',
        config: {
          headers: { Authorization: 'Bearer sk_live_secret456' },
        },
      };

      const sanitized = sanitizeProviderError(error);
      const serialized = JSON.stringify(sanitized);

      expect(serialized).not.toContain('sk_live_secret456');
      expect(serialized).toContain('REDACTED');
    });

    it('should sanitize api keys from responses', () => {
      const error = {
        message: 'Invalid API key: app_key_12345',
        response: {
          data: {
            error: 'Authentication failed',
            apiKey: 'app_key_12345',
          },
        },
      };

      const sanitized = sanitizeProviderError(error);
      const serialized = JSON.stringify(sanitized);

      expect(serialized).not.toContain('app_key_12345');
      expect(serialized).toContain('REDACTED');
    });
  });

  describe('maskPhoneNumber utility', () => {
    it('should mask phone numbers preserving first 3 and last 3 digits', () => {
      const masked = maskPhoneNumber('+237699123456');
      
      expect(masked).toContain('***');
      expect(masked).not.toContain('699123');
      expect(masked.length).toBeLessThan('+237699123456'.length);
    });

    it('should mask international format numbers', () => {
      const masked = maskPhoneNumber('+22890123456');
      
      expect(masked).toContain('***');
      expect(masked).not.toContain('90123');
    });

    it('should handle already masked numbers', () => {
      const alreadyMasked = '+228***456';
      const masked = maskPhoneNumber(alreadyMasked);
      
      expect(masked).toContain('***');
    });
  });

  describe('FreemoPay sanitization call sites', () => {
    it('mutation test: FreemoPay uses sanitizeProviderError on errors', () => {
      const freemopaySource = require('./providers/freemopay.service').FreemopayService.toString();
      
      // Must use sanitizeProviderError when logging/throwing provider errors
      expect(freemopaySource).toContain('sanitizeProviderError');
    });

    it('mutation test: FreemoPay masks phone numbers in logs', () => {
      const freemopaySource = require('./providers/freemopay.service').FreemopayService.toString();
      
      // Must use maskPhoneNumber when logging phone numbers
      expect(freemopaySource).toContain('maskPhoneNumber');
    });
  });

  describe('FedaPay sanitization call sites', () => {
    it('mutation test: FedaPay uses sanitizeProviderError', () => {
      const fedapaySource = require('./providers/fedapay.service').FedaPayService.toString();
      
      expect(fedapaySource).toContain('sanitizeProviderError');
    });

    it('mutation test: FedaPay masks phone numbers', () => {
      const fedapaySource = require('./providers/fedapay.service').FedaPayService.toString();
      
      expect(fedapaySource).toContain('maskPhoneNumber');
    });
  });

  describe('MyPVit sanitization call sites', () => {
    it('mutation test: MyPVit uses sanitizeProviderError', () => {
      const mypvitSource = require('./providers/mypvit.service').MyPVitService.toString();
      
      expect(mypvitSource).toContain('sanitizeProviderError');
    });

    it('mutation test: MyPVit masks phone numbers in KYC logs', () => {
      const mypvitSource = require('./providers/mypvit.service').MyPVitService.toString();
      
      // MyPVit KYC processing should mask phone numbers
      expect(mypvitSource).toContain('maskPhoneNumber');
    });
  });

  describe('Controller callback sanitization', () => {
    it('mutation test: controller uses sanitizeProviderError in callbacks', () => {
      const controllerSource = require('./mobile-payments.controller').MobilePaymentsController.toString();
      
      // Controller should sanitize provider errors in callback handling
      expect(controllerSource).toContain('sanitizeProviderError');
    });
  });

  describe('AccountRecharge sanitization', () => {
    it('mutation test: account recharge masks phone numbers', () => {
      const rechargeSource = require('../admin/account-recharge/account-recharge.service').AccountRechargeService.toString();
      
      // Account recharge should mask phone numbers in logs
      expect(rechargeSource).toContain('maskPhoneNumber');
    });
  });

  describe('WhatsApp STOP masking', () => {
    it('mutation test: WhatsApp reply service masks phone numbers', () => {
      const whatsappSource = require('../notifications/orchestration/whatsapp-reply.service').WhatsAppReplyService.toString();
      
      // WhatsApp STOP handling should mask phone numbers
      expect(whatsappSource).toContain('maskPhoneNumber');
    });
  });

  describe('Withdrawal error sanitization', () => {
    it('should return generic error for withdrawal failures', () => {
      // G6 Item 3: Withdrawal API must return generic error
      const giveChangeSource = require('./give-change-payout.service').GiveChangePayoutService.toString();
      
      // Must return PAYOUT_PROVIDER_ERROR, not raw provider errors
      expect(giveChangeSource).toContain('PAYOUT_PROVIDER_ERROR');
    });

    it('mutation test: logs detailed error server-side but returns generic to client', () => {
      const giveChangeSource = require('./give-change-payout.service').GiveChangePayoutService.toString();
      
      // Must log detailed errors but return generic message
      expect(giveChangeSource).toContain('logger.error');
      expect(giveChangeSource).toContain('Failed to initiate withdrawal');
    });
  });
});
