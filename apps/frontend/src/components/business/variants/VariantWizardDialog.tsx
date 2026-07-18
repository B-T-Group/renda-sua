import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useUserProfileContext } from '../../../contexts/UserProfileContext';
import { useAiImageCleanup } from '../../../hooks/useAiImageCleanup';
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

type UploadedCleanupImage = { id: string; image_url: string };

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
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { profile, updateBusinessAiTokens } = useUserProfileContext();
  const { generateImageUploadUrl } = useAws();
  const { requestVariantCleanup } = useAiImageCleanup();
  const {
    createVariant,
    updateVariant,
    addVariantImage,
    updateVariantImage,
    deleteVariantImage,
  } = useItemVariants(itemId);

  const aiTokensRemaining = profile?.business?.ai_tokens ?? 0;

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
  const [cleanupVariantId, setCleanupVariantId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedCleanupImage[]>(
    []
  );
  const [cleanupSelection, setCleanupSelection] = useState<string[]>([]);

  const bucketName = useMemo(
    () => process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads',
    []
  );

  const resetWizard = useCallback(() => {
    setStep(0);
    setSkuError(null);
    setSaveError(null);
    setCleanupVariantId(null);
    setUploadedImages([]);
    setCleanupSelection([]);
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
  ): Promise<UploadedCleanupImage | null> => {
    const presigned = await generateImageUploadUrl({
      bucketName,
      originalFileName: file.name,
      contentType: file.type || 'image/jpeg',
      prefix: `item-variants/${variantId}`,
    });
    if (!presigned?.success || !presigned.data) return null;
    await axios.put(presigned.data.url, file, {
      headers: { 'Content-Type': file.type || 'image/jpeg' },
    });
    const url = `https://${bucketName}.s3.amazonaws.com/${presigned.data.key}`;
    const created = await addVariantImage(variantId, {
      image_url: url,
      is_primary: isPrimary,
      display_order: displayOrder,
    });
    return created;
  };

  const applyImageChanges = async (
    variantId: string
  ): Promise<UploadedCleanupImage[]> => {
    for (const img of images) {
      if (img.kind === 'existing' && img.markedForRemoval) {
        await deleteVariantImage(img.id);
      }
    }
    const kept = images.filter(
      (img) => img.kind === 'new' || !img.markedForRemoval
    );
    const created: UploadedCleanupImage[] = [];
    for (let order = 0; order < kept.length; order += 1) {
      const img = kept[order];
      if (img.kind === 'new') {
        const row = await uploadNewImage(
          variantId,
          img.file,
          order,
          !!img.is_primary
        );
        if (row) created.push(row);
      } else {
        await updateVariantImage(img.id, {
          display_order: order,
          is_primary: !!img.is_primary,
        });
      }
    }
    return created;
  };

  const conflictMessage = () =>
    t(
      'business.variants.skuConflict',
      'This SKU is already used by another variant of this item.'
    );

  const finish = () => {
    onSaved();
    onClose();
  };

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
      const created = await applyImageChanges(saved.id);
      enqueueSnackbar(t('business.variants.saved', 'Variant saved'), {
        variant: 'success',
      });
      if (created.length && aiTokensRemaining > 0) {
        setCleanupVariantId(saved.id);
        setUploadedImages(created);
        setCleanupSelection(
          created
            .map((c) => c.id)
            .slice(0, Math.max(1, aiTokensRemaining))
        );
        setStep(2);
        onSaved();
      } else {
        finish();
      }
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

  const toggleCleanupImage = (imageId: string) => {
    setCleanupSelection((prev) => {
      if (prev.includes(imageId)) return prev.filter((id) => id !== imageId);
      if (prev.length >= aiTokensRemaining) return prev;
      return [...prev, imageId];
    });
  };

  const handleCleanupOptIn = async () => {
    if (!cleanupVariantId || !cleanupSelection.length) return;
    setSaving(true);
    try {
      const res = await requestVariantCleanup(cleanupVariantId, cleanupSelection);
      if (typeof res?.data?.ai_tokens_remaining === 'number') {
        updateBusinessAiTokens(res.data.ai_tokens_remaining);
      }
      enqueueSnackbar(
        t(
          'business.images.asyncCleanup.started',
          'AI cleanup started — we’ll notify you when ready.'
        ),
        { variant: 'success' }
      );
      finish();
    } catch (error: any) {
      enqueueSnackbar(
        error?.message ||
          t('business.images.asyncCleanup.startFailed', 'Could not start AI cleanup'),
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = cleanupSelection.length;
  const maxSelectable = Math.min(uploadedImages.length, aiTokensRemaining);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {step === 2
          ? t('business.images.asyncCleanup.title', 'Clean up photos with AI?')
          : initial
            ? t('business.variants.editTitle', 'Edit variant')
            : t('business.variants.addTitle', 'Add variant')}
      </DialogTitle>
      <DialogContent>
        {step < 2 ? (
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
        ) : null}
        {saveError ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        ) : null}
        {step === 0 ? (
          <VariantImagesStep images={images} onChange={setImages} />
        ) : null}
        {step === 1 ? (
          <VariantDetailsStep
            form={form}
            parentItem={parentItem}
            namePlaceholder={parentItem.name}
            skuError={skuError}
            onChange={patchForm}
            onNameManualEdit={() => setNameManual(true)}
          />
        ) : null}
        {step === 2 ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'business.images.asyncCleanup.hint',
                'We’ll clean your photos in the background after you create the product. You’ll get a notification to review before and after.'
              )}
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('business.images.asyncCleanup.choosePhotos', 'Choose photos to clean')}
            </Typography>
            {aiTokensRemaining < uploadedImages.length ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t(
                  'business.images.asyncCleanup.maxSelectable',
                  'Your balance covers up to {{count}} photos.',
                  { count: maxSelectable }
                )}
              </Alert>
            ) : null}
            <Stack spacing={1} sx={{ mb: 2 }}>
              {uploadedImages.map((img) => {
                const checked = cleanupSelection.includes(img.id);
                const disabled =
                  !checked && cleanupSelection.length >= maxSelectable;
                return (
                  <FormControlLabel
                    key={img.id}
                    control={
                      <Checkbox
                        checked={checked}
                        disabled={disabled || saving}
                        onChange={() => toggleCleanupImage(img.id)}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          component="img"
                          src={img.image_url}
                          alt=""
                          sx={{
                            width: 48,
                            height: 48,
                            objectFit: 'cover',
                            borderRadius: 1,
                          }}
                        />
                        <Typography variant="body2">
                          {checked
                            ? t('business.images.asyncCleanup.selected', 'Selected')
                            : t('business.images.asyncCleanup.notSelected', 'Not selected')}
                        </Typography>
                      </Stack>
                    }
                  />
                );
              })}
            </Stack>
            <Alert severity="info" icon={<AutoAwesomeIcon fontSize="inherit" />}>
              {selectedCount > 0
                ? t(
                    'business.images.asyncCleanup.tokenCost',
                    'Uses {{count}} AI tokens (1 per photo). You have {{balance}}.',
                    { count: selectedCount, balance: aiTokensRemaining }
                  )
                : t(
                    'business.images.asyncCleanup.noneSelected',
                    'Select at least one photo, or skip.'
                  )}
            </Alert>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        {step === 2 ? (
          <>
            <Button onClick={finish} disabled={saving}>
              {t('business.images.asyncCleanup.noThanks', 'No thanks')}
            </Button>
            {aiTokensRemaining < uploadedImages.length ? (
              <Button onClick={() => navigate('/business/ai-tokens')} disabled={saving}>
                {t('business.images.asyncCleanup.buyTokens', 'Buy AI tokens')}
              </Button>
            ) : null}
            <Button
              variant="contained"
              disabled={saving || selectedCount === 0}
              onClick={() => void handleCleanupOptIn()}
              startIcon={<AutoAwesomeIcon />}
            >
              {t(
                'business.images.asyncCleanup.yesCount',
                'Clean {{count}} photos in background',
                { count: selectedCount }
              )}
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VariantWizardDialog;
