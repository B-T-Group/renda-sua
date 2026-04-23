import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  combinedProductTagLabelsForItem,
  type BusinessItemLike,
} from '../../utils/facebookCatalogCsv';

export interface FacebookExportSelectDialogProps {
  open: boolean;
  onClose: () => void;
  items: BusinessItemLike[] | null | undefined;
  onConfirm: (selectedItemIds: Set<string>) => void;
}

type Row = { id: string; name: string; tagsAndLocations: string; listingCount: number };

function buildRows(list: BusinessItemLike[] | null | undefined): Row[] {
  if (!list?.length) {
    return [];
  }
  return list
    .map((it) => {
      const invs = it.business_inventories ?? [];
      return {
        id: it.id,
        name: it.name?.trim() || it.id,
        tagsAndLocations: combinedProductTagLabelsForItem(it).join(', '),
        listingCount: invs.filter((v) => v?.id).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

const FacebookExportSelectDialog: React.FC<FacebookExportSelectDialogProps> = ({
  open,
  onClose,
  items,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = useMemo(() => buildRows(items), [items]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(new Set((items || []).map((i) => i.id)));
  }, [open, items]);

  const allIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }, [allSelected, allIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    onConfirm(new Set(selected));
  }, [onConfirm, selected]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { m: 0, borderRadius: 0, display: 'flex', maxHeight: '100%' } }}
    >
      <DialogTitle
        component="div"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}
      >
        <Box>
          <Typography variant="h6" component="span">
            {t(
              'business.items.facebookExport.selectTitle',
              'Select products to export'
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pr: 1 }}>
            {t(
              'business.items.facebookExport.selectSubtitle',
              'Check the products to include. The CSV has one row per store listing. All location names for a product are added to the product tags columns.'
            )}
          </Typography>
        </Box>
        <IconButton onClick={onClose} edge="end" aria-label={t('common.close', 'Close')}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ flex: 1, minHeight: 0, p: 0, display: 'flex', flexDirection: 'column' }}>
        <Toolbar variant="dense" sx={{ pl: 1, pr: 2, minHeight: 48, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={toggleAll} disabled={rows.length === 0}>
              {allSelected
                ? t('business.items.facebookExport.deselectAll', 'Deselect all')
                : t('business.items.facebookExport.selectAll', 'Select all')}
            </Button>
          </Stack>
        </Toolbar>
        <TableContainer sx={{ flex: 1, maxHeight: '100%', overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 48, bgcolor: 'background.paper' }}>
                  <Checkbox
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={toggleAll}
                    inputProps={{ 'aria-label': t('common.selectAll', 'Select all') }}
                  />
                </TableCell>
                <TableCell>
                  {t('business.items.facebookExport.columnProduct', 'Product')}
                </TableCell>
                <TableCell>
                  {t(
                    'business.items.facebookExport.columnTagsAndLocations',
                    'Tags & locations'
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {t('business.items.facebookExport.columnListings', 'Listings')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} hover selected={selected.has(r.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                    />
                  </TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {r.tagsAndLocations || '—'}
                  </TableCell>
                  <TableCell align="right">{r.listingCount}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    {t('business.items.facebookExport.selectEmpty', 'No products to export.')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} sx={{ borderRadius: 0 }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={selected.size === 0}
          startIcon={<DownloadIcon />}
          sx={{ borderRadius: 0 }}
        >
          {t('business.items.facebookExport.download', 'Download CSV')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FacebookExportSelectDialog;
