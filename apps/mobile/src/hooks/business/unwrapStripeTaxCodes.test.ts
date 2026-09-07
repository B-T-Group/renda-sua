import { unwrapStripeTaxCodes } from './useStripeTaxCodes';

describe('unwrapStripeTaxCodes', () => {
  it('reads codes from the Nest body (mobile api.get)', () => {
    expect(
      unwrapStripeTaxCodes({
        codes: [{ id: 'txcd_40040013', name: 'Meat and Meat Products' }],
        total: 1,
      })
    ).toEqual([{ id: 'txcd_40040013', name: 'Meat and Meat Products' }]);
  });

  it('does not treat a missing axios wrapper as an empty list', () => {
    expect(unwrapStripeTaxCodes({ total: 4, limit: 200, offset: 0 })).toEqual(
      []
    );
  });

  it('still accepts axios-shaped { data: { codes } }', () => {
    expect(
      unwrapStripeTaxCodes({
        data: { codes: [{ id: 'txcd_1', name: 'General - Tangible Goods' }] },
      })
    ).toEqual([{ id: 'txcd_1', name: 'General - Tangible Goods' }]);
  });
});
