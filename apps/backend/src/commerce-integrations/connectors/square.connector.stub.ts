/**
 * Placeholder for future Square integration.
 * Kept so the multi-provider adapter seam remains explicit.
 */
export class SquareConnectorStub {
  readonly provider = 'square' as const;

  assertNotImplemented(): never {
    throw new Error('Square connector is not implemented yet');
  }
}

export type FutureCommerceProvider =
  | 'square'
  | 'lightspeed'
  | 'clover'
  | 'custom';
