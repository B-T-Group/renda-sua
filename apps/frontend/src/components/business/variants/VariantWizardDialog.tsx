import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Step,
  StepLabel,
  Stepper,
} from '@mui/material';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAws } from '../../../hooks/useAws';
import {
  CreateItemVariantPayload,
  VariantApiError,
  useItemVariants,
} from '../../../hooks/useItemVariants';
import type {
  ItemVariant,
  VariantParentDefaults,
} from '../../../types/itemVariant';
import { suggestVariantName } from '../../../types/itemVariant';
import VariantDetailsStep from './VariantDetailsStep';
import VariantImagesStep, {
  StagedImage,
  stagedFromVariantImages,
} from './VariantImagesStep';

export interface VariantWizardDialogProps {
  open: boolean;
  itemId: string;
  parentItem: VariantParentDefaults;
  initial: ItemVariant | null;
  siblingSkus: string[];
  onClose: () => void;
  onSaved: () => void;
}

const emptyFromParent = (
  parent: VariantParentDefaults
): CreateItemVariantPayload => ({
  name: '',
  sku: null,
  price: parent.price ?? null,
  weight: parent.weight ?? null,
  weight_unit: parent.weight_unit ?? 'g',
  dimensions: parent.dimensions ?? null,
  color: parent.color ?? null,
  is_default: false,
  is_active: true,
  sort_order: 0,
});

function formFromInitial(initial: ItemVariant): CreateItemVariantPayload {
  return {
    name: initial.name,
    sku: initial.sku ?? null,
    price: initial.price ?? null,
    weight: initial.weight ?? null,
    weight_unit: initial.weight_unit ?? 'g',
    dimensions: initial.dimensions ?? null,
    color: initial.color ?? null,
    is_default: !!initial.is_default,
    is_active: initial.is_active !== false,
    sort_order: initial.sort_order ?? 0,
  };
}

function skuConflicts(
  sku: string | null | undefined,
  siblingSkus: string[]
): boolean {
  const normalized = sku?.trim().toLowerCase();
  if (!normalized) return false;
  return siblingSkus.some((s) => s.trim().toLowerCase() === normalized);
}

function applyColorName(
  prev: CreateItemVariantPayload,
  patch: Partial<CreateItemVariantPayload>,
  itemName: string,
  nameManual: boolean,
  lastAutoName: string
): CreateItemVariantPayload {
  const next = { ...prev, ...patch };
  const shouldAuto =
    !nameManual || prev.name === lastAutoName || !prev.name.trim();
  if (!shouldAuto) return next;
  next.name = suggestVariantName(itemName, patch.color);
  return next;
}

