import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessItemCollections } from '../../hooks/useBusinessItemCollections';

export interface ManageItemCollectionsDialogProps {
  open: boolean;
  itemId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function ManageItemCollectionsDialog({
  open,
  itemId,
  onClose,
  onSaved,
}: ManageItemCollectionsDialogProps) {
  const { t, i18n } = useTranslation();
  const {
    collections,
    suggestions,
    loading,
    saving,
    error,
    saveCollections,
  } = useBusinessItemCollections(itemId, open);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(
      new Set(collections.filter((c) => c.assigned).map((c) => c.id))
    );
  }, [collections, open]);

  const labelFor = (c: { name_en: string; name_fr: string }) =>
    i18n.language?.startsWith('fr') ? c.name_fr : c.name_en;

  const suggestedIds = useMemo(
    () => new Set(suggestions.map((s) => s.collectionId)),
    [suggestions]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySuggestions = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of suggestions) next.add(s.collectionId);
      return next;
    });
  };

  const handleSave = async () => {
    const ok = await saveCollections([...selected]);
    if (ok) {
      onSaved?.();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('business.items.collections.title', 'Collections')}
      </DialogTitle>
      <DialogContent>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {suggestions.length > 0 ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('business.items.collections.suggestions', 'Suggested')}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                  {suggestions.map((s) => (
                    <Chip
                      key={s.collectionId}
                      label={labelFor(s)}
                      size="small"
                      color={s.source === 'ai' ? 'secondary' : 'default'}
                      variant="outlined"
                    />
                  ))}
                </Stack>
                <Button size="small" onClick={applySuggestions}>
                  {t(
                    'business.items.collections.applySuggestions',
                    'Apply suggestions'
                  )}
                </Button>
              </Box>
            ) : null}
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {collections.map((c) => (
                <Chip
                  key={c.id}
                  label={labelFor(c)}
                  clickable
                  color={selected.has(c.id) ? 'primary' : 'default'}
                  variant={selected.has(c.id) ? 'filled' : 'outlined'}
                  onClick={() => toggle(c.id)}
                  sx={
                    suggestedIds.has(c.id) && !selected.has(c.id)
                      ? { borderStyle: 'dashed' }
                      : undefined
                  }
                />
              ))}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || loading}>
          {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
