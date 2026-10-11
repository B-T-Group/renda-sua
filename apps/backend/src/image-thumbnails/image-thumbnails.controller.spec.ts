import 'reflect-metadata';
import { PERMISSIONS_KEY } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { ImageThumbnailsController } from './image-thumbnails.controller';

describe('ImageThumbnailsController access', () => {
  it('requires a platform permission (AdminAuthGuard alone admits any role holder, e.g. a country admin)', () => {
    const perms = Reflect.getMetadata(PERMISSIONS_KEY, ImageThumbnailsController);
    expect(perms).toEqual([PlatformPermissions.CATALOG_CROSS_BUSINESS]);
  });
});
