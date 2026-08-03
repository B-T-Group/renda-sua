import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { Alert, Button, Stack } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../../hooks/useApiClient';
import { useItems } from '../../../../hooks/useItems';
import { trackProductCreateEvent } from '../../../../utils/productCreateAnalytics';

export interface ProductEnrichmentNudgeProps {
  itemId: string;
  businessId?: string;
  photoCount: number;
  onOpenItem?: () => void;
}

const ProductEnrichmentNudge: React.FC<ProductEnrichmentNudgeProps> = ({
  itemId,
  businessId,
  photoCount,
  onOpenItem,
}) => {
  const { t, i18n } = useTranslation();
  const apiClient = useApiClient();
  const { setItemTags } = useItems(businessId, { skipInitialItemsFetch: true });
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const mode = photoCount < 2 ? 'photo' : 'tags';

  useEffect(() => {
    if (dismissed) return;
    trackProductCreateEvent(apiClient, 'product_create.enrichment_nudge_shown', {
      itemId,
      mode,
    });
  }, [apiClient, dismissed, itemId, mode]);

  if (dismissed) return null;

  const applyTags = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data?: { suggestedTagsEn?: string[]; suggestedTagsFr?: string[] };
      }>('/ai/item-refinement-suggestions', { itemId });
      const preferFr = (i18n.language || 'en').toLowerCase().startsWith('fr');
      const en = res.data.data?.suggestedTagsEn ?? [];
      const fr = res.data.data?.suggestedTagsFr ?? [];
      const tags = preferFr
        ? fr.length
          ? fr
          : en
        : en.length
        ? en
        : fr;
      if (tags.length) {
        await setItemTags(itemId, tags.slice(0, 8));
      }
      trackProductCreateEvent(
        apiClient,
        'product_create.enrichment_nudge_accepted',
        { itemId, mode: 'tags', tagCount: tags.length }
      );
      setDismissed(true);
    } catch {
      // non-fatal
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert
      severity="info"
      icon={<AutoAwesomeIcon fontSize="small" />}
      sx={{ mt: 2 }}
      action={
        <Stack direction="row" spacing={1}>
          <Button color="inherit" size="small" onClick={() => setDismissed(true)}>
            {t('common.dismiss', 'Not now')}
          </Button>
          {mode === 'photo' ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                trackProductCreateEvent(
                  apiClient,
                  'product_create.enrichment_nudge_accepted',
                  { itemId, mode: 'photo' }
                );
                onOpenItem?.();
                setDismissed(true);
              }}
            >
              {t(
                'business.onboarding.firstSale.enrichment.addPhoto',
                'Add photo'
              )}
            </Button>
          ) : (
            <Button
              color="inherit"
              size="small"
              disabled={busy}
              onClick={() => void applyTags()}
            >
              {t(
                'business.onboarding.firstSale.enrichment.applyTags',
                'Apply AI tags'
              )}
            </Button>
          )}
        </Stack>
      }
    >
      {mode === 'photo'
        ? t(
            'business.onboarding.firstSale.enrichment.photoBody',
            'Add a second photo angle to improve quality and approval chances.'
          )
        : t(
            'business.onboarding.firstSale.enrichment.tagsBody',
            'We can suggest tags so customers find your product faster.'
          )}
    </Alert>
  );
};

export default ProductEnrichmentNudge;
