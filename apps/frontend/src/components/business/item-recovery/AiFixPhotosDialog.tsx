import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ImageEnhancementCompareDialog from '../../dialogs/ImageEnhancementCompareDialog';
import {
  cleanupTokenCost,
  needsToBuyTokens,
} from '../../../utils/itemRejectionRecovery';

export type RecoveryImageOption = { id: string; image_url: string };

type CompareState = {
  resultId: string;
  originalUrl: string;
  enhancedUrl: string;
  altered: boolean;
};

type Props = {
  open: boolean;
  images: RecoveryImageOption[];
  balance: number;
  costPerImage: number;
  running?: boolean;
  onClose: () => void;
  onBuyTokens: () => void;
  onRun: (imageIds: string[]) => Promise<CompareState | null>;
  onKeep: (resultId: string) => Promise<void>;
  onDiscard: (resultId: string) => Promise<void>;
};

export function AiFixPhotosDialog({
  open,
  images,
  balance,
  costPerImage,
  running,
  onClose,
  onBuyTokens,
  onRun,
  onKeep,
  onDiscard,
}: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(
    images.slice(0, 1).map((image) => image.id)
  );
  const [compare, setCompare] = useState<CompareState | null>(null);
  const cost = cleanupTokenCost(selected.length, costPerImage);
  const buy = needsToBuyTokens(cost, balance);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  };

  const handleRun = async () => {
    const next = await onRun(selected);
    if (next) setCompare(next);
  };

  const costLabel = t('business.items.recovery.aiFix.cost', {
    n: cost,
    m: balance,
    defaultValue: `Cost: ${cost} tokens · You have ${balance}`,
  });

  return (
    <>
      <Dialog open={open && !compare} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {t('business.items.recovery.action.aiFix', 'Fix photos with AI')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t(
              'business.items.recovery.aiFix.selectPhotos',
              'Choose photos to fix'
            )}
          </Typography>
          <Stack>
            {images.map((image, index) => (
              <FormControlLabel
                key={image.id}
                control={
                  <Checkbox
                    checked={selected.includes(image.id)}
                    onChange={() => toggle(image.id)}
                  />
                }
                label={`${t('business.items.recovery.retake.photo', 'Photo')} ${index + 1}`}
              />
            ))}
          </Stack>
          <Typography sx={{ mt: 1 }}>{costLabel}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          {buy ? (
            <Button variant="contained" onClick={onBuyTokens}>
              {t('business.items.recovery.aiFix.buy', 'Buy tokens')}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={selected.length === 0 || running}
              onClick={() => void handleRun()}
            >
              {t('business.items.recovery.action.aiFix', 'Fix photos with AI')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      {compare ? (
        <CompareStep
          compare={compare}
          busy={running}
          onClose={() => setCompare(null)}
          onKeep={async () => {
            await onKeep(compare.resultId);
            setCompare(null);
            onClose();
          }}
          onDiscard={async () => {
            await onDiscard(compare.resultId);
            setCompare(null);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}

function CompareStep({
  compare,
  busy,
  onClose,
  onKeep,
  onDiscard,
}: {
  compare: CompareState;
  busy?: boolean;
  onClose: () => void;
  onKeep: () => Promise<void>;
  onDiscard: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const warning = compare.altered
    ? t(
        'business.items.recovery.aiFix.altered',
        'AI may have changed the item itself. Check carefully.'
      )
    : undefined;

  return (
    <ImageEnhancementCompareDialog
      open
      onClose={onClose}
      originalUrl={compare.originalUrl}
      enhancedUrl={compare.enhancedUrl}
      busy={busy}
      preferOriginal={compare.altered}
      warning={warning}
      originalLabel={t('business.items.recovery.aiFix.discard', 'Discard')}
      enhancedLabel={t('business.items.recovery.aiFix.keep', 'Keep')}
      onUseOriginal={() => void onDiscard()}
      onUseEnhanced={() => void onKeep()}
    />
  );
}
