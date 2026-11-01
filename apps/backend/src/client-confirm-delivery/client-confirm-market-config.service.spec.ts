import { ClientConfirmMarketConfigService } from './client-confirm-market-config.service';
import {
  CONFIG_AUTO_COMPLETE_HOURS,
  CONFIG_GIFT_BUYER_CAN_CONFIRM,
  CONFIG_GRACE_MINUTES,
  CONFIG_NONSTRIPE_SUPPORT_HOURS,
  DEFAULT_AUTO_COMPLETE_HOURS,
  DEFAULT_GRACE_MINUTES,
  DEFAULT_NONSTRIPE_SUPPORT_HOURS,
} from './client-confirm-delivery.constants';

function build(rows: Array<Record<string, unknown>> = [], rail = 'stripe') {
  const hasura = {
    executeQuery: jest.fn().mockResolvedValue({
      application_configurations: rows,
    }),
  };
  const paymentRouting = {
    resolveRailForCountry: jest.fn().mockResolvedValue(rail),
  };
  const svc = new ClientConfirmMarketConfigService(
    hasura as never,
    paymentRouting as never
  );
  return { svc, hasura, paymentRouting };
}

describe('ClientConfirmMarketConfigService', () => {
  it('uses defaults and does not ask for a rail when the order has no country', async () => {
    const { svc, paymentRouting } = build();

    const config = await svc.forOrder({
      fulfillment_country: '   ',
      business_location: { address: { country: '' } },
    });

    expect(config).toMatchObject({
      countryCode: null,
      isStripeRail: false,
      autoCompleteHours: DEFAULT_AUTO_COMPLETE_HOURS,
      graceMinutes: DEFAULT_GRACE_MINUTES,
      nonStripeSupportHours: DEFAULT_NONSTRIPE_SUPPORT_HOURS,
      giftBuyerCanConfirm: true,
    });
    expect(paymentRouting.resolveRailForCountry).not.toHaveBeenCalled();
  });

  it('reads the business-location country when fulfillment country is blank', async () => {
    const { svc, paymentRouting } = build([], 'mobile_money');

    const config = await svc.forOrder({
      fulfillment_country: ' ',
      business_location: { address: { country: ' cm ' } },
    });

    expect(config.countryCode).toBe('CM');
    expect(config.isStripeRail).toBe(false);
    expect(paymentRouting.resolveRailForCountry).toHaveBeenCalledWith('CM');
  });

  it('prefers a positive country override and ignores a non-positive one', async () => {
    const { svc } = build(
      [
        {
          config_key: CONFIG_AUTO_COMPLETE_HOURS,
          country_code: null,
          number_value: 9,
        },
        {
          config_key: CONFIG_AUTO_COMPLETE_HOURS,
          country_code: 'ca',
          number_value: 6,
        },
        {
          config_key: CONFIG_GRACE_MINUTES,
          country_code: null,
          number_value: 9,
        },
        {
          config_key: CONFIG_GRACE_MINUTES,
          country_code: 'CA',
          number_value: 0,
        },
        {
          config_key: CONFIG_NONSTRIPE_SUPPORT_HOURS,
          country_code: 'CA',
          number_value: -3,
        },
        {
          config_key: CONFIG_GIFT_BUYER_CAN_CONFIRM,
          country_code: null,
          boolean_value: true,
        },
        {
          config_key: CONFIG_GIFT_BUYER_CAN_CONFIRM,
          country_code: 'CA',
          boolean_value: false,
        },
      ],
      'stripe'
    );

    const config = await svc.forOrder({ fulfillment_country: ' ca ' });

    expect(config.countryCode).toBe('CA');
    expect(config.isStripeRail).toBe(true);
    expect(config.autoCompleteHours).toBe(6);
    expect(config.graceMinutes).toBe(DEFAULT_GRACE_MINUTES);
    expect(config.nonStripeSupportHours).toBe(DEFAULT_NONSTRIPE_SUPPORT_HOURS);
    expect(config.giftBuyerCanConfirm).toBe(false);
  });

  it('keeps the Stripe rail and the on defaults when config rows fail to load', async () => {
    const { svc, hasura } = build([], 'stripe');
    hasura.executeQuery.mockRejectedValue(new Error('hasura down'));

    const config = await svc.forOrder({ fulfillment_country: 'CA' });

    expect(config.isStripeRail).toBe(true);
    expect(config.autoCompleteHours).toBe(DEFAULT_AUTO_COMPLETE_HOURS);
    expect(config.graceMinutes).toBe(DEFAULT_GRACE_MINUTES);
    expect(config.nonStripeSupportHours).toBe(DEFAULT_NONSTRIPE_SUPPORT_HOURS);
    expect(config.giftBuyerCanConfirm).toBe(true);
  });

  it('treats a missing or unreadable number as the default, not zero', async () => {
    const { svc } = build([
      {
        config_key: CONFIG_AUTO_COMPLETE_HOURS,
        country_code: null,
        number_value: 'nope',
      },
      {
        config_key: CONFIG_GRACE_MINUTES,
        country_code: null,
        number_value: null,
      },
    ]);

    const config = await svc.forOrder({ fulfillment_country: 'CA' });

    expect(config.autoCompleteHours).toBe(DEFAULT_AUTO_COMPLETE_HOURS);
    expect(config.graceMinutes).toBe(DEFAULT_GRACE_MINUTES);
    expect(config.giftBuyerCanConfirm).toBe(true);
  });
});
