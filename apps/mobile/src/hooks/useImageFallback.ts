import { useCallback, useEffect, useMemo, useState } from 'react';

export function useImageFallback(uri?: string | null) {
  const sourceUri = useMemo(() => uri?.trim() || undefined, [uri]);
  const [failedUri, setFailedUri] = useState<string | undefined>();

  useEffect(() => {
    setFailedUri(undefined);
  }, [sourceUri]);

  const onImageError = useCallback(() => {
    if (sourceUri) {
      setFailedUri(sourceUri);
    }
  }, [sourceUri]);

  return {
    sourceUri,
    hasImage: Boolean(sourceUri && sourceUri !== failedUri),
    onImageError,
  };
}
