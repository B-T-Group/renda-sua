import { Delete as DeleteIcon, Star as StarIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import axios from 'axios';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAws } from '../../../hooks/useAws';
import { useItemVariants } from '../../../hooks/useItemVariants';
import type { ItemVariant, ItemVariantImage } from '../../../types/itemVariant';

export interface VariantImagesEditorProps {
  itemId: string;
  variant: ItemVariant;
  bucketName: string;
  onChanged: () => void;
}

const VariantImagesEditor: React.FC<VariantImagesEditorProps> = ({
  itemId,
  variant,
  bucketName,
  onChanged,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { generateImageUploadUrl } = useAws();
  const { addVariantImage, deleteVariantImage, updateVariantImage } =
    useItemVariants(itemId);

  const images = variant.item_variant_images ?? [];

  const uploadFile = async (file: File) => {
    const presigned = await generateImageUploadUrl({
      bucketName,
      originalFileName: file.name,
      contentType: file.type || 'image/jpeg',
      prefix: `item-variants/${variant.id}`,
    });
    if (!presigned?.success || !presigned.data) return;
    await axios.put(presigned.data.url, file, {
      headers: { 'Content-Type': file.type || 'image/jpeg' },
    });
    const url = `https://${bucketName}.s3.amazonaws.com/${presigned.data.key}`;
    await addVariantImage(variant.id, {
      image_url: url,
      is_primary: images.length === 0,
      display_order: images.length,
    });
    onChanged();
  };

  const handleFiles = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      await uploadFile(f);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (img: ItemVariantImage) => {
    setBusy(true);
    try {
      await deleteVariantImage(img.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handlePrimary = async (img: ItemVariantImage) => {
    setBusy(true);
    try {
      for (const i of images) {
        await updateVariantImage(i.id, {
          is_primary: i.id === img.id,
        });
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" gutterBottom fontWeight={600}>
        {t('business.variants.imagesTitle', 'Variant images')}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {images.map((img) => (
          <Paper
            key={img.id}
            variant="outlined"
            sx={{
              width: 72,
              height: 72,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              component="img"
              src={img.image_url}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                bgcolor: 'background.paper',
              }}
              onClick={() => void handleDelete(img)}
              disabled={busy}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                bgcolor: img.is_primary ? 'warning.light' : 'background.paper',
              }}
              onClick={() => void handlePrimary(img)}
              disabled={busy}
            >
              <StarIcon fontSize="small" />
            </IconButton>
          </Paper>
        ))}
      </Stack>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        size="small"
        variant="outlined"
        sx={{ mt: 1 }}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {t('business.variants.uploadImage', 'Upload image')}
      </Button>
    </Box>
  );
};

export default VariantImagesEditor;
