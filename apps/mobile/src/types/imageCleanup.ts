export type ImageCleanupKind = 'rembg' | 'ai';

/** Per-photo choice on upload tiles: none / remove bg / AI. */
export type ImageCleanupKindSelection = ImageCleanupKind | null;

export type ImageActiveVersion = 'original' | 'rembg' | 'enhanced';

export type ImageCleanupSelection = {
  imageId: string;
  kind: ImageCleanupKind;
};

export type AiImageCleanupRequestBody = {
  imageIds?: string[];
  selections?: ImageCleanupSelection[];
};
