import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationDir = resolve(
  __dirname,
  '../../../hasura/migrations/Rendasua/20260526120000_split_location_tracking_consent_by_platform'
);

const readMigration = (fileName: string) =>
  readFileSync(resolve(migrationDir, fileName), 'utf8');

describe('agent location consent platform split migration', () => {
  it('copies existing consent into both platform columns before dropping it', () => {
    const sql = readMigration('up.sql');
    const copyIndex = sql.indexOf(
      'location_tracking_consent_ios = location_tracking_consent'
    );
    const dropIndex = sql.indexOf('DROP COLUMN location_tracking_consent');

    expect(copyIndex).toBeGreaterThan(-1);
    expect(sql).toContain(
      'location_tracking_consent_android = location_tracking_consent'
    );
    expect(dropIndex).toBeGreaterThan(copyIndex);
  });

  it('restores one platform value into the legacy column before rollback drop', () => {
    const sql = readMigration('down.sql');
    const copyIndex = sql.indexOf('SET location_tracking_consent =');
    const dropIndex = sql.indexOf(
      'DROP COLUMN IF EXISTS location_tracking_consent_ios'
    );

    expect(copyIndex).toBeGreaterThan(-1);
    expect(sql).toContain('location_tracking_consent_android');
    expect(sql).toContain('location_tracking_consent_ios');
    expect(dropIndex).toBeGreaterThan(copyIndex);
  });
});
