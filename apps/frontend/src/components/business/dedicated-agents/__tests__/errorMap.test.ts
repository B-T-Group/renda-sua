import { mapDedicatedAgentsErrorCode } from '../../../../utils/dedicatedAgentsErrors';
import enLocale from '../../../../../public/locales/en.json';
import frLocale from '../../../../../public/locales/fr.json';

describe('Dedicated Agents Error Map', () => {
  const errorCodes = [
    'posting_filled',
    'posting_not_open',
    'posting_expired',
    'posting_already_open',
    'application_closed',
    'application_not_pending',
    'agent_holds_slot',
    'dedicated_agent_assignment_cap_exceeded',
    'dedicated_agent_assignment_duplicate',
    'agent_not_verified',
    'agent_suspended',
    'agent_ineligible',
    'slot_disabled',
    'assignment_removed',
    'assignment_changed',
    'slot_has_dedicated_agents',
    'pickup_time_outside_slot',
    'invalid_headcount',
    'invalid_slot_keys',
    'invalid_days_of_week',
    'terms_too_long',
  ];

  it('should map all error codes to translation keys that exist in en.json', () => {
    errorCodes.forEach((code) => {
      const translationKey = mapDedicatedAgentsErrorCode(code);
      
      // Remove the 'dedicatedAgents.errors.' prefix to navigate the locale object
      const keyPath = translationKey.split('.');
      let value: any = enLocale;
      
      keyPath.forEach((key) => {
        value = value[key];
      });
      
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  });

  it('should map all error codes to translation keys that exist in fr.json', () => {
    errorCodes.forEach((code) => {
      const translationKey = mapDedicatedAgentsErrorCode(code);
      
      // Remove the 'dedicatedAgents.errors.' prefix to navigate the locale object
      const keyPath = translationKey.split('.');
      let value: any = frLocale;
      
      keyPath.forEach((key) => {
        value = value[key];
      });
      
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  });

  it('should have a generic error key in both locales', () => {
    const genericKey = mapDedicatedAgentsErrorCode('unknown_error');
    
    expect(genericKey).toBe('dedicatedAgents.errors.generic');
    
    // Check en.json
    const enKeyPath = genericKey.split('.');
    let enValue: any = enLocale;
    enKeyPath.forEach((key) => {
      enValue = enValue?.[key];
    });
    expect(enValue).toBeDefined();
    expect(typeof enValue).toBe('string');
    
    // Check fr.json
    const frKeyPath = genericKey.split('.');
    let frValue: any = frLocale;
    frKeyPath.forEach((key) => {
      frValue = frValue?.[key];
    });
    expect(frValue).toBeDefined();
    expect(typeof frValue).toBe('string');
  });
});
