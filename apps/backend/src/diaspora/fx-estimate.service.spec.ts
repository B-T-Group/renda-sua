import { ConfigService } from '@nestjs/config';
import { FxEstimateService } from './fx-estimate.service';

function makeService(fxRates: Record<string, number>): FxEstimateService {
  const configService = {
    get: (key: string) => (key === 'diaspora' ? { fxRates } : undefined),
  } as unknown as ConfigService;
  return new FxEstimateService(configService);
}

describe('FxEstimateService', () => {
  const rates = { 'XAF:CAD': 0.00224, 'XAF:USD': 0.00165 };

  it('converts a merchant total into the payer currency', () => {
    const actual = makeService(rates).estimate({
      amount: 14500,
      merchantCurrency: 'XAF',
      payerCountry: 'CA',
    });

    expect(actual).toEqual({
      currency: 'CAD',
      amount: 32.48,
      rate: 0.00224,
      source: 'indicative_config',
    });
  });

  it('returns null when no rate is configured, so the UI hides the FX line', () => {
    expect(
      makeService({}).estimate({
        amount: 14500,
        merchantCurrency: 'XAF',
        payerCountry: 'CA',
      })
    ).toBeNull();
  });

  it('returns null when the payer country has no presentment currency', () => {
    expect(
      makeService(rates).estimate({
        amount: 14500,
        merchantCurrency: 'XAF',
        payerCountry: 'GA',
      })
    ).toBeNull();
  });

  it('returns null when payer and merchant already share a currency', () => {
    expect(
      makeService({ 'CAD:CAD': 1 }).estimate({
        amount: 40,
        merchantCurrency: 'CAD',
        payerCountry: 'CA',
      })
    ).toBeNull();
  });

  it('returns null for a non-positive amount', () => {
    expect(
      makeService(rates).estimate({
        amount: 0,
        merchantCurrency: 'XAF',
        payerCountry: 'CA',
      })
    ).toBeNull();
  });

  it('maps launch payer countries to their presentment currency', () => {
    const service = makeService(rates);
    expect(service.payerCurrencyForCountry('ca')).toBe('CAD');
    expect(service.payerCurrencyForCountry('US')).toBe('USD');
    expect(service.payerCurrencyForCountry('CM')).toBeNull();
  });
});
