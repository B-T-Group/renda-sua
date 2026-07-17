import { ImageUrlBundle, ThumbnailStatus } from './image-thumbnails.types';

interface ThumbnailAwareRow {
  id: string;
  image_url: string;
  thumbnail?: string | null;
  thumbnail_status?: string | null;
  display_url?: string | null;
}

/** Shape any image row into the client contract; always falls back to the original. */
export function toImageUrlBundle(row: ThumbnailAwareRow): ImageUrlBundle {
  const status = (row.thumbnail_status ?? 'pending') as ThumbnailStatus;
  const thumbnail =
    status === 'ready' && row.thumbnail ? row.thumbnail : null;
  return {
    id: row.id,
    url: row.display_url ?? thumbnail ?? row.image_url,
    original: row.image_url,
    thumbnail,
    status,
  };
}
