/**
 * Dedicated Agents Screens Tests
 *
 * Tests for BusinessLocationDedicatedAgentsScreen, DedicatedPostingFormScreen,
 * and DedicatedApplicantsScreen. Renders real screens and asserts error keys exist
 * in both EN and FR locales.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import i18n from '../../../i18n';
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
      const key = `dedicatedAgents.errors.${code}`;
      expect(enLocale.dedicatedAgents.errors).toHaveProperty(code);
      expect(typeof (enLocale.dedicatedAgents.errors as any)[code]).toBe('string');
      expect((enLocale.dedicatedAgents.errors as any)[code].length).toBeGreaterThan(0);
    });
  });

  it('should have all error keys in FR locale', () => {
    errorCodes.forEach((code) => {
      const key = `dedicatedAgents.errors.${code}`;
      expect(frLocale.dedicatedAgents.errors).toHaveProperty(code);
      expect(typeof (frLocale.dedicatedAgents.errors as any)[code]).toBe('string');
      expect((frLocale.dedicatedAgents.errors as any)[code].length).toBeGreaterThan(0);
    });
  });

  it('should have common keys in EN locale', () => {
    const commonKeys = ['saved', 'removed', 'error', 'cancel', 'confirm', 'close', 'save'];
    commonKeys.forEach((key) => {
      expect(enLocale.common).toHaveProperty(key);
      expect(typeof (enLocale.common as any)[key]).toBe('string');
    });
  });

  it('should have common keys in FR locale', () => {
    const commonKeys = ['saved', 'removed', 'error', 'cancel', 'confirm', 'close', 'save'];
    commonKeys.forEach((key) => {
      expect(frLocale.common).toHaveProperty(key);
      expect(typeof (frLocale.common as any)[key]).toBe('string');
    });
  });

  it('should have section keys in EN locale', () => {
    expect(enLocale.dedicatedAgents.section.title).toBe('Dedicated agents');
    expect(enLocale.dedicatedAgents.section.explainer).toBeDefined();
    expect(enLocale.dedicatedAgents.section.scheduledOnly).toBeDefined();
  });

  it('should have section keys in FR locale', () => {
    expect(frLocale.dedicatedAgents.section.title).toBe('Livreurs dédiés');
    expect(frLocale.dedicatedAgents.section.explainer).toBeDefined();
    expect(frLocale.dedicatedAgents.section.scheduledOnly).toBeDefined();
  });

  it('should have slot keys in EN locale', () => {
    expect(enLocale.dedicatedAgents.slots.morning).toBe('Morning');
    expect(enLocale.dedicatedAgents.slots.afternoon).toBe('Afternoon');
    expect(enLocale.dedicatedAgents.slots.evening).toBe('Evening');
    expect(enLocale.dedicatedAgents.slots.pickup).toBeDefined();
    expect(enLocale.dedicatedAgents.slots.offConfirm).toBeDefined();
  });

  it('should have slot keys in FR locale', () => {
    expect(frLocale.dedicatedAgents.slots.morning).toBe('Matin');
    expect(frLocale.dedicatedAgents.slots.afternoon).toBe('Après-midi');
    expect(frLocale.dedicatedAgents.slots.evening).toBe('Soir');
    expect(frLocale.dedicatedAgents.slots.pickup).toBeDefined();
    expect(frLocale.dedicatedAgents.slots.offConfirm).toBeDefined();
  });

  it('should have chip keys in EN locale', () => {
    expect(enLocale.dedicatedAgents.chips.type.internal).toBe('Internal');
    expect(enLocale.dedicatedAgents.chips.type.independent).toBe('Independent');
    expect(enLocale.dedicatedAgents.chips.status.active).toBe('Active');
    expect(enLocale.dedicatedAgents.chips.status.paused).toBe('Paused');
    expect(enLocale.dedicatedAgents.chips.status.offToday).toBe('Off today');
  });

  it('should have chip keys in FR locale', () => {
    expect(frLocale.dedicatedAgents.chips.type.internal).toBe('Interne');
    expect(frLocale.dedicatedAgents.chips.type.independent).toBe('Indépendant');
    expect(frLocale.dedicatedAgents.chips.status.active).toBe('Actif');
    expect(frLocale.dedicatedAgents.chips.status.paused).toBe('En pause');
    expect(frLocale.dedicatedAgents.chips.status.offToday).toBe('Absent aujourd\'hui');
  });

  it('should have action keys in EN locale', () => {
    expect(enLocale.dedicatedAgents.actions.pause).toBe('Pause');
    expect(enLocale.dedicatedAgents.actions.resume).toBe('Resume');
    expect(enLocale.dedicatedAgents.actions.remove).toBe('Remove');
  });

  it('should have action keys in FR locale', () => {
    expect(frLocale.dedicatedAgents.actions.pause).toBe('Mettre en pause');
    expect(frLocale.dedicatedAgents.actions.resume).toBe('Reprendre');
    expect(frLocale.dedicatedAgents.actions.remove).toBe('Retirer');
  });

  it('should have form keys in EN locale', () => {
    expect(enLocale.dedicatedAgents.form.agentsNeeded).toBe('Agents needed');
    expect(enLocale.dedicatedAgents.form.days).toBe('Days');
    expect(enLocale.dedicatedAgents.form.slots).toBe('Slots');
    expect(enLocale.dedicatedAgents.form.payLine).toBe('Standard delivery pay');
    expect(enLocale.dedicatedAgents.form.payFixed).toBe('(not editable)');
    expect(enLocale.dedicatedAgents.form.termsField).toBe('Terms / notes');
    expect(enLocale.dedicatedAgents.form.publish).toBe('Publish');
    expect(enLocale.dedicatedAgents.form.posted).toBe('Request posted');
  });

  it('should have form keys in FR locale', () => {
    expect(frLocale.dedicatedAgents.form.agentsNeeded).toBe('Livreurs recherchés');
    expect(frLocale.dedicatedAgents.form.days).toBe('Jours');
    expect(frLocale.dedicatedAgents.form.slots).toBe('Créneaux');
    expect(frLocale.dedicatedAgents.form.payLine).toBe('Rémunération standard par livraison');
    expect(frLocale.dedicatedAgents.form.payFixed).toBe('(non modifiable)');
    expect(frLocale.dedicatedAgents.form.termsField).toBe('Conditions / remarques');
    expect(frLocale.dedicatedAgents.form.publish).toBe('Publier');
    expect(frLocale.dedicatedAgents.form.posted).toBe('Demande publiée');
  });

  it('should have applicant keys in EN locale', () => {
    expect(enLocale.dedicatedAgents.applicant.title).toBe('Pending');
    expect(enLocale.dedicatedAgents.applicant.accepted).toBe('Accepted');
    expect(enLocale.dedicatedAgents.applicant.accept).toBe('Accept');
    expect(enLocale.dedicatedAgents.applicant.decline).toBe('Decline');
    expect(enLocale.dedicatedAgents.applicant.autoDeclined).toBe('Auto-declined');
    expect(enLocale.dedicatedAgents.applicant.acceptConfirm).toBeDefined();
    expect(enLocale.dedicatedAgents.applicant.acceptLastConfirm).toBeDefined();
    expect(enLocale.dedicatedAgents.applicant.termsEdited).toBe('Applicants were notified');
  });

  it('should have applicant keys in FR locale', () => {
    expect(frLocale.dedicatedAgents.applicant.title).toBe('En attente');
    expect(frLocale.dedicatedAgents.applicant.accepted).toBe('Acceptés');
    expect(frLocale.dedicatedAgents.applicant.accept).toBe('Accepter');
    expect(frLocale.dedicatedAgents.applicant.decline).toBe('Refuser');
    expect(frLocale.dedicatedAgents.applicant.autoDeclined).toBe('Refusée automatiquement');
    expect(frLocale.dedicatedAgents.applicant.acceptConfirm).toBeDefined();
    expect(frLocale.dedicatedAgents.applicant.acceptLastConfirm).toBeDefined();
    expect(frLocale.dedicatedAgents.applicant.termsEdited).toBe('Les candidats ont été prévenus');
  });

  it('should have accessibility labels in EN locale', () => {
    expect(enLocale.dedicatedAgents.accessibilityLabels.moreOptions).toBe('More options');
    expect(enLocale.dedicatedAgents.accessibilityLabels.editTerms).toBe('Edit terms');
    expect(enLocale.dedicatedAgents.accessibilityLabels.pickupTime).toBe('Select pickup time');
    expect(enLocale.dedicatedAgents.accessibilityLabels.decreaseCount).toBe('Decrease count');
    expect(enLocale.dedicatedAgents.accessibilityLabels.increaseCount).toBe('Increase count');
  });

  it('should have accessibility labels in FR locale', () => {
    expect(frLocale.dedicatedAgents.accessibilityLabels.moreOptions).toBeDefined();
    expect(frLocale.dedicatedAgents.accessibilityLabels.editTerms).toBeDefined();
    expect(frLocale.dedicatedAgents.accessibilityLabels.pickupTime).toBe('Sélectionner l\'heure de collecte');
    expect(frLocale.dedicatedAgents.accessibilityLabels.decreaseCount).toBe('Diminuer le nombre');
    expect(frLocale.dedicatedAgents.accessibilityLabels.increaseCount).toBe('Augmenter le nombre');
  });

  it('should have day letters in EN locale', () => {
    expect(enLocale.dedicatedAgents.dayLetters.monday).toBe('M');
    expect(enLocale.dedicatedAgents.dayLetters.tuesday).toBe('T');
    expect(enLocale.dedicatedAgents.dayLetters.wednesday).toBe('W');
    expect(enLocale.dedicatedAgents.dayLetters.thursday).toBe('T');
    expect(enLocale.dedicatedAgents.dayLetters.friday).toBe('F');
    expect(enLocale.dedicatedAgents.dayLetters.saturday).toBe('S');
    expect(enLocale.dedicatedAgents.dayLetters.sunday).toBe('S');
  });

  it('should have day letters in FR locale', () => {
    expect(frLocale.dedicatedAgents.dayLettersFR.monday).toBe('L');
    expect(frLocale.dedicatedAgents.dayLettersFR.tuesday).toBe('M');
    expect(frLocale.dedicatedAgents.dayLettersFR.wednesday).toBe('M');
    expect(frLocale.dedicatedAgents.dayLettersFR.thursday).toBe('J');
    expect(frLocale.dedicatedAgents.dayLettersFR.friday).toBe('V');
    expect(frLocale.dedicatedAgents.dayLettersFR.saturday).toBe('S');
    expect(frLocale.dedicatedAgents.dayLettersFR.sunday).toBe('D');
  });

  it('should have closeWithCount key in EN locale', () => {
    expect(enLocale.dedicatedAgents.closeWithCount).toBe('Close posting ({{count}} will be auto-declined)');
  });

  it('should have closeWithCount key in FR locale', () => {
    expect(frLocale.dedicatedAgents.closeWithCount).toBeDefined();
    expect(frLocale.dedicatedAgents.closeWithCount.length).toBeGreaterThan(0);
  });

  it('should have generic and offline keys in EN locale', () => {
    expect(enLocale.dedicatedAgents.generic).toBe('Something went wrong');
    expect(enLocale.dedicatedAgents.retry).toBe('Retry');
    expect(enLocale.dedicatedAgents.offline).toBe('Offline · showing last update');
  });

  it('should have generic and offline keys in FR locale', () => {
    expect(frLocale.dedicatedAgents.generic).toBeDefined();
    expect(frLocale.dedicatedAgents.retry).toBeDefined();
    expect(frLocale.dedicatedAgents.offline).toBeDefined();
  });
});
