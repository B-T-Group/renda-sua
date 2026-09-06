import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_PREFIX = '@RendasuaAgent:listingWizardDraft';

export type ListingWizardKind = 'sale' | 'rental';

/** Bump when wizard step indices change so restored drafts can be migrated. */
export const LISTING_WIZARD_STEP_VERSION = 2;

export interface ListingWizardFormSnapshot {
  name?: string;
  description?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  price?: string;
  hint?: string;
  isFoodItem?: boolean;
  quantity?: string;
  locationId?: string;
  isUsed?: boolean;
  payAtPickupEnabled?: boolean;
  shippingEnabled?: boolean;
  shippingPrice?: string;
}

export interface ListingWizardDraft {
  kind: ListingWizardKind;
  step: number;
  /** Absent on pre-fulfillment drafts (version 1). */
  stepVersion?: number;
  /**
   * Parallel to assetUris. Empty string means not yet uploaded so index
   * alignment with local photos is preserved across restore.
   */
  imageIds: string[];
  createdItemId?: string;
  /** True when the merchant chose Save for later (success step is draft, not published). */
  savedAsDraft?: boolean;
  /** Local picker URIs when photos are chosen but not yet uploaded. */
  assetUris?: string[];
  form?: ListingWizardFormSnapshot;
  /** @deprecated Prefer cleanupKinds; kept for draft restore compat. */
  asyncCleanupRequested?: boolean;
  /** @deprecated Prefer cleanupKinds; kept for draft restore compat. */
  cleanupSelectedIndexes?: number[];
  /** Per-photo index → rembg | ai | null */
  cleanupKinds?: Record<string, 'rembg' | 'ai' | null>;
  savedAt: number;
}

export async function readListingWizardDraft(
  kind: ListingWizardKind
): Promise<ListingWizardDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(`${DRAFT_PREFIX}:${kind}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ListingWizardDraft;
    if (parsed?.kind !== kind || typeof parsed.step !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeListingWizardDraft(
  draft: ListingWizardDraft
): Promise<void> {
  await AsyncStorage.setItem(
    `${DRAFT_PREFIX}:${draft.kind}`,
    JSON.stringify({
      ...draft,
      stepVersion: LISTING_WIZARD_STEP_VERSION,
      savedAt: Date.now(),
    })
  );
}

export async function clearListingWizardDraft(
  kind: ListingWizardKind
): Promise<void> {
  await AsyncStorage.removeItem(`${DRAFT_PREFIX}:${kind}`);
}

export function draftHasRestorableContent(draft: ListingWizardDraft): boolean {
  return (
    draft.step > 0 ||
    draft.imageIds.some((id) => !!id) ||
    !!draft.createdItemId ||
    (draft.assetUris?.length ?? 0) > 0 ||
    !!draft.form?.name ||
    !!draft.form?.hint
  );
}

export function buildListingWizardDraft(input: {
  kind: ListingWizardKind;
  step: number;
  imageIds: Array<string | null | undefined>;
  createdItemId?: string;
  savedAsDraft?: boolean;
  assetUris: string[];
  form?: ListingWizardFormSnapshot;
  cleanupKinds?: Record<string, 'rembg' | 'ai' | null>;
}): ListingWizardDraft | null {
  const draft: ListingWizardDraft = {
    kind: input.kind,
    step: input.step,
    imageIds: input.imageIds.map((id) => id ?? ''),
    createdItemId: input.createdItemId,
    savedAsDraft: input.savedAsDraft,
    assetUris: input.assetUris.length ? input.assetUris : undefined,
    form: input.form,
    cleanupKinds: input.cleanupKinds,
    stepVersion: LISTING_WIZARD_STEP_VERSION,
    savedAt: Date.now(),
  };
  return draftHasRestorableContent(draft) ? draft : null;
}

/** Fulfillment was inserted at index 4; bump legacy steps at/after the old publish index. */
export function migrateListingWizardDraftStep(
  step: number,
  version?: number
): number {
  if ((version ?? 1) >= LISTING_WIZARD_STEP_VERSION) return step;
  return step >= 4 ? step + 1 : step;
}
