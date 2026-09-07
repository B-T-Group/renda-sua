import { useCallback, useMemo } from 'react';
import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { PageSharePayload, ShareChannel } from '../utils/pageShareChannels';
import { hrefForShareChannel, shareLine } from '../utils/pageShareChannels';

function buildShareMessage(payload: PageSharePayload): string {
  const line = shareLine(payload);
  return `${line}\n${payload.url}`;
}

export function usePageShare() {
  const canUseNativeShare = useMemo(
    () => typeof Share.share === 'function' && Platform.OS !== 'web',
    []
  );

  const shareNative = useCallback(async (payload: PageSharePayload): Promise<boolean> => {
    if (!canUseNativeShare) return false;
    try {
      const result = await Share.share({ message: buildShareMessage(payload) });
      return result.action === Share.sharedAction;
    } catch {
      return false;
    }
  }, [canUseNativeShare]);

  const openChannel = useCallback(async (channel: ShareChannel, payload: PageSharePayload) => {
    const href = hrefForShareChannel(channel, payload);
    try {
      await Linking.openURL(href);
    } catch {
      /* ignore */
    }
  }, []);

  const copyToClipboard = useCallback(async (url: string): Promise<boolean> => {
    try {
      await Clipboard.setStringAsync(url);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { canUseNativeShare, shareNative, openChannel, copyToClipboard };
}
