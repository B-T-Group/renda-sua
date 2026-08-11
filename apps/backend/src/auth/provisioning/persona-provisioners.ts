import type { PersonaId } from '../../users/persona.types';
import type { NormalizedSignupAddress } from './signup-address.normalize';

export interface PersonaInsertContext {
  personas: PersonaId[];
  vehicle_type_id?: string;
  business_name?: string;
  main_interest?: 'sell_items' | 'rent_items';
  business_referral_agent_id?: string;
  business_referral_business_id?: string;
  business_referral_code_used?: string;
  agent_referral_agent_id?: string;
  agent_referral_business_id?: string;
  agent_referral_code_used?: string;
  /** Full store location — nested under business when present and not country-only. */
  storeAddress?: NormalizedSignupAddress;
}

export interface PersonaInsertFragment {
  varDecls: string[];
  vars: Record<string, unknown>;
  objectField: string;
  returnSel: string;
}

type PersonaFragmentBuilder = (
  ctx: PersonaInsertContext
) => PersonaInsertFragment | null;

function buildClientFragment(
  ctx: PersonaInsertContext
): PersonaInsertFragment | null {
  if (!ctx.personas.includes('client')) return null;
  return {
    varDecls: [],
    vars: {},
    objectField: 'client: { data: {} }',
    returnSel: 'client { id user_id created_at updated_at }',
  };
}

function buildAgentFragment(
  ctx: PersonaInsertContext
): PersonaInsertFragment | null {
  if (!ctx.personas.includes('agent')) return null;

  const varDecls = ['$vehicle_type_id: vehicle_types_enum!'];
  const vars: Record<string, unknown> = {
    vehicle_type_id: ctx.vehicle_type_id || 'other',
  };
  const agentDataFields = ['vehicle_type_id: $vehicle_type_id'];

  if (ctx.agent_referral_agent_id && ctx.agent_referral_code_used) {
    varDecls.push('$agent_referred_by_agent_id: uuid!');
    varDecls.push('$agent_referral_code_used: String!');
    vars.agent_referred_by_agent_id = ctx.agent_referral_agent_id;
    vars.agent_referral_code_used = ctx.agent_referral_code_used;
    agentDataFields.push('referred_by_agent_id: $agent_referred_by_agent_id');
    agentDataFields.push('referral_code_used: $agent_referral_code_used');
  } else if (ctx.agent_referral_business_id && ctx.agent_referral_code_used) {
    varDecls.push('$agent_referred_by_business_id: uuid!');
    varDecls.push('$agent_referral_code_used: String!');
    vars.agent_referred_by_business_id = ctx.agent_referral_business_id;
    vars.agent_referral_code_used = ctx.agent_referral_code_used;
    agentDataFields.push(
      'referred_by_business_id: $agent_referred_by_business_id'
    );
    agentDataFields.push('referral_code_used: $agent_referral_code_used');
  }

  return {
    varDecls,
    vars,
    objectField: `agent: { data: { ${agentDataFields.join(', ')} } }`,
    returnSel:
      'agent { id user_id vehicle_type_id is_verified created_at updated_at }',
  };
}

function buildBusinessLocationName(
  businessName: string | undefined,
  city: string
): string {
  const name = businessName?.trim();
  const cityTrimmed = city.trim();
  if (name && cityTrimmed) return `${name} - ${cityTrimmed}`;
  return name || cityTrimmed || 'HQ';
}

function buildBusinessFragment(
  ctx: PersonaInsertContext
): PersonaInsertFragment | null {
  if (!ctx.personas.includes('business')) return null;

  const varDecls = [
    '$business_name: String!',
    '$main_interest: business_main_interest_enum!',
    '$ai_tokens: Int!',
  ];
  const vars: Record<string, unknown> = {
    business_name: ctx.business_name ?? '',
    main_interest: ctx.main_interest ?? 'sell_items',
    ai_tokens: 20,
  };
  const businessDataFields = [
    'name: $business_name',
    'main_interest: $main_interest',
    'ai_tokens: $ai_tokens',
  ];

  if (ctx.business_referral_agent_id && ctx.business_referral_code_used) {
    varDecls.push('$referred_by_agent_id: uuid!');
    varDecls.push('$referral_code_used: String!');
    vars.referred_by_agent_id = ctx.business_referral_agent_id;
    vars.referral_code_used = ctx.business_referral_code_used;
    businessDataFields.push('referred_by_agent_id: $referred_by_agent_id');
    businessDataFields.push('referral_code_used: $referral_code_used');
  } else if (
    ctx.business_referral_business_id &&
    ctx.business_referral_code_used
  ) {
    varDecls.push('$referred_by_business_id: uuid!');
    varDecls.push('$referral_code_used: String!');
    vars.referred_by_business_id = ctx.business_referral_business_id;
    vars.referral_code_used = ctx.business_referral_code_used;
    businessDataFields.push('referred_by_business_id: $referred_by_business_id');
    businessDataFields.push('referral_code_used: $referral_code_used');
  }

  let returnSel =
    'business { id user_id name main_interest is_verified ai_tokens created_at updated_at';

  const store = ctx.storeAddress;
  if (store && !store.countryOnly) {
    varDecls.push(
      '$bl_name: String!',
      '$bl_location_type: location_type_enum!',
      '$bl_is_primary: Boolean!',
      '$addr_line1: String!',
      '$addr_city: String!',
      '$addr_state: String!',
      '$addr_postal: String!',
      '$addr_country: String!',
      '$addr_lat: numeric',
      '$addr_lng: numeric'
    );
    vars.bl_name = buildBusinessLocationName(ctx.business_name, store.city);
    vars.bl_location_type = 'office';
    vars.bl_is_primary = true;
    vars.addr_line1 = store.address_line_1;
    vars.addr_city = store.city;
    vars.addr_state = store.state;
    vars.addr_postal = store.postal_code || '';
    vars.addr_country = store.country;
    vars.addr_lat = store.latitude ?? null;
    vars.addr_lng = store.longitude ?? null;

    // Nested location→address is atomic with the user insert.
    // business_addresses join is created post-commit with the returned address_id
    // (Hasura cannot share a sibling nested address across array relationships).
    businessDataFields.push(`business_locations: {
      data: [{
        name: $bl_name,
        location_type: $bl_location_type,
        is_primary: $bl_is_primary,
        address: {
          data: {
            address_line_1: $addr_line1,
            city: $addr_city,
            state: $addr_state,
            postal_code: $addr_postal,
            country: $addr_country,
            latitude: $addr_lat,
            longitude: $addr_lng,
            address_type: "home"
          }
        }
      }]
    }`);
    returnSel +=
      ' business_locations { id address_id name is_primary address { id country city } }';
  }

  returnSel += ' }';

  return {
    varDecls,
    vars,
    objectField: `business: { data: { ${businessDataFields.join(', ')} } }`,
    returnSel,
  };
}

/** Ordered registry — add future personas here without touching the orchestrator. */
export const PERSONA_FRAGMENT_BUILDERS: PersonaFragmentBuilder[] = [
  buildClientFragment,
  buildAgentFragment,
  buildBusinessFragment,
];

export function buildPersonaFragments(
  ctx: PersonaInsertContext
): PersonaInsertFragment[] {
  return PERSONA_FRAGMENT_BUILDERS.map((b) => b(ctx)).filter(
    (f): f is PersonaInsertFragment => f !== null
  );
}
