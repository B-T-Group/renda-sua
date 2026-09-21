import { BadRequestException } from '@nestjs/common';
import { CreditCampaignService } from './credit-campaign.service';
import { CreateCampaignDto } from './payment-programs.dto';

function campaignInput(
  overrides: Partial<CreateCampaignDto> = {}
): CreateCampaignDto & { createdBy?: string | null } {
  return {
    name: ' CM launch ',
    countryCode: 'cm',
    persona: 'client',
    startsAt: '2026-09-21T00:00:00.000Z',
    endsAt: '2026-10-21T00:00:00.000Z',
    currency: 'XAF',
    storeScope: 'any_store',
    businessId: '11111111-1111-4111-8111-111111111111',
    subjectAmount: 500,
    subjectBonusIfReferred: 250,
    referrerAmount: 100,
    createdBy: 'admin-1',
    ...overrides,
  };
}

describe('CreditCampaignService.create', () => {
  it('rejects a window whose end is not after the start', async () => {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const service = new CreditCampaignService(hasura as never);

    await expect(
      service.create(
        campaignInput({
          startsAt: '2026-10-21T00:00:00.000Z',
          endsAt: '2026-10-21T00:00:00.000Z',
        })
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('stores any_store campaigns without a business_id', async () => {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(async () => ({
        insert_credit_campaigns_one: { id: 'camp-1' },
      })),
    };
    const service = new CreditCampaignService(hasura as never);

    await expect(service.create(campaignInput())).resolves.toEqual({
      id: 'camp-1',
    });
    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertCreditCampaign'),
      {
        object: expect.objectContaining({
          name: 'CM launch',
          country_code: 'CM',
          store_scope: 'any_store',
          business_id: null,
          max_referrer_rewards: 5,
          created_by: 'admin-1',
        }),
      }
    );
  });

  it('keeps business_id only for specific_business campaigns', async () => {
    const hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(async () => ({
        insert_credit_campaigns_one: { id: 'camp-2' },
      })),
    };
    const service = new CreditCampaignService(hasura as never);
    const businessId = '11111111-1111-4111-8111-111111111111';

    await service.create(
      campaignInput({ storeScope: 'specific_business', businessId })
    );

    expect(hasura.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('InsertCreditCampaign'),
      {
        object: expect.objectContaining({
          store_scope: 'specific_business',
          business_id: businessId,
        }),
      }
    );
  });
});
