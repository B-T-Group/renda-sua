import { HttpException, HttpStatus } from '@nestjs/common';

/** Where an export interest came from. Stored on product_interest_requests.source. */
export const PRODUCT_INTEREST_SOURCES = ['in_app', 'public_export_catalog'] as const;
export type ProductInterestSource = (typeof PRODUCT_INTEREST_SOURCES)[number];

export function resolveProductInterestSource(raw?: string | null): ProductInterestSource {
  if (raw == null || raw === '') return 'in_app';
  if ((PRODUCT_INTEREST_SOURCES as readonly string[]).includes(raw)) {
    return raw as ProductInterestSource;
  }
  throw new HttpException(
    {
      success: false,
      error: 'INVALID_INTEREST_SOURCE',
      message: `source must be one of ${PRODUCT_INTEREST_SOURCES.join(', ')}`,
    },
    HttpStatus.BAD_REQUEST
  );
}

/**
 * The browsing market (ISO-2) is required for export interest and export orders. There is
 * no default market: guessing CM sent leads for markets the item never ships to.
 */
export function requireExportCountry(countryCode?: string | null): string {
  const code = typeof countryCode === 'string' ? countryCode.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new HttpException(
      {
        success: false,
        error: 'COUNTRY_CODE_REQUIRED',
        message: 'countryCode (ISO-2 browsing market) is required',
      },
      HttpStatus.BAD_REQUEST
    );
  }
  return code;
}

export function isExportedToMarket(
  exportMarkets: Array<{ country_code?: string | null }> | null | undefined,
  country: string
): boolean {
  return (exportMarkets ?? []).some(
    (m) => (m?.country_code ?? '').trim().toUpperCase() === country
  );
}

/** 400 NOT_EXPORTED_TO_MARKET when `country` is not one of the item's export destinations. */
export function assertExportedToMarket(
  exportMarkets: Array<{ country_code?: string | null }> | null | undefined,
  country: string
): void {
  if (isExportedToMarket(exportMarkets, country)) return;
  throw new HttpException(
    {
      success: false,
      error: 'NOT_EXPORTED_TO_MARKET',
      message: `This item is not exported to ${country}`,
    },
    HttpStatus.BAD_REQUEST
  );
}
