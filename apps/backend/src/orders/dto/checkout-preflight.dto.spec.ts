import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { OrdersController } from '../orders.controller';
import { CheckoutPreflightDto } from './checkout-preflight.dto';

describe('CheckoutPreflightDto ValidationPipe (NODE-NESTJS-4F)', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const meta = { type: 'body' as const, metatype: CheckoutPreflightDto };
  const run = (body: unknown) => pipe.transform(body, meta);

  const validItem = {
    business_inventory_id: '11111111-1111-4111-8111-111111111111',
    quantity: 1,
  };

  it('accepts a cart with one valid item', async () => {
    await expect(run({ items: [validItem] })).resolves.toMatchObject({
      items: [validItem],
    });
  });

  it.each([
    ['missing body fields', {}],
    ['items omitted', { provisional_country: 'CM' }],
    ['items null', { items: null }],
    ['items empty', { items: [] }],
    ['items not an array', { items: validItem }],
  ])('rejects %s with a 400', async (_label, body) => {
    const error = await run(body).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
  });

  it('is attached to POST /orders/checkout/preflight', () => {
    const params = Reflect.getMetadata(
      '__routeArguments__',
      OrdersController,
      'resolveCheckoutPreflight'
    ) as Record<string, { index: number; pipes?: unknown[] }>;
    const bodyArg = Object.values(params ?? {}).find((arg) => arg.index === 1);
    expect(bodyArg?.pipes?.[0]).toBeInstanceOf(ValidationPipe);
  });
});
