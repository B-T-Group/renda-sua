import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Divider, IconButton, Menu, Snackbar } from 'react-native-paper';

import { usePageShare } from '../../hooks/usePageShare';
import type { ShareChannel } from '../../utils/pageShareChannels';

const CHANNELS: ShareChannel[] = ['whatsapp', 'telegram', 'x', 'facebook', 'linkedin', 'email'];

const CHANNEL_DEFAULTS: Record<ShareChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  x: 'X (Twitter)',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  email: 'Email',
};

export interface InventoryItemShareButtonProps {
  shareUrl: string;
  shareTitle: string;
  shareDescription?: string;
}

export function InventoryItemShareButton({
  shareUrl,
  shareTitle,
  shareDescription,
}: InventoryItemShareButtonProps) {
  const { t } = useTranslation();
  const { canUseNativeShare, shareNative, openChannel, copyToClipboard } = usePageShare();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const payload = useMemo(
    () => ({ url: shareUrl, title: shareTitle, text: shareDescription }),
    [shareUrl, shareTitle, shareDescription]
  );

  const closeMenu = () => setMenuOpen(false);

  const onCopy = async () => {
    closeMenu();
    const ok = await copyToClipboard(shareUrl);
    setCopyFeedback(
      ok ? t('common.share.copySuccess', 'Link copied') : t('common.share.copyError', 'Could not copy link')
    );
  };

  const onNative = async () => {
    closeMenu();
    await shareNative(payload);
  };

  const onChannel = (ch: ShareChannel) => {
    closeMenu();
    void openChannel(ch, payload);
  };

  const labelKey = (ch: ShareChannel) => `common.share.${ch}`;

  return (
    <View>
      <Menu
        visible={menuOpen}
        onDismiss={closeMenu}
        anchor={
          <IconButton
            icon="share-variant"
            onPress={() => setMenuOpen(true)}
            accessibilityLabel={t('common.share.ariaLabel', 'Share this page')}
          />
        }
      >
        <Menu.Item onPress={() => void onCopy()} title={t('common.share.copyLink', 'Copy link')} />
        {canUseNativeShare ? (
          <Menu.Item onPress={() => void onNative()} title={t('common.share.nativeShare', 'Share…')} />
        ) : null}
        <Divider />
        {CHANNELS.map((ch) => (
          <Menu.Item
            key={ch}
            onPress={() => onChannel(ch)}
            title={t(labelKey(ch), CHANNEL_DEFAULTS[ch])}
          />
        ))}
      </Menu>
      <Snackbar visible={!!copyFeedback} onDismiss={() => setCopyFeedback(null)} duration={3000}>
        {copyFeedback}
      </Snackbar>
    </View>
  );
}
