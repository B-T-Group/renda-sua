import { Button, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  text: string;
  translationAvailable?: boolean;
  onTranslate?: (text: string) => Promise<string | null>;
};

export function RejectionReasonBlock({
  text,
  translationAvailable,
  onTranslate,
}: Props) {
  const { t } = useTranslation();
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = translated ?? text;

  const handleTranslate = async () => {
    if (!onTranslate) return;
    if (translated) {
      setTranslated(null);
      return;
    }
    setBusy(true);
    try {
      const next = await onTranslate(text);
      if (next) setTranslated(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {shown}
      </Typography>
      {translationAvailable && onTranslate ? (
        <Button size="small" onClick={() => void handleTranslate()} disabled={busy}>
          {translated
            ? t('business.items.recovery.showOriginal', 'Show original')
            : t('business.items.recovery.translate', 'Translate')}
        </Button>
      ) : null}
    </>
  );
}
