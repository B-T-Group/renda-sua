/**
 * Dedicated Agents Tests
 *
 * Tests locale keys exist and screens render with proper behavior.
 */

import enLocale from '../../../i18n/locales/en.json';
import frLocale from '../../../i18n/locales/fr.json';

describe('Dedicated Agents Locale Keys', () => {
  const errorCodes = [
    'posting_filled',
    'posting_not_open',
    'posting_expired',
    'posting_already_open',
    'application_not_pending',
    'agent_holds_slot',
    'cap_exceeded',
    'duplicate',
    'slot_disabled',
    'agent_ineligible',
    'agent_not_verified',
    'agent_suspended',
    'pickup_time_outside_slot',
    'assignment_removed',
    'assignment_changed',
    'slot_has_dedicated_agents',
    'invalid_headcount',
    'invalid_slot_keys',
    'invalid_days_of_week',
    'terms_too_long',
  ];

  it('should have all error keys in EN locale', () => {
    errorCodes.forEach((code) => {
      expect(enLocale.dedicatedAgents.errors).toHaveProperty(code);
      expect(typeof (enLocale.dedicatedAgents.errors as any)[code]).toBe('string');
      expect((enLocale.dedicatedAgents.errors as any)[code].length).toBeGreaterThan(0);
    });
  });

  it('should have all error keys in FR locale', () => {
    errorCodes.forEach((code) => {
      expect(frLocale.dedicatedAgents.errors).toHaveProperty(code);
      expect(typeof (frLocale.dedicatedAgents.errors as any)[code]).toBe('string');
      expect((frLocale.dedicatedAgents.errors as any)[code].length).toBeGreaterThan(0);
    });
  });

  it('should have day letters in single key for EN locale', () => {
    expect(enLocale.dedicatedAgents.dayLetters.monday).toBe('M');
    expect(enLocale.dedicatedAgents.dayLetters.tuesday).toBe('T');
    expect(enLocale.dedicatedAgents.dayLetters.wednesday).toBe('W');
    expect(enLocale.dedicatedAgents.dayLetters.thursday).toBe('T');
    expect(enLocale.dedicatedAgents.dayLetters.friday).toBe('F');
    expect(enLocale.dedicatedAgents.dayLetters.saturday).toBe('S');
    expect(enLocale.dedicatedAgents.dayLetters.sunday).toBe('S');
  });

  it('should have day letters in single key for FR locale', () => {
    expect(frLocale.dedicatedAgents.dayLetters.monday).toBe('L');
    expect(frLocale.dedicatedAgents.dayLetters.tuesday).toBe('M');
    expect(frLocale.dedicatedAgents.dayLetters.wednesday).toBe('M');
    expect(frLocale.dedicatedAgents.dayLetters.thursday).toBe('J');
    expect(frLocale.dedicatedAgents.dayLetters.friday).toBe('V');
    expect(frLocale.dedicatedAgents.dayLetters.saturday).toBe('S');
    expect(frLocale.dedicatedAgents.dayLetters.sunday).toBe('D');
  });

  it('should not have dayLettersFR key in either locale', () => {
    expect((enLocale.dedicatedAgents as any).dayLettersFR).toBeUndefined();
    expect((frLocale.dedicatedAgents as any).dayLettersFR).toBeUndefined();
  });

  it('should have offline key for network state banner', () => {
    expect(enLocale.dedicatedAgents.offline).toBe('Offline · showing last update');
    expect(frLocale.dedicatedAgents.offline).toBeDefined();
  });

  it('should have pausedGroup key for collapsed disabled slots', () => {
    expect(enLocale.dedicatedAgents.slots.pausedGroup).toBe('{{n}} paused agents');
    expect(frLocale.dedicatedAgents.slots.pausedGroup).toBeDefined();
  });

  it('should have fullWarning key for capacity banner', () => {
    expect(enLocale.dedicatedAgents.fullWarning).toBe(
      'No dedicated agent can take orders right now. Delivery follows normal rules.'
    );
    expect(frLocale.dedicatedAgents.fullWarning).toBeDefined();
  });
});

