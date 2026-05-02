import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useItemVariants } from '../../../hooks/useItemVariants';
import type { ItemVariant } from '../../../types/itemVariant';
import ConfirmationModal from '../../common/ConfirmationModal';
import VariantFormDialog from './VariantFormDialog';
import VariantImagesEditor from './VariantImagesEditor';

export interface VariantsManagerSectionProps {
  itemId: string;
}

const VariantsManagerSection: React.FC<VariantsManagerSectionProps> = ({
  itemId,
}) => {
  const { t } = useTranslation();
  const {
    listVariants,
    deleteVariant,
    setDefaultVariant,
  } = useItemVariants(itemId);
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ItemVariant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemVariant | null>(null);

  const bucketName = useMemo(
    () => process.env.REACT_APP_S3_BUCKET_NAME || 'rendasua-uploads',
    []
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listVariants();
      setVariants(data);
    } finally {
      setLoading(false);
    }
  }, [listVariants]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (v: ItemVariant) => {
    setEditing(v);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteVariant(deleteTarget.id);
    setDeleteTarget(null);
    void refresh();
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" fontWeight={600}>
          {t('business.variants.sectionTitle', 'Variants')}
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          {t('business.variants.add', 'Add variant')}
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(
          'business.variants.sectionHint',
          'Optional sizes or packaging. Inventory stock stays shared across variants.'
        )}
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : variants.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('business.variants.empty', 'No variants yet.')}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {variants.map((v) => (
            <Paper key={v.id} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={1}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600}>{v.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[v.sku, v.price != null ? String(v.price) : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Typography>
                  {v.is_default ? (
                    <Typography variant="caption" color="primary" display="block">
                      {t('business.variants.default', 'Default option')}
                    </Typography>
                  ) : null}
                </Box>
                <Stack direction="row">
                  {!v.is_default ? (
                    <Button
                      size="small"
                      onClick={() => void setDefaultVariant(v.id).then(refresh)}
                    >
                      {t('business.variants.setDefault', 'Set default')}
                    </Button>
                  ) : null}
                  <IconButton
                    size="small"
                    aria-label="edit"
                    onClick={() => openEdit(v)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="delete"
                    onClick={() => setDeleteTarget(v)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
              <VariantImagesEditor
                itemId={itemId}
                variant={v}
                bucketName={bucketName}
                onChanged={refresh}
              />
            </Paper>
          ))}
        </Stack>
      )}

      <VariantFormDialog
        open={formOpen}
        itemId={itemId}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        title={t('business.variants.deleteTitle', 'Delete variant?')}
        message={t(
          'business.variants.deleteMessage',
          'This cannot be undone. Orders that reference this variant keep their snapshot.'
        )}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
        confirmText={t('common.delete', 'Delete')}
        confirmColor="error"
      />
    </Box>
  );
};

export default VariantsManagerSection;
