import { buildMerchantContractFormFields } from './boldsign-merchant-form-fields';

describe('buildMerchantContractFormFields', () => {
  it('maps known BoldSign field ids and skips empties', () => {
    const fields = buildMerchantContractFormFields({
      companyName: 'Home Cake',
      addressLine1: '12 Rue Example',
      state: 'Centre',
      phone: '+237600000000',
      website: '  ',
      sector: null,
      email: 'owner@example.com',
      signerName: 'Ada Lovelace',
    });
    expect(fields).toEqual([
      { id: 'companyName', value: 'Home Cake' },
      { id: 'addressLine1', value: '12 Rue Example' },
      { id: 'state', value: 'Centre' },
      { id: 'phone', value: '+237600000000' },
      { id: 'email', value: 'owner@example.com' },
      { id: 'name1', value: 'Ada Lovelace' },
      { id: 'name2', value: 'Ada Lovelace' },
    ]);
  });
});
