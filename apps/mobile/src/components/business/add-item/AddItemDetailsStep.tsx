import React from 'react';
import { useAddItemForm } from '../../../hooks/business/useAddItemForm';
import { AddItemNameStep } from './AddItemNameStep';
import { AddItemClassificationStep } from './AddItemClassificationStep';
import { AddItemPricingStep } from './AddItemPricingStep';
import type { AddItemFormValues } from '../../../hooks/business/useAddItemForm';

export type AddItemDetailsSubPage = 'name' | 'classification' | 'pricing';

export interface AddItemDetailsStepProps {
  imageIds: string[];
  busy: boolean;
  subPage: AddItemDetailsSubPage;
  onSubPageChange: (page: AddItemDetailsSubPage) => void;
  onSubmit: (form: AddItemFormValues) => void;
}

export function AddItemDetailsStep({
  imageIds,
  busy,
  subPage,
  onSubPageChange,
  onSubmit,
}: AddItemDetailsStepProps) {
  const form = useAddItemForm(imageIds);

  if (subPage === 'name') {
    return (
      <AddItemNameStep
        form={form}
        busy={busy}
        onContinue={() => onSubPageChange('classification')}
      />
    );
  }

  if (subPage === 'classification') {
    return (
      <AddItemClassificationStep
        form={form}
        busy={busy}
        onContinue={() => onSubPageChange('pricing')}
      />
    );
  }

  return (
    <AddItemPricingStep
      form={form}
      busy={busy}
      onSubmit={onSubmit}
    />
  );
}

