import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../../../hasura/migrations/Rendasua/20261114220000_rentals_inspection_optin');

describe('inspection opt-in migration', () => {
  const up = readFileSync(join(root, 'up.sql'), 'utf8');
  const down = readFileSync(join(root, 'down.sql'), 'utf8');
  const constants = readFileSync(join(__dirname, '../../app-config/client-flags.constants.ts'), 'utf8');

  it('seeds the flag false and does not turn pickup photo rules on', () => {
    expect(up).toContain("'rentals_inspection_optin_enabled'");
    expect(up).toContain("'boolean', false, NULL, 'active'");
    expect(up).not.toContain('rentals_pickup_photo_rules_enabled');
    expect(up).toContain('inspection_opt_in boolean NOT NULL DEFAULT false');
    expect(constants).toMatch(/rentals_inspection_optin_enabled: false/);
    expect(constants).not.toMatch(/rentals_inspection_optin_enabled:\s*isNonProduction/);
  });

  it('deactivates the flag and refuses to drop a baseline that already has photos', () => {
    expect(down).toContain('DROP TABLE IF EXISTS public.rental_item_baseline_photos');
    expect(down).toContain('DROP COLUMN IF EXISTS inspection_opt_in');
    expect(down).toContain('rentals_inspection_optin_enabled');
    expect(down).toContain("boolean_value = false");
    expect(down).toContain("status = 'inactive'");
    expect(down).toContain('rental_item_baseline_photos is not empty');
    expect(down).not.toContain('DELETE FROM public.application_configurations');
  });

  it('lets only the Nest route write the opt-in', () => {
    const table = readFileSync(
      join(__dirname, '../../../../hasura/metadata/databases/Rendasua/tables/public_rental_items.yaml'),
      'utf8'
    );
    const update = table.split('update_permissions:')[1] ?? '';
    expect(update).not.toContain('inspection_opt_in');
    expect(table.split('update_permissions:')[0]).toContain('inspection_opt_in');
    const controller = readFileSync(join(__dirname, '../rentals.controller.ts'), 'utf8');
    expect(controller).toContain("@Param('itemId', ParseUUIDPipe)");
    expect(controller).toContain("@Param('photoId', ParseUUIDPipe)");
  });
});

describe('pickup reuse snapshot migration', () => {
  const root = join(__dirname, '../../../../hasura/migrations/Rendasua/20261118160000_rentals_inspection_reuse_snapshot');
  const up = readFileSync(join(root, 'up.sql'), 'utf8');
  const down = readFileSync(join(root, 'down.sql'), 'utf8');

  it('locks the latest return and stores the request snapshot', () => {
    expect(up).toContain('CREATE OR REPLACE FUNCTION public.rental_apply_pickup_reuse');
    expect(up).toContain('RETURNS SETOF public.rental_inspection_media');
    expect(up).not.toContain('RETURNS SETOF integer');
    expect(up).toContain('RETURNING *');
    expect(up).toContain('FOR UPDATE');
    expect(up).toContain('PICKUP_REUSE_BLOCKED_DAMAGE');
    expect(up).toContain('DELETE FROM public.rental_inspection_media');
    expect(up).toContain('sha256');
    expect(up).toContain('ADD COLUMN IF NOT EXISTS inspection_policy_version integer');
    expect(up).toContain('ADD COLUMN IF NOT EXISTS exif_captured_at');
    expect(up).toContain('.view\\.(jpg|png|webp)');
    expect(up).not.toContain('return_resolution = \'accepted\'');
  });

  it('tracks the reuse function because it returns the media table', () => {
    const tracked = readFileSync(
      join(__dirname, '../../../../hasura/metadata/databases/Rendasua/functions/public_rental_apply_pickup_reuse.yaml'),
      'utf8'
    );
    const index = readFileSync(
      join(__dirname, '../../../../hasura/metadata/databases/Rendasua/functions/functions.yaml'),
      'utf8'
    );
    expect(tracked).toContain('name: rental_apply_pickup_reuse');
    expect(index).toContain('public_rental_apply_pickup_reuse.yaml');
  });

  it('zeros only XAF and XOF listing deposits and can run twice', () => {
    const root = join(__dirname, '../../../../hasura/migrations/Rendasua/20261118180000_rentals_xaf_xof_zero_deposit');
    const up = readFileSync(join(root, 'up.sql'), 'utf8');
    expect(up).toContain("IN ('XAF', 'XOF')");
    expect(up).toContain('security_deposit_amount = 0');
    expect(up).toContain('security_deposit_amount <> 0');
    expect(up).toContain('rental_items');
    expect(up).not.toContain('CAD');
  });

  it('refuses to restore the jpg-only check when png or webp views exist', () => {
    expect(down).toContain('.view.png or .view.webp');
    expect(down).toContain('the jpg-only check cannot be restored');
    expect(down.indexOf('RAISE EXCEPTION')).toBeLessThan(down.indexOf('ADD CONSTRAINT'));
  });
});
