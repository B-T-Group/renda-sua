import {
  MergeClassification,
  TransferSkipItem,
} from './business-location-transfer.types';

export interface SourceItemCandidate {
  id: string;
  name: string;
  sku: string | null;
  sharedElsewhere: boolean;
}

export interface SourceRentalCandidate {
  id: string;
  name: string;
  listingId: string;
  sharedElsewhere: boolean;
}

/** Pure classification for inventory_merge movable vs skipped sets. */
export function classifyMergeCandidates(params: {
  items: SourceItemCandidate[];
  rentals: SourceRentalCandidate[];
  destSkuSet: Set<string>;
  destRentalNameSet: Set<string>;
}): MergeClassification {
  const skippedDuplicates: TransferSkipItem[] = [];
  const skippedShared: TransferSkipItem[] = [];
  const movableItemIds: string[] = [];
  const movableRentalItemIds: string[] = [];
  const movableListingIds: string[] = [];

  for (const item of params.items) {
    if (item.sharedElsewhere) {
      skippedShared.push({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
      });
      continue;
    }
    const skuKey = item.sku?.trim().toLowerCase();
    if (skuKey && params.destSkuSet.has(skuKey)) {
      skippedDuplicates.push({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
      });
      continue;
    }
    movableItemIds.push(item.id);
  }

  for (const rental of params.rentals) {
    if (rental.sharedElsewhere) {
      skippedShared.push({ itemId: rental.id, name: rental.name });
      continue;
    }
    const nameKey = rental.name.trim().toLowerCase();
    if (nameKey && params.destRentalNameSet.has(nameKey)) {
      skippedDuplicates.push({ itemId: rental.id, name: rental.name });
      continue;
    }
    movableRentalItemIds.push(rental.id);
    movableListingIds.push(rental.listingId);
  }

  return {
    movableItemIds,
    movableRentalItemIds,
    movableListingIds,
    skippedDuplicates,
    skippedShared,
  };
}