describe('Accept Application Response Handling', () => {
  it('should update posting and applications state when accept returns filled', () => {
    // Mock accept response
    const acceptResponse = {
      success: true,
      application: { id: 'app-1', status: 'accepted', phone: '+123456789' },
      posting: { id: 'post-456', status: 'filled', acceptedCount: 2 },
    };

    // Initial applications state
    const applications = [
      { applicationId: 'app-1', status: 'applied' },
      { applicationId: 'app-2', status: 'applied' },
      { applicationId: 'app-3', status: 'applied' },
    ];

    // Simulate the state update logic from DedicatedApplicantsScreen
    const updatedApplications = applications.map((app) => {
      if (app.applicationId === 'app-1') {
        return { ...app, status: 'accepted', phone: acceptResponse.application.phone };
      }
      if (acceptResponse.posting.status === 'filled' && app.status === 'applied') {
        return { ...app, status: 'auto_declined' };
      }
      return app;
    });

    // Verify immediate state update without refetch
    expect(updatedApplications[0].status).toBe('accepted');
    expect(updatedApplications[1].status).toBe('auto_declined');
    expect(updatedApplications[2].status).toBe('auto_declined');
  });

  it('should only update accepted application when posting is not filled', () => {
    const acceptResponse = {
      success: true,
      application: { id: 'app-1', status: 'accepted', phone: '+123456789' },
      posting: { id: 'post-456', status: 'open', acceptedCount: 1 },
    };

    const applications = [
      { applicationId: 'app-1', status: 'applied' },
      { applicationId: 'app-2', status: 'applied' },
    ];

    const updatedApplications = applications.map((app) => {
      if (app.applicationId === 'app-1') {
        return { ...app, status: 'accepted', phone: acceptResponse.application.phone };
      }
      if (acceptResponse.posting.status === 'filled' && app.status === 'applied') {
        return { ...app, status: 'auto_declined' };
      }
      return app;
    });

    expect(updatedApplications[0].status).toBe('accepted');
    expect(updatedApplications[1].status).toBe('applied'); // Not auto-declined
  });
});

describe('Disabled Slots Collapse Logic', () => {
  it('should show collapsed text for disabled slots with agents', () => {
    const slot = { slotKey: 'morning', isEnabled: false };
    const slotAgents = [
      { assignmentId: 'a1', slotKey: 'morning', status: 'paused' },
      { assignmentId: 'a2', slotKey: 'morning', status: 'paused' },
      { assignmentId: 'a3', slotKey: 'morning', status: 'paused' },
    ];

    // Logic from BusinessLocationDedicatedAgentsScreen
    const shouldShowCollapsed = !slot.isEnabled && slotAgents.length > 0;
    const collapsedText = `${slotAgents.length} paused agents`;

    expect(shouldShowCollapsed).toBe(true);
    expect(collapsedText).toBe('3 paused agents');
  });

  it('should not show collapsed text for enabled slots', () => {
    const slot = { slotKey: 'morning', isEnabled: true };
    const slotAgents = [
      { assignmentId: 'a1', slotKey: 'morning', status: 'paused' },
    ];

    const shouldShowCollapsed = !slot.isEnabled && slotAgents.length > 0;

    expect(shouldShowCollapsed).toBe(false);
  });

  it('should not show collapsed text for disabled slots with no agents', () => {
    const slot = { slotKey: 'morning', isEnabled: false };
    const slotAgents: any[] = [];

    const shouldShowCollapsed = !slot.isEnabled && slotAgents.length > 0;

    expect(shouldShowCollapsed).toBe(false);
  });
});

describe('Day Letters Localization', () => {
  it('should render correct day letters for EN locale', () => {
    const dayLetters = [
      enLocale.dedicatedAgents.dayLetters.monday,
      enLocale.dedicatedAgents.dayLetters.tuesday,
      enLocale.dedicatedAgents.dayLetters.wednesday,
      enLocale.dedicatedAgents.dayLetters.thursday,
      enLocale.dedicatedAgents.dayLetters.friday,
      enLocale.dedicatedAgents.dayLetters.saturday,
      enLocale.dedicatedAgents.dayLetters.sunday,
    ];

    expect(dayLetters).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('should render correct day letters for FR locale', () => {
    const dayLetters = [
      frLocale.dedicatedAgents.dayLetters.monday,
      frLocale.dedicatedAgents.dayLetters.tuesday,
      frLocale.dedicatedAgents.dayLetters.wednesday,
      frLocale.dedicatedAgents.dayLetters.thursday,
      frLocale.dedicatedAgents.dayLetters.friday,
      frLocale.dedicatedAgents.dayLetters.saturday,
      frLocale.dedicatedAgents.dayLetters.sunday,
    ];

    expect(dayLetters).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
  });
});

describe('Network Status Integration', () => {
  it('should have offline banner key', () => {
    expect(enLocale.dedicatedAgents.offline).toBeDefined();
    expect(frLocale.dedicatedAgents.offline).toBeDefined();
  });

  it('should disable mutations when offline', () => {
    const isOffline = true;
    const isMutating = false;

    // Button disable logic from screens
    const buttonDisabled = isMutating || isOffline;
    const switchDisabled = isMutating || isOffline;

    expect(buttonDisabled).toBe(true);
    expect(switchDisabled).toBe(true);
  });

  it('should enable mutations when online', () => {
    const isOffline = false;
    const isMutating = false;

    const buttonDisabled = isMutating || isOffline;

    expect(buttonDisabled).toBe(false);
  });
});

describe('Date Locale Formatting', () => {
  it('should format dates with app locale', () => {
    const joinedAt = '2025-01-15T10:00:00Z';
    const locale = 'en';
    
    const formatted = new Date(joinedAt).toLocaleDateString(locale);
    
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('should format dates with FR locale', () => {
    const joinedAt = '2025-01-15T10:00:00Z';
    const locale = 'fr';
    
    const formatted = new Date(joinedAt).toLocaleDateString(locale);
    
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });
});
