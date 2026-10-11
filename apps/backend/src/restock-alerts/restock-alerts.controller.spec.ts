import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { RestockAlertsController } from './restock-alerts.controller';

describe('RestockAlertsController access', () => {
  const proto = RestockAlertsController.prototype as any;
  const isPublic = (name: string) => Reflect.getMetadata(IS_PUBLIC_KEY, proto[name]) === true;

  it('only the signed-token stop endpoint is public (the global guard blocks everything else)', () => {
    expect(isPublic('stop')).toBe(true);
    for (const name of ['status', 'getPreferences', 'patchPreferences', 'setItemAlert', 'disarmItem', 'likes']) {
      expect(isPublic(name)).toBe(false);
    }
  });
});
