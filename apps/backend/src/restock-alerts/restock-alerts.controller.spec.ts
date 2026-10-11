import { ValidationPipe } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { PatchRestockPreferencesDto } from './dto/restock-alerts.dto';
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

describe('PATCH restock-alerts/preferences ValidationPipe', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const validate = (body: unknown) =>
    pipe.transform(body, {
      type: 'body',
      metatype: PatchRestockPreferencesDto,
    });

  it('keeps boolean channel flags', async () => {
    await expect(validate({ push: true, sms: false })).resolves.toEqual({
      push: true,
      sms: false,
    });
  });

  it.each([{ push: 'nope' }, { whatsapp: 'true' }, { sms: 1 }])(
    'rejects a non-boolean channel flag %p',
    async (body) => {
      await expect(validate(body)).rejects.toBeInstanceOf(Error);
    }
  );
});
