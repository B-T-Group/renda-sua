import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
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
import type {
  ItemVariant,
  VariantParentDefaults,
} from '../../../types/itemVariant';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
} from '../../../types/itemVariant';
import ConfirmationModal from '../../common/ConfirmationModal';
import VariantWizardDialog from './VariantWizardDialog';

export interface VariantsManagerSectionProps {
  itemId: string;
  parentItem: VariantParentDefaults;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'XAF',
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

const VariantsManagerSection: React.FC<VariantsManagerSectionProps> = ({
  itemId,
  parentItem,
}) => {
  const { t } = useTranslation();
  const { listVariants, deleteVariant, setDefaultVariant } =
    useItemVariants(itemId);
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ItemVariant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ItemVariant | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setVariants(await listVariants());
    } finally {
      setLoading(false);
    }
  }, [listVariants]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const siblingSkus = useMemo(
    () =>
      variants
        .filter((v) => v.id !== editing?.id && v.sku)
        .map((v) => v.sku as string),
    [variants, editing?.id]
  );

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
        <Stack spacing={1.5}>
          {variants.map((v) => (
            <VariantCard
              key={v.id}
              variant={v}
              parentItem={parentItem}
              onEdit={() => openEdit(v)}
              onDelete={() => setDeleteTarget(v)}
              onSetDefault={() => void setDefaultVariant(v.id).then(refresh)}
            />
          ))}
        </Stack>
      )}

      <VariantWizardDialog
        open={formOpen}
        itemId={itemId}
        parentItem={parentItem}
        initial={editing}
        siblingSkus={siblingSkus}
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

interface VariantCardProps {
  variant: ItemVariant;
  parentItem: VariantParentDefaults;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

const VariantCard: React.FC<VariantCardProps> = ({
  variant,
  parentItem,
  onEdit,
  onDelete,
  onSetDefault,
}) => {
  const { t } = useTranslation();
  const inactive = variant.is_active === false;
  const thumb = primaryVariantImageUrl(variant);
  const price = effectiveVariantUnitPrice(variant, parentItem.price);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        opacity: inactive ? 0.55 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'action.hover',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {thumb ? (
            <Box
              component="img"
              src={thumb}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              {t('business.variants.noImage', 'No image')}
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography fontWeight={600} noWrap>
              {variant.name}
            </Typography>
            {variant.is_default ? (
              <Chip
                size="small"
                color="primary"
                label={t('business.variants.defaultBadge', 'Default')}
              />
            ) : null}
            {inactive ? (
              <Chip
                size="small"
                label={t('business.variants.inactiveBadge', 'Inactive')}
              />
            ) : null}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {formatMoney(price, parentItem.currency)}
            {variant.sku ? ` · ${variant.sku}` : ''}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center">
          {!variant.is_default ? (
            <Button size="small" onClick={onSetDefault}>
              {t('business.variants.setDefault', 'Set default')}
            </Button>
          ) : null}
          <IconButton size="small" aria-label="edit" onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="delete" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
};

export default VariantsManagerSection;
