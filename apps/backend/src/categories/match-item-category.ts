import { nameSimilarity } from '../ai/listing-quality.util';

export type ItemCategoryTreeNode = {
  id: number;
  name: string;
  item_sub_categories: Array<{
    id: number;
    name: string;
    item_category_id: number;
  }>;
};

export type MatchItemCategoryNamesResult = {
  categoryId: number | null;
  subCategoryId: number | null;
  categoryName: string;
  subCategoryName: string;
  matchedCategory: boolean;
  matchedSubCategory: boolean;
};

const SIMILARITY_THRESHOLD = 0.7;
const MIN_FUZZY_LENGTH = 3;

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function scoreNameMatch(query: string, candidate: string): number {
  const trimmed = query.trim();
  if (!trimmed) {
    return 0;
  }
  if (normalizeName(trimmed) === normalizeName(candidate)) {
    return 1;
  }
  if (normalizeName(trimmed).length < MIN_FUZZY_LENGTH) {
    return 0;
  }
  return nameSimilarity(trimmed, candidate);
}

function findBestNamedMatch<T extends { name: string }>(
  candidates: T[],
  query: string
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreNameMatch(query, candidate.name);
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
      best = { item: candidate, score };
    }
  }
  return best;
}

type GlobalSubMatch = {
  sub: ItemCategoryTreeNode['item_sub_categories'][number];
  category: ItemCategoryTreeNode;
  score: number;
};

function findBestGlobalSubMatch(
  tree: ItemCategoryTreeNode[],
  subCategoryName: string
): GlobalSubMatch | null {
  let best: GlobalSubMatch | null = null;
  for (const category of tree) {
    for (const sub of category.item_sub_categories) {
      const score = scoreNameMatch(subCategoryName, sub.name);
      if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) {
        best = { sub, category, score };
      }
    }
  }
  return best;
}

export function matchItemCategoryNames(
  tree: ItemCategoryTreeNode[],
  rawCategoryName: string,
  rawSubCategoryName: string,
  options?: { allowGlobalSubMatch?: boolean }
): MatchItemCategoryNamesResult {
  const categoryName = rawCategoryName.trim();
  const subCategoryName = rawSubCategoryName.trim();
  const unmatched: MatchItemCategoryNamesResult = {
    categoryId: null,
    subCategoryId: null,
    categoryName,
    subCategoryName,
    matchedCategory: false,
    matchedSubCategory: false,
  };
  if (!categoryName || !subCategoryName || tree.length === 0) {
    return unmatched;
  }

  for (const category of tree) {
    if (normalizeName(category.name) !== normalizeName(categoryName)) {
      continue;
    }
    for (const sub of category.item_sub_categories) {
      if (normalizeName(sub.name) === normalizeName(subCategoryName)) {
        return {
          categoryId: category.id,
          subCategoryId: sub.id,
          categoryName: category.name,
          subCategoryName: sub.name,
          matchedCategory: true,
          matchedSubCategory: true,
        };
      }
    }
  }

  const categoryMatch = findBestNamedMatch(tree, categoryName);
  if (categoryMatch) {
    const subUnderCategory = findBestNamedMatch(
      categoryMatch.item.item_sub_categories,
      subCategoryName
    );
    if (subUnderCategory) {
      return {
        categoryId: categoryMatch.item.id,
        subCategoryId: subUnderCategory.item.id,
        categoryName: categoryMatch.item.name,
        subCategoryName: subUnderCategory.item.name,
        matchedCategory: true,
        matchedSubCategory: true,
      };
    }
    return {
      categoryId: categoryMatch.item.id,
      subCategoryId: null,
      categoryName: categoryMatch.item.name,
      subCategoryName,
      matchedCategory: true,
      matchedSubCategory: false,
    };
  }

  const globalSubMatch =
    options?.allowGlobalSubMatch === false
      ? null
      : findBestGlobalSubMatch(tree, subCategoryName);
  if (globalSubMatch) {
    return {
      categoryId: globalSubMatch.category.id,
      subCategoryId: globalSubMatch.sub.id,
      categoryName: globalSubMatch.category.name,
      subCategoryName: globalSubMatch.sub.name,
      matchedCategory: true,
      matchedSubCategory: true,
    };
  }

  return unmatched;
}

export function formatCatalogForVisionPrompt(
  tree: ItemCategoryTreeNode[],
  maxCategories = 40
): string {
  return tree
    .slice(0, maxCategories)
    .map((category) => {
      const subs = category.item_sub_categories
        .slice(0, 10)
        .map((sub) => sub.name)
        .join(', ');
      return subs ? `${category.name}: ${subs}` : category.name;
    })
    .join('\n');
}

export function remapImageItemSuggestionCategories<
  T extends {
    categoryName?: string;
    subCategoryName?: string;
    categoryAlternates?: string[];
    subCategoryAlternates?: string[];
  }
>(suggestion: T, tree: ItemCategoryTreeNode[]): T {
  const categoryName = suggestion.categoryName?.trim();
  const subCategoryName = suggestion.subCategoryName?.trim();
  if (!categoryName || !subCategoryName || tree.length === 0) {
    return suggestion;
  }

  const match = matchItemCategoryNames(tree, categoryName, subCategoryName);
  if (
    match.categoryName === categoryName &&
    match.subCategoryName === subCategoryName
  ) {
    return suggestion;
  }

  const categoryAlternates = [...(suggestion.categoryAlternates ?? [])];
  const subCategoryAlternates = [...(suggestion.subCategoryAlternates ?? [])];
  if (
    categoryName &&
    !categoryAlternates.some(
      (value) => normalizeName(value) === normalizeName(categoryName)
    )
  ) {
    categoryAlternates.unshift(categoryName);
  }
  if (
    subCategoryName &&
    !subCategoryAlternates.some(
      (value) => normalizeName(value) === normalizeName(subCategoryName)
    )
  ) {
    subCategoryAlternates.unshift(subCategoryName);
  }

  return {
    ...suggestion,
    categoryName: match.categoryName,
    subCategoryName: match.subCategoryName,
    categoryAlternates: categoryAlternates.slice(0, 3),
    subCategoryAlternates: subCategoryAlternates.slice(0, 3),
  };
}
