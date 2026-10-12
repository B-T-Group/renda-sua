import { AGENT_CONTRACT_TEMPLATES } from './agent-contract-templates';
import {
  agentContractFieldIds,
  buildAgentContractFormFields,
} from './boldsign-agent-form-fields';

describe('buildAgentContractFormFields', () => {
  const sample = {
    contractNumber: 'AGT-1',
    signerName: 'Ada Lovelace',
    nationality: 'Cameroonian',
    phone: '+237600000000',
    email: 'ada@example.com',
    referralCode: '—',
    country: 'CM',
    rendasuaAddress: 'Libreville',
    address: '1 Main',
    city: 'Douala',
    idNumber: 'ID9',
  };

  it('maps every official template onto its BoldSign field ids', () => {
    const expectedPhone: Record<string, string> = {
      canada_en: 'rep_phone_number',
      canada_fr: 'agent_phone_number',
      central_africa_en: 'rep_phone_number',
      central_africa_fr: 'rep_phone_number',
      west_africa_en: 'rep_phone_umber',
      west_africa_fr: 'rep_phone_number',
    };
    for (const template of Object.values(AGENT_CONTRACT_TEMPLATES)) {
      const fields = buildAgentContractFormFields(template.key, sample);
      const phone = fields.find((field) => field.value === sample.phone);
      expect(phone?.id).toBe(expectedPhone[template.key]);
      expect(fields.some((field) => field.id.startsWith('Initial'))).toBe(false);
      expect(fields.some((field) => field.id.startsWith('Signature'))).toBe(
        false
      );
      expect(fields.some((field) => field.id.startsWith('DatePicker'))).toBe(
        false
      );
    }
  });

  it('omits empty values and skips West Africa French company address', () => {
    const fields = buildAgentContractFormFields('west_africa_fr', {
      ...sample,
      nationality: '  ',
      rendasuaAddress: 'should-not-map',
    });
    expect(fields.some((field) => field.id === 'rep_nationality')).toBe(false);
    expect(agentContractFieldIds('west_africa_fr').rendasuaAddress).toBeUndefined();
    expect(fields.some((field) => field.value === 'should-not-map')).toBe(false);
  });

  it('prefills the Canada French ID label', () => {
    const fields = buildAgentContractFormFields('canada_fr', sample);
    expect(fields).toEqual(
      expect.arrayContaining([{ id: 'rep_id_number', value: 'ID9' }])
    );
    expect(fields.filter((field) => field.id === 'Name1')).toHaveLength(1);
  });
});
