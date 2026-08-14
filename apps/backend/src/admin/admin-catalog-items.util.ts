/**
 * Build Hasura where clause for admin catalog item search.
 * Pure helper for unit tests.
 */
export function buildAdminCatalogItemsWhere(params: {
  q?: string;
  businessId?: string;
  from?: string;
  to?: string;
  moderationStatus?: string;
  isActive?: boolean;
}): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  const q = params.q?.trim();
  if (q) {
    const pattern = `%${q}%`;
    and.push({
      _or: [
        { name: { _ilike: pattern } },
        { sku: { _ilike: pattern } },
        { description: { _ilike: pattern } },
      ],
    });
  }
  if (params.businessId) {
    and.push({ business_id: { _eq: params.businessId } });
  }
  if (params.from || params.to) {
    const created: Record<string, string> = {};
    if (params.from) created._gte = params.from;
    if (params.to) created._lte = params.to;
    and.push({ created_at: created });
  }
  if (params.moderationStatus) {
    and.push({ moderation_status: { _eq: params.moderationStatus } });
  }
  if (params.isActive !== undefined) {
    and.push({ is_active: { _eq: params.isActive } });
  }
  // Soft-deleted items are not editable via admin PATCH; exclude from browser.
  and.push({ status: { _eq: 'active' } });
  return and.length > 0 ? { _and: and } : {};
}

export function resolveCatalogImageUrl(image: {
  image_url?: string | null;
  rembg_image_url?: string | null;
  enhanced_image_url?: string | null;
  active_version?: string | null;
}): string | null {
  if (image.active_version === 'rembg' && image.rembg_image_url) {
    return image.rembg_image_url;
  }
  if (image.active_version === 'enhanced' && image.enhanced_image_url) {
    return image.enhanced_image_url;
  }
  return image.image_url ?? null;
}
