type AddressForMatching = {
  is_primary?: boolean;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type MetaPixelAdvancedMatchingInput = {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  country?: string | null;
  addresses?: AddressForMatching[];
};

export type MetaPixelAdvancedMatchingParams = {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  external_id?: string;
  ct?: string;
  st?: string;
  zp?: string;
  country?: string;
};

function primaryAddress(
  addresses?: AddressForMatching[]
): AddressForMatching | undefined {
  return addresses?.find((a) => a.is_primary) ?? addresses?.[0];
}

function twoLetterCountry(value?: string | null): string | undefined {
  const letters = (value ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
  return letters.length === 2 ? letters : undefined;
}

/** Unhashed advanced matching params; Pixel hashes them. */
export function buildMetaPixelAdvancedMatching(
  profile: MetaPixelAdvancedMatchingInput
): MetaPixelAdvancedMatchingParams {
  const addr = primaryAddress(profile.addresses);
  const country = twoLetterCountry(addr?.country) ?? twoLetterCountry(profile.country);
  return {
    external_id: profile.id,
    ...(profile.email?.trim() && { em: profile.email.trim().toLowerCase() }),
    ...(profile.phone_number?.trim() && {
      ph: profile.phone_number.replace(/\D/g, ''),
    }),
    ...(profile.first_name?.trim() && {
      fn: profile.first_name.trim().toLowerCase(),
    }),
    ...(profile.last_name?.trim() && {
      ln: profile.last_name.trim().toLowerCase(),
    }),
    ...(addr?.city?.trim() && {
      ct: addr.city.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
    }),
    ...(addr?.state?.trim() && {
      st: addr.state.trim().toLowerCase().replace(/[^a-z]/g, ''),
    }),
    ...(addr?.postal_code?.trim() && {
      zp: addr.postal_code.trim().toLowerCase().replace(/\s+/g, ''),
    }),
    ...(country && { country }),
  };
}