const VariantWizardDialog: React.FC<VariantWizardDialogProps> = ({
  open,
  itemId,
  parentItem,
  initial,
  siblingSkus,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { generateImageUploadUrl } = useAws();
  const {
    createVariant,
    updateVariant,
    addVariantImage,
    updateVariantImage,
    deleteVariantImage,
  } = useItemVariants(itemId);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateItemVariantPayload>(
    emptyFromParent(parentItem)
  );
  const [images, setImages] = useState<StagedImage[]>([]);
  const [nameManual, setNameManual] = useState(false);
  const [lastAutoName, setLastAutoName] = useState('');
  const [skuError, setSkuError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const bucketName = useMemo(
    () => process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads',
    []
  );

  const resetWizard = useCallback(() => {
    setStep(0);
    setSkuError(null);
    setSaveError(null);
    setNameManual(!!initial);
    if (initial) {
      setForm(formFromInitial(initial));
      setImages(stagedFromVariantImages(initial.item_variant_images ?? []));
      setLastAutoName('');
      return;
    }
    const base = emptyFromParent(parentItem);
    const suggested = suggestVariantName(parentItem.name, base.color);
    setForm(suggested ? { ...base, name: suggested } : base);
    setLastAutoName(suggested);
    setImages([]);
  }, [initial, parentItem]);

  useEffect(() => {
    if (!open) return;
    resetWizard();
  }, [open, resetWizard]);

  const patchForm = (patch: Partial<CreateItemVariantPayload>) => {
    if (patch.sku !== undefined) setSkuError(null);
    if (patch.color === undefined) {
      setForm((prev) => ({ ...prev, ...patch }));
      return;
    }
    setForm((prev) =>
      applyColorName(prev, patch, parentItem.name, nameManual, lastAutoName)
    );
    const suggested = suggestVariantName(parentItem.name, patch.color);
    const shouldAuto =
      !nameManual || form.name === lastAutoName || !form.name.trim();
    if (shouldAuto) {
      setLastAutoName(suggested);
      setNameManual(false);
    }
  };

  const uploadNewImage = async (
    variantId: string,
    file: File,
    displayOrder: number,
    isPrimary: boolean
  ) => {
    const presigned = await generateImageUploadUrl({
      bucketName,
      originalFileName: file.name,
      contentType: file.type || 'image/jpeg',
      prefix: `item-variants/${variantId}`,
    });
    if (!presigned?.success || !presigned.data) return;
    await axios.put(presigned.data.url, file, {
      headers: { 'Content-Type': file.type || 'image/jpeg' },
    });
    const url = `https://${bucketName}.s3.amazonaws.com/${presigned.data.key}`;
    await addVariantImage(variantId, {
      image_url: url,
      is_primary: isPrimary,
      display_order: displayOrder,
    });
  };

  const applyImageChanges = async (variantId: string) => {
    for (const img of images) {
      if (img.kind === 'existing' && img.markedForRemoval) {
        await deleteVariantImage(img.id);
      }
    }
    const kept = images.filter(
      (img) => img.kind === 'new' || !img.markedForRemoval
    );
    for (let order = 0; order < kept.length; order += 1) {
      const img = kept[order];
      if (img.kind === 'new') {
        await uploadNewImage(variantId, img.file, order, !!img.is_primary);
      } else {
        await updateVariantImage(img.id, {
          display_order: order,
          is_primary: !!img.is_primary,
        });
      }
    }
  };

  const conflictMessage = () =>
    t(
      'business.variants.skuConflict',
      'This SKU is already used by another variant of this item.'
    );

  const handleSave = async () => {
    const name = form.name?.trim() || parentItem.name;
    if (!name) return;
    if (skuConflicts(form.sku, siblingSkus)) {
      setSkuError(conflictMessage());
      return;
    }
    setSaving(true);
    setSkuError(null);
    setSaveError(null);
    try {
      const payload = { ...form, name };
      const saved = initial?.id
        ? await updateVariant(initial.id, payload)
        : await createVariant(payload);
      await applyImageChanges(saved.id);
      onSaved();
      onClose();
    } catch (error: any) {
      if (error instanceof VariantApiError && error.isSkuConflict) {
        setSkuError(conflictMessage());
        setStep(1);
      } else {
        const message =
          error instanceof VariantApiError
            ? error.message
            : error?.message ||
              t('business.variants.saveFailed', 'Failed to save variant');
        setSaveError(message);
        enqueueSnackbar(message, { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initial
          ? t('business.variants.editTitle', 'Edit variant')
          : t('business.variants.addTitle', 'Add variant')}
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 3, pt: 1 }}>
          <Step>
            <StepLabel>
              {t('business.variants.stepImages', 'Images')}
            </StepLabel>
          </Step>
          <Step>
            <StepLabel>
              {t('business.variants.stepDetails', 'Details')}
            </StepLabel>
          </Step>
        </Stepper>
        {saveError ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        ) : null}
        {step === 0 ? (
          <VariantImagesStep images={images} onChange={setImages} />
        ) : (
          <VariantDetailsStep
            form={form}
            parentItem={parentItem}
            namePlaceholder={parentItem.name}
            skuError={skuError}
            onChange={patchForm}
            onNameManualEdit={() => setNameManual(true)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        {step > 0 ? (
          <Button onClick={() => setStep(0)} disabled={saving}>
            {t('common.back', 'Back')}
          </Button>
        ) : null}
        {step === 0 ? (
          <Button variant="contained" onClick={() => setStep(1)}>
            {t('common.next', 'Next')}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {t('common.save', 'Save')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VariantWizardDialog;
