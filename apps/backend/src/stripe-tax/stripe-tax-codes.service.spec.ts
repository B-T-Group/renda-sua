import { StripeTaxCodesService } from './stripe-tax-codes.service';
import { STRIPE_TAX_CODE_GENERAL_TANGIBLE } from './stripe-tax.constants';

describe('StripeTaxCodesService', () => {
  const database = {
    isActiveCode: jest.fn(),
  };
  const stripeService = { listAllTaxCodes: jest.fn() };
  const configService = {
    get: () => ({ secretKey: 'sk_test' }),
  };

  const service = new StripeTaxCodesService(
    stripeService as any,
    database as any,
    configService as any
  );

  it('defaults empty tax code to general tangible goods', async () => {
    database.isActiveCode.mockResolvedValue(true);
    const id = await service.validateTaxCodeId(undefined);
    expect(id).toBe(STRIPE_TAX_CODE_GENERAL_TANGIBLE);
  });

  it('rejects inactive tax codes', async () => {
    database.isActiveCode.mockResolvedValue(false);
    await expect(service.validateTaxCodeId('txcd_invalid')).rejects.toThrow(
      'Invalid or inactive'
    );
  });

  it('derives group name from Stripe code label', () => {
    expect(service.deriveGroupName('General - Tangible Goods')).toBe('General');
  });
});
