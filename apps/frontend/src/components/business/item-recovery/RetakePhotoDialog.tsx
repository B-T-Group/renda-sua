import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NeedsChangesIllustration } from '../../illustrations/NeedsChangesIllustration';

export type ItemPhotoOption = { id: string; image_url: string };

type Props = {
  open: boolean;
  photos: ItemPhotoOption[];
  uploading?: boolean;
  onClose: () => void;
  onPickFile: (file: File, replaceImageId: string | null) => Promise<void>;
};

export function RetakePhotoDialog({
  open,
  photos,
  uploading,
  onClose,
  onPickFile,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [replaceId, setReplaceId] = useState(photos[0]?.id ?? '');

  const handleFile = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    void onPickFile(file, mode === 'replace' ? replaceId || null : null);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('business.items.recovery.action.retake', 'Retake photo')}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="flex-start">
          <NeedsChangesIllustration category="photo_quality" size={64} />
          <Typography>
            {t(
              'business.items.recovery.retake.tips',
              'Use daylight, a plain background, and show any wear.'
            )}
          </Typography>
          <TipList />
          <FormControl>
            <RadioGroup
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as 'add' | 'replace')
              }
            >
              <FormControlLabel
                value="add"
                control={<Radio />}
                label={t('business.items.recovery.retake.add', 'Add photo')}
              />
              <FormControlLabel
                value="replace"
                control={<Radio />}
                disabled={photos.length === 0}
                label={t(
                  'business.items.recovery.retake.replace',
                  'Replace photo'
                )}
              />
            </RadioGroup>
          </FormControl>
          {mode === 'replace' && photos.length > 0 ? (
            <FormControl>
              <RadioGroup
                value={replaceId}
                onChange={(event) => setReplaceId(event.target.value)}
              >
                {photos.map((photo, index) => (
                  <FormControlLabel
                    key={photo.id}
                    value={photo.id}
                    control={<Radio />}
                    label={`${t('business.items.recovery.retake.photo', 'Photo')} ${index + 1}`}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        <Button
          component="label"
          variant="contained"
          startIcon={<PhotoCameraIcon />}
          disabled={uploading}
        >
          {t('business.items.recovery.retake.choose', 'Choose photo')}
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event.target.files)}
          />
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TipList() {
  const { t } = useTranslation();
  const tips = [
    t('business.items.recovery.retake.tipDaylight', 'Use daylight'),
    t('business.items.recovery.retake.tipBackground', 'Use a plain background'),
    t(
      'business.items.recovery.retake.tipWhole',
      'Show the whole item plus one close-up'
    ),
    t(
      'business.items.recovery.retake.tipNoWatermark',
      'No watermarks or stock photos'
    ),
    t('business.items.recovery.retake.tipWear', 'Show real wear'),
  ];
  return (
    <Stack component="ul" sx={{ m: 0, pl: 2 }}>
      {tips.map((tip) => (
        <Typography component="li" key={tip} variant="body2">
          {tip}
        </Typography>
      ))}
    </Stack>
  );
}
