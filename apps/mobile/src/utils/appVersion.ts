import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/** App version from `app.json` / EAS build (e.g. `1.0.7`). */
export function getAppVersion(): string {
  return (
    Constants.expoConfig?.version ??
    Constants.manifest2?.extra?.expoClient?.version ??
    '—'
  );
}

export function formatAppFooterLabel(productName: string): string {
  return `${productName} · v${getAppVersion()}`;
}

export type OtaReleaseInfo = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  updateIdShort: string | null;
  createdAtIso: string | null;
};

function shortId(id: string | null | undefined): string | null {
  if (!id) return null;
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

/** Current EAS Update / OTA release metadata from `expo-updates`. */
export function getOtaReleaseInfo(): OtaReleaseInfo {
  const updateId = Updates.updateId ?? null;
  const createdAt = Updates.createdAt;
  return {
    isEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId,
    updateIdShort: shortId(updateId),
    createdAtIso: createdAt ? createdAt.toISOString() : null,
  };
}
