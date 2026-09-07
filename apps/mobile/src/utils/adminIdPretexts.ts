export type IdReminderPretextKey = 'missingId' | 'reuploadId';

export type IdRefusalPretextKey =
  | 'notClear'
  | 'nameMismatch'
  | 'expired'
  | 'wrongType';

export interface IdPretextDefinition {
  key: IdReminderPretextKey | IdRefusalPretextKey;
  /** Short chip label i18n key under admin.businesses.pretexts.* */
  labelKey: string;
  labelDefault: string;
  /** Message body i18n key */
  bodyKey: string;
  bodyDefault: string;
  /** Thread subject i18n key (reminders only) */
  subjectKey?: string;
  subjectDefault?: string;
}

export const ID_REMINDER_PRETEXTS: IdPretextDefinition[] = [
  {
    key: 'missingId',
    labelKey: 'admin.businesses.pretexts.missingIdLabel',
    labelDefault: 'Missing ID',
    subjectKey: 'admin.businesses.pretexts.missingIdSubject',
    subjectDefault: 'Please upload your ID',
    bodyKey: 'admin.businesses.pretexts.missingIdBody',
    bodyDefault:
      "We've noticed your ID is missing, please take the time to upload your ID to proceed.",
  },
  {
    key: 'reuploadId',
    labelKey: 'admin.businesses.pretexts.reuploadIdLabel',
    labelDefault: 'Re-upload ID',
    subjectKey: 'admin.businesses.pretexts.reuploadIdSubject',
    subjectDefault: 'Please upload a new ID document',
    bodyKey: 'admin.businesses.pretexts.reuploadIdBody',
    bodyDefault:
      'Your previous ID was not accepted. Please upload a clear, valid ID document to continue verification.',
  },
];

export const ID_REFUSAL_PRETEXTS: IdPretextDefinition[] = [
  {
    key: 'notClear',
    labelKey: 'admin.businesses.pretexts.notClearLabel',
    labelDefault: 'ID is not clear',
    bodyKey: 'admin.businesses.pretexts.notClearBody',
    bodyDefault:
      'Your ID document is not clear enough. Please upload a sharper photo where all details are readable.',
  },
  {
    key: 'nameMismatch',
    labelKey: 'admin.businesses.pretexts.nameMismatchLabel',
    labelDefault: 'Name mismatch',
    bodyKey: 'admin.businesses.pretexts.nameMismatchBody',
    bodyDefault:
      'The name on your ID does not match your business account. Please upload an ID that matches your registered name.',
  },
  {
    key: 'expired',
    labelKey: 'admin.businesses.pretexts.expiredLabel',
    labelDefault: 'Document expired',
    bodyKey: 'admin.businesses.pretexts.expiredBody',
    bodyDefault:
      'Your ID document appears to be expired. Please upload a currently valid ID.',
  },
  {
    key: 'wrongType',
    labelKey: 'admin.businesses.pretexts.wrongTypeLabel',
    labelDefault: 'Wrong document type',
    bodyKey: 'admin.businesses.pretexts.wrongTypeBody',
    bodyDefault:
      'This document type is not accepted. Please upload a national ID card, passport, or driver license.',
  },
];

export function reminderPretextsForIdStatus(
  idStatus: string | undefined
): IdPretextDefinition[] {
  if (idStatus === 'missing') {
    return ID_REMINDER_PRETEXTS.filter((p) => p.key === 'missingId');
  }
  if (idStatus === 'rejected') {
    return ID_REMINDER_PRETEXTS.filter((p) => p.key === 'reuploadId');
  }
  return [];
}

export const ADMIN_BUSINESS_LIFECYCLE_FILTERS = [
  '',
  'created',
  'contract_signed',
  'active',
  'suspended',
] as const;

export const ADMIN_BUSINESS_ID_FILTERS = [
  '',
  'not_approved',
  'missing',
  'pending',
  'rejected',
  'approved',
] as const;

export type AdminBusinessLifecycleFilter =
  (typeof ADMIN_BUSINESS_LIFECYCLE_FILTERS)[number];
export type AdminBusinessIdFilter = (typeof ADMIN_BUSINESS_ID_FILTERS)[number];
