import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ProductTaxCategoryField } from '../ProductTaxCategoryField';
import { useTheme } from '@/contexts/ThemeContext';
import { STRIPE_TAX_CODE_GENERAL_TANGIBLE } from '@/hooks/business/useStripeTaxCodes';
import { useIsStripeRail } from '@/hooks/useIsStripeRail';
import { businessApi } from '@/services/businessApi';
import type { BusinessCatalogItem } from '@/types/business/items';

type Props = {
  item: BusinessCatalogItem;
  onChanged: () => void;
  onMessage: (text: string) => void;
};

export function ItemTaxCategorySection({ item, onChanged, onMessage }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { isStripeRail, loading, status } = useIsStripeRail();
  const [saving, setSaving] = useState(false);
  const showTax = status == null || isStripeRail;
  const currentId = item.stripe_tax_code_id ?? STRIPE_TAX_CODE_GENERAL_TANGIBLE;

  const saveTaxCode = useCallback(
    async (id: string) => {
      if (id === currentId) return;
      setSaving(true);
      try {
        const res = await businessApi.catalog.updateItem(item.id, {
          stripe_tax_code_id: id,
        });
        if (!res.success) throw new Error('update failed');
        onMessage(t('items.taxCategory.updated', 'Tax category updated'));
        onChanged();
      } catch (e: unknown) {
        onMessage(
          e instanceof Error && e.message !== 'update failed'
            ? e.message
            : t('items.taxCategory.updateFailed', 'Could not update tax category')
        );
      } finally {
        setSaving(false);
      }
    },
    [currentId, item.id, onChanged, onMessage, t]
  );

  if (!showTax) return null;

  return (
    <View style={{ marginTop: spacing.md }}>
      <ProductTaxCategoryField
        value={currentId}
        selectedLabel={item.stripe_tax_code?.name}
        onChange={(id) => void saveTaxCode(id)}
        disabled={saving || loading}
      />
    </View>
  );
}
