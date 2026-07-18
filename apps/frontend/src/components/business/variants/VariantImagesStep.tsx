import {
  Delete as DeleteIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  Star as StarIcon,
} from '@mui/icons-material';
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type StagedExistingImage = {
  kind: 'existing';
  id: string;
  image_url: string;
  markedForRemoval: boolean;
  is_primary: boolean;
};

export type StagedNewImage = {
  kind: 'new';
  localId: string;
  file: File;
  previewUrl: string;
  is_primary: boolean;
};

export type StagedImage = StagedExistingImage | StagedNewImage;

export interface VariantImagesStepProps {
  images: StagedImage[];
  onChange: (images: StagedImage[]) => void;
}

function visibleImages(images: StagedImage[]): StagedImage[] {
  return images.filter(
    (img) => img.kind === 'new' || !img.markedForRemoval
  );
}

const VariantImagesStep: React.FC<VariantImagesStepProps> = ({
  images,
  onChange,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const visible = visibleImages(images);

  const previewSrc = (img: StagedImage) =>
    img.kind === 'existing' ? img.image_url : img.previewUrl;

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: StagedNewImage[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({
        kind: 'new' as const,
        localId: `${Date.now()}-${file.name}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        is_primary: false,
      }));
    if (!next.length) return;
    const merged = [...images, ...next];
    if (!visibleImages(merged).some((i) => i.is_primary) && next[0]) {
      next[0].is_primary = true;
    }
    onChange([...images, ...next]);
  };

  const setPrimary = (target: StagedImage) => {
    onChange(
      images.map((img) => ({
        ...img,
        is_primary: img === target || keyOf(img) === keyOf(target),
      }))
    );
  };

  const removeOrMark = (target: StagedImage) => {
    if (target.kind === 'new') {
      URL.revokeObjectURL(target.previewUrl);
      const next = images.filter((img) => keyOf(img) !== keyOf(target));
      ensurePrimary(next);
      return;
    }
    const next = images.map((img) =>
      img.kind === 'existing' && img.id === target.id
        ? { ...img, markedForRemoval: true, is_primary: false }
        : img
    );
    ensurePrimary(next);
  };

  const ensurePrimary = (next: StagedImage[]) => {
    const vis = visibleImages(next);
    if (!vis.length) {
      onChange(next);
      return;
    }
    if (vis.some((i) => i.is_primary)) {
      onChange(next);
      return;
    }
    const firstKey = keyOf(vis[0]);
    onChange(
      next.map((img) => ({
        ...img,
        is_primary: keyOf(img) === firstKey,
      }))
    );
  };

  const move = (index: number, delta: number) => {
    const vis = visibleImages(images);
    const target = vis[index];
    const swapWith = vis[index + delta];
    if (!target || !swapWith) return;
    const a = images.findIndex((img) => keyOf(img) === keyOf(target));
    const b = images.findIndex((img) => keyOf(img) === keyOf(swapWith));
    if (a < 0 || b < 0) return;
    const next = [...images];
    [next[a], next[b]] = [next[b], next[a]];
    onChange(next);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'business.variants.imagesStepHint',
          'Add photos for this variant. Choose a primary image and reorder as needed.'
        )}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {visible.map((img, index) => (
          <Paper
            key={keyOf(img)}
            variant="outlined"
            sx={{
              width: 96,
              height: 96,
              position: 'relative',
              overflow: 'hidden',
              opacity: img.kind === 'existing' && img.markedForRemoval ? 0.4 : 1,
              outline: img.is_primary ? '2px solid' : 'none',
              outlineColor: 'warning.main',
            }}
          >
            <Box
              component="img"
              src={previewSrc(img)}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <IconButton
              size="small"
              aria-label={t('business.variants.removeImage', 'Remove')}
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                bgcolor: 'background.paper',
              }}
              onClick={() => removeOrMark(img)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={t('business.variants.setPrimary', 'Set primary')}
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                bgcolor: img.is_primary ? 'warning.light' : 'background.paper',
              }}
              onClick={() => setPrimary(img)}
            >
              <StarIcon fontSize="small" />
            </IconButton>
            <Stack
              direction="row"
              sx={{ position: 'absolute', bottom: 0, right: 0 }}
            >
              <IconButton
                size="small"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                sx={{ bgcolor: 'background.paper' }}
              >
                <KeyboardArrowLeft fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                disabled={index >= visible.length - 1}
                onClick={() => move(index, 1)}
                sx={{ bgcolor: 'background.paper' }}
              >
                <KeyboardArrowRight fontSize="small" />
              </IconButton>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => inputRef.current?.click()}
        >
          {t('business.variants.uploadImage', 'Upload image')}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => captureRef.current?.click()}
        >
          {t('business.variants.takePhoto', 'Take photo')}
        </Button>
      </Stack>
    </Box>
  );
};

function keyOf(img: StagedImage): string {
  return img.kind === 'existing' ? img.id : img.localId;
}

export function stagedFromVariantImages(
  images: Array<{
    id: string;
    image_url: string;
    is_primary: boolean;
    display_order: number;
  }>
): StagedImage[] {
  return [...images]
    .sort((a, b) => a.display_order - b.display_order)
    .map((img) => ({
      kind: 'existing' as const,
      id: img.id,
      image_url: img.image_url,
      markedForRemoval: false,
      is_primary: !!img.is_primary,
    }));
}

export default VariantImagesStep;
