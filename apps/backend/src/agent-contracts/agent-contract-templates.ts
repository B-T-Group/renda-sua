export type AgentContractRegion = 'canada' | 'central_africa' | 'west_africa';

export type AgentContractTemplateKey =
  | 'canada_en'
  | 'canada_fr'
  | 'central_africa_en'
  | 'central_africa_fr'
  | 'west_africa_en'
  | 'west_africa_fr';

export interface AgentContractTemplate {
  key: AgentContractTemplateKey;
  region: AgentContractRegion;
  locale: 'en' | 'fr';
  boldsignTemplateId: string;
  rendasuaAddress: string | null;
  needsNationality: boolean;
  needsIdNumber: boolean;
  referralRequired: boolean;
}

const CANADA_ADDRESS = '3 Place Ville Marie, Montreal, Quebec, H3B 2E3';
const CENTRAL_ADDRESS = "1295, boul. de l'Indépendance, Libreville, Gabon";
const WEST_ADDRESS = 'Immeuble Ioka, Lomé, Togo';

export const AGENT_CONTRACT_TEMPLATES: Record<
  AgentContractTemplateKey,
  AgentContractTemplate
> = {
  canada_en: {
    key: 'canada_en',
    region: 'canada',
    locale: 'en',
    boldsignTemplateId: '0b3e56d6-72ba-40e9-aa31-4c114aa579a1',
    rendasuaAddress: CANADA_ADDRESS,
    needsNationality: true,
    needsIdNumber: false,
    referralRequired: true,
  },
  canada_fr: {
    key: 'canada_fr',
    region: 'canada',
    locale: 'fr',
    boldsignTemplateId: 'a6d79255-d0d4-4b02-b218-d55a8dcd367b',
    rendasuaAddress: CANADA_ADDRESS,
    needsNationality: true,
    needsIdNumber: true,
    referralRequired: false,
  },
  central_africa_en: {
    key: 'central_africa_en',
    region: 'central_africa',
    locale: 'en',
    boldsignTemplateId: '278578f4-0ddd-4619-aceb-ed713ed0845d',
    rendasuaAddress: CENTRAL_ADDRESS,
    needsNationality: false,
    needsIdNumber: false,
    referralRequired: true,
  },
  central_africa_fr: {
    key: 'central_africa_fr',
    region: 'central_africa',
    locale: 'fr',
    boldsignTemplateId: 'd8c7410e-bc8e-4a43-888f-d9a4017e6902',
    rendasuaAddress: CENTRAL_ADDRESS,
    needsNationality: true,
    needsIdNumber: false,
    referralRequired: true,
  },
  west_africa_en: {
    key: 'west_africa_en',
    region: 'west_africa',
    locale: 'en',
    boldsignTemplateId: '9be484c9-5777-416d-9ff8-e59ae1554ebf',
    rendasuaAddress: WEST_ADDRESS,
    needsNationality: true,
    needsIdNumber: false,
    referralRequired: true,
  },
  west_africa_fr: {
    key: 'west_africa_fr',
    region: 'west_africa',
    locale: 'fr',
    boldsignTemplateId: '079992c4-bc49-4021-80b0-42ce3262fd5f',
    rendasuaAddress: null,
    needsNationality: true,
    needsIdNumber: false,
    referralRequired: true,
  },
};

const CENTRAL = new Set(['CM', 'GA', 'CG', 'TD', 'CF', 'GQ']);
const WEST = new Set(['TG', 'BJ', 'CI']);

const COUNTRY_NAMES: Record<string, string> = {
  canada: 'CA',
  cameroun: 'CM',
  cameroon: 'CM',
  gabon: 'GA',
  congo: 'CG',
  togo: 'TG',
  benin: 'BJ',
  bénin: 'BJ',
  "côte d'ivoire": 'CI',
  "cote d'ivoire": 'CI',
  'ivory coast': 'CI',
};

export function normalizeAgentCountry(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAMES[raw.toLowerCase()] ?? null;
}

export function resolveAgentContractTemplate(input: {
  country?: string | null;
  addressCountry?: string | null;
  preferredLanguage?: string | null;
}): AgentContractTemplate {
  const code =
    normalizeAgentCountry(input.country) ??
    normalizeAgentCountry(input.addressCountry);
  const french = (input.preferredLanguage ?? '').toLowerCase().startsWith('fr');
  if (code === 'CA') return pick('canada', french);
  if (code && CENTRAL.has(code)) return pick('central_africa', french);
  if (code && WEST.has(code)) return pick('west_africa', french);
  return AGENT_CONTRACT_TEMPLATES.canada_en;
}

function pick(region: AgentContractRegion, french: boolean): AgentContractTemplate {
  const key = `${region}_${french ? 'fr' : 'en'}` as AgentContractTemplateKey;
  return AGENT_CONTRACT_TEMPLATES[key];
}

export function agentContractNumber(agentCode?: string | null): string {
  const code = agentCode?.trim();
  return code ? `AGT-${code}` : `AGT-${Date.now().toString(36).toUpperCase()}`;
}
