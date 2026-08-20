import {
  GET_VARIANT_IMAGE_BY_ID,
  GET_VARIANT_IMAGE_BY_ID_WITH_OWNER,
  GET_VARIANT_IMAGES,
  UPDATE_VARIANT_IMAGE,
  VARIANT_IMAGE_FIELDS,
  VERSION_IMAGE_FIELDS,
} from './ai-image-cleanup.queries';

const VARIANT_UNSUPPORTED_FIELDS = [
  'width',
  'height',
  'validation_warnings',
  'validation_errors',
  'quality_score',
];

function selectedFields(fragment: string): string[] {
  return fragment
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'));
}

describe('AI image cleanup variant GraphQL fields', () => {
  it('keeps item/rental version fields including dimensions', () => {
    expect(selectedFields(VERSION_IMAGE_FIELDS)).toEqual(
      expect.arrayContaining(VARIANT_UNSUPPORTED_FIELDS)
    );
  });

  it('does not select missing item_variant_images columns', () => {
    const fields = selectedFields(VARIANT_IMAGE_FIELDS);
    for (const field of VARIANT_UNSUPPORTED_FIELDS) {
      expect(fields).not.toContain(field);
    }
    expect(fields).toEqual(
      expect.arrayContaining([
        'id',
        'image_url',
        's3_key',
        'original_image_url',
        'enhanced_image_url',
        'rembg_image_url',
        'active_version',
        'content_hash',
      ])
    );
  });

  it('uses variant fields for variant image queries and mutations', () => {
    for (const operation of [
      GET_VARIANT_IMAGES,
      GET_VARIANT_IMAGE_BY_ID,
      GET_VARIANT_IMAGE_BY_ID_WITH_OWNER,
      UPDATE_VARIANT_IMAGE,
    ]) {
      expect(operation).toContain('content_hash');
      expect(operation).not.toMatch(/\bwidth\b/);
      expect(operation).not.toMatch(/\bheight\b/);
      expect(operation).not.toContain('validation_warnings');
      expect(operation).not.toContain('quality_score');
    }
    expect(UPDATE_VARIANT_IMAGE).toContain('item_variant_images_set_input');
  });
});
