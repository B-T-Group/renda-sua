import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ItemPromotionPayload,
  useItemPromotion,
} from '../../hooks/useItemPromotion';

const formatDateTimeLocal = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 16);
};

interface PageItem {
  id: string;
  business_inventories?: Array<{ promotion?: unknown }>;
}

interface PromoteItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: PageItem | null;
  onSaved: () => void;
}

function readPromotionFromItem(item: PageItem | null) {
  const invs = item?.business_inventories ?? [];
  const first = invs[0]?.promotion as
    | {
        promoted?: boolean;
        start?: string;
        end?: string;
        sponsored?: boolean;
      }
    | null
    | undefined;
  if (!first || typeof first !== 'object') {
    return {
      promoted: false,
      start: '',
      end: '',
      sponsored: false,
    };
  }
  return {
    promoted: first.promoted === true,
    start: first.start ? formatDateTimeLocal(first.start) : '',
    end: first.end ? formatDateTimeLocal(first.end) : '',
    sponsored: first.sponsored === true,
  };
}

const PromoteItemDialog: React.FC<PromoteItemDialogProps> = ({
  open,
  onClose,
  item,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { setPromotion, loading } = useItemPromotion();
  const [promoted, setPromoted] = useState(false);
  const [sponsored, setSponsored] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    if (!open || !item) return;
    const v = readPromotionFromItem(item);
    setPromoted(v.promoted);
    setSponsored(v.sponsored);
    setStart(v.start);
    setEnd(v.end);
  }, [open, item]);

  const handleClose = () => {
    onClose();
  };

  const buildPayload = (): ItemPromotionPayload => {
    if (!promoted) return { promoted: false };
    const payload: ItemPromotionPayload = { promoted: true };
    if (sponsored) payload.sponsored = true;
    if (start) payload.start = new Date(start).toISOString();
    if (end) payload.end = new Date(end).toISOString();
    return payload;
  };

  const handleSave = async () => {
    if (!item?.id) return;
    try {
      await setPromotion(item.id, buildPayload());
      enqueueSnackbar(
        t('business.items.promotion.saveSuccess', 'Promotion saved'),
        { variant: 'success' }
      );
      onSaved();
      handleClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        t('business.items.promotion.saveError', 'Failed to save promotion');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
        >
          {t(
            'business.items.promotion.dialogTitle',
            'Promote in catalogue search'
          )}
          <IconButton aria-label="close" onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'business.items.promotion.description',
            'Boost visibility when customers sort by relevance. Applies to all locations for this product.'
          )}
        </Typography>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={promoted}
                onChange={(_, v) => setPromoted(v)}
              />
            }
            label={t('business.items.promotion.promoted', 'Promoted')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={sponsored}
                onChange={(_, v) => setSponsored(v)}
                disabled={!promoted}
              />
            }
            label={t('business.items.promotion.sponsored', 'Sponsored (stronger boost)')}
          />
          <TextField
            label={t('business.items.promotion.start', 'Start (optional)')}
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={!promoted}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label={t('business.items.promotion.end', 'End (optional)')}
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={!promoted}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={loading || !item}
        >
          {loading ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PromoteItemDialog;
