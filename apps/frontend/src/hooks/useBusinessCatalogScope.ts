import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlatformPermissions } from '../constants/platformPermissions';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { usePermission } from './usePermissions';

export function useBusinessCatalogScope() {
  const { profile } = useUserProfileContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCrossBusiness = usePermission(
    PlatformPermissions.CATALOG_CROSS_BUSINESS
  );

  const ownBusinessId = profile?.business?.id;
  const isPlatformAdmin =
    canCrossBusiness || profile?.business?.is_admin === true;

  const effectiveBusinessId = useMemo(() => {
    if (!ownBusinessId) return undefined;
    if (!isPlatformAdmin) return ownBusinessId;
    return searchParams.get('businessId') || ownBusinessId;
  }, [ownBusinessId, isPlatformAdmin, searchParams]);

  const isViewingOtherBusiness =
    isPlatformAdmin &&
    !!ownBusinessId &&
    effectiveBusinessId !== ownBusinessId;

  const canDelete = !isPlatformAdmin || !isViewingOtherBusiness;
  const canSuperUserActions = isPlatformAdmin;

  const setSelectedBusinessId = useCallback(
    (businessId: string) => {
      if (!isPlatformAdmin || !ownBusinessId) return;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (businessId === ownBusinessId) {
          next.delete('businessId');
        } else {
          next.set('businessId', businessId);
        }
        return next;
      });
    },
    [isPlatformAdmin, ownBusinessId, setSearchParams]
  );

  const businessQuerySuffix = useMemo(() => {
    if (!effectiveBusinessId || !ownBusinessId) return '';
    if (effectiveBusinessId === ownBusinessId) return '';
    return `?businessId=${encodeURIComponent(effectiveBusinessId)}`;
  }, [effectiveBusinessId, ownBusinessId]);

  const businessQueryParams = useMemo(() => {
    if (!effectiveBusinessId || !ownBusinessId) return undefined;
    if (effectiveBusinessId === ownBusinessId) return undefined;
    return { businessId: effectiveBusinessId };
  }, [effectiveBusinessId, ownBusinessId]);

  return {
    ownBusinessId,
    effectiveBusinessId,
    isPlatformAdmin,
    isViewingOtherBusiness,
    canDelete,
    canSuperUserActions,
    setSelectedBusinessId,
    businessQuerySuffix,
    businessQueryParams,
  };
}
