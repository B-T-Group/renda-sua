declare module 'country-currency-map' {
  export interface CountryInfo {
    name: string;
    currency: string;
    code: string;
  }

  export function getCountry(country: string): CountryInfo | null;
  export function getCurrency(country: string): string | null;
}
