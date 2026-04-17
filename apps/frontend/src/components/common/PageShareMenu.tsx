import { Share as ShareIcon } from '@mui/icons-material';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { usePageShare, type ShareChannel } from '../../hooks/usePageShare';

export interface PageShareMenuProps {
  shareUrl: string;
  shareTitle: string;
  shareDescription?: string;
}

const CHANNELS: ShareChannel[] = [
  'whatsapp',
  'telegram',
  'x',
  'facebook',
  'linkedin',
  'email',
];

const CHANNEL_DEFAULTS: Record<ShareChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  email: 'Email',
};

export default function PageShareMenu({
  shareUrl,
  shareTitle,
  shareDescription,
}: PageShareMenuProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { canUseNativeShare, shareNative, openChannel, copyToClipboard } = usePageShare();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const payload = React.useMemo(
    () => ({ url: shareUrl, title: shareTitle, text: shareDescription }),
    [shareUrl, shareTitle, shareDescription]
  );

  const closeMenu = () => setAnchorEl(null);

  const handleCopy = async () => {
    closeMenu();
    const ok = await copyToClipboard(shareUrl);
    enqueueSnackbar(
      ok
        ? t('common.share.copySuccess', 'Link copied')
        : t('common.share.copyError', 'Could not copy link'),
      { variant: ok ? 'success' : 'error' }
    );
  };

  const handleNative = async () => {
    closeMenu();
    await shareNative(payload);
  };

  const handleChannel = (channel: ShareChannel) => {
    closeMenu();
    openChannel(channel, payload);
  };

  const labelKey = (ch: ShareChannel): string => `common.share.${ch}`;

  return (
    <>
      <Tooltip title={t('common.share.openMenu', 'Share')}>
        <IconButton
          aria-label={t('common.share.ariaLabel', 'Share this page')}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="medium"
          edge="end"
        >
          <ShareIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={open} onClose={closeMenu}>
        <MenuItem onClick={handleCopy}>{t('common.share.copyLink', 'Copy link')}</MenuItem>
        {canUseNativeShare && (
          <MenuItem onClick={handleNative}>
            {t('common.share.nativeShare', 'Share…')}
          </MenuItem>
        )}
        {CHANNELS.map((ch) => (
          <MenuItem key={ch} onClick={() => handleChannel(ch)}>
            {t(labelKey(ch), CHANNEL_DEFAULTS[ch])}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
