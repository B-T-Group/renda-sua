import { useCallback, useEffect, useState } from 'react';
import { createCategory, getCategories } from '../services/rentalsApi';
import type { RentalCategory } from '../types/rentals';

/** Prefer seeded "Other" category for new rental items. */
export function getOtherRentalCategoryId(
  categories: RentalCategory[]
): string | null {
  const bySlug = categories.find((c) => c.slug === 'other');
  if (bySlug) return bySlug.id;
  const byName = categories.find(
    (c) => c.name.trim().toLowerCase() === 'other'
  );
  return byName?.id ?? null;
}

export function useRentalCategories(enabled = true) {
  const [categories, setCategories] = useState<RentalCategory[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getCategories();
      setCategories(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const createRentalCategory = useCallback(async (name: string) => {
    setCreating(true);
    try {
      const created = await createCategory(name);
      setCategories((prev) => {
        if (prev.some((c) => c.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      return created;
    } finally {
      setCreating(false);
    }
  }, []);

  return {
    categories,
    loading,
    creating,
    error,
    refetch: fetchCategories,
    createCategory: createRentalCategory,
  };
}
