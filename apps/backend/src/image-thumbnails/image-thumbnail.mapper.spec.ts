import { toImageUrlBundle } from './image-thumbnail.mapper';
import {
  claimMutation,
  markFailedMutation,
  markReadyMutation,
} from './image-thumbnails.queries';

describe('toImageUrlBundle', () => {
  const base = {
    id: 'img-1',
    image_url: 'https://bucket.s3.amazonaws.com/original.jpg',
  };

  it('falls back to the original while pending', () => {
    const bundle = toImageUrlBundle({ ...base, thumbnail_status: 'pending' });
    expect(bundle.url).toBe(base.image_url);
    expect(bundle.thumbnail).toBeNull();
    expect(bundle.status).toBe('pending');
    expect(bundle.original).toBe(base.image_url);
  });

  it('uses the thumbnail when ready', () => {
    const bundle = toImageUrlBundle({
      ...base,
      thumbnail: 'https://bucket.s3.amazonaws.com/thumb.webp',
      thumbnail_status: 'ready',
    });
    expect(bundle.url).toBe('https://bucket.s3.amazonaws.com/thumb.webp');
    expect(bundle.thumbnail).toBe('https://bucket.s3.amazonaws.com/thumb.webp');
    expect(bundle.status).toBe('ready');
  });

  it('ignores a thumbnail URL when status is failed', () => {
    const bundle = toImageUrlBundle({
      ...base,
      thumbnail: 'https://bucket.s3.amazonaws.com/thumb.webp',
      thumbnail_status: 'failed',
    });
    expect(bundle.url).toBe(base.image_url);
    expect(bundle.thumbnail).toBeNull();
  });

  it('prefers display_url when provided', () => {
    const bundle = toImageUrlBundle({
      ...base,
      display_url: 'https://bucket.s3.amazonaws.com/display.webp',
      thumbnail_status: 'ready',
      thumbnail: 'https://bucket.s3.amazonaws.com/thumb.webp',
    });
    expect(bundle.url).toBe('https://bucket.s3.amazonaws.com/display.webp');
  });

  it('treats missing status as pending', () => {
    const bundle = toImageUrlBundle(base);
    expect(bundle.status).toBe('pending');
    expect(bundle.url).toBe(base.image_url);
  });
});

describe('thumbnail queries', () => {
  it('claims only pending/failed rows on the right table', () => {
    const itemClaim = claimMutation('item_image');
    expect(itemClaim).toContain('update_item_images(');
    expect(itemClaim).toContain('_in: ["pending", "failed"]');
    expect(itemClaim).toContain('_inc: { thumbnail_attempts: 1 }');
    expect(claimMutation('rental_item_image')).toContain(
      'update_rental_item_images('
    );
  });

  it('marks ready with all lifecycle fields', () => {
    const ready = markReadyMutation('item_image');
    expect(ready).toContain('thumbnail_status: "ready"');
    expect(ready).toContain('thumbnail_generated_at: $now');
    expect(ready).toContain('thumbnail_error: null');
  });

  it('guards terminal writes against stale workers', () => {
    for (const mutation of [
      markReadyMutation('item_image'),
      markFailedMutation('item_image', 'failed'),
    ]) {
      expect(mutation).toContain('thumbnail_status: { _eq: "processing" }');
      expect(mutation).toContain('image_url: { _eq: $sourceImageUrl }');
    }
  });

  it('supports failed and skipped terminal states', () => {
    expect(markFailedMutation('item_image', 'failed')).toContain(
      'thumbnail_status: "failed"'
    );
    expect(markFailedMutation('rental_item_image', 'skipped')).toContain(
      'thumbnail_status: "skipped"'
    );
  });
});
