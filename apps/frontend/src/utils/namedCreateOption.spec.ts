import {
  filterWithCreateOption,
  isCreateNamedOption,
} from './namedCreateOption';

describe('filterWithCreateOption', () => {
  const options = [{ name: 'Food' }, { name: 'Clothing' }];

  it('filters by name and adds a create option for new values', () => {
    const result = filterWithCreateOption(options, 'Shoes', (name) => `Add "${name}"`);
    expect(result).toEqual([
      {
        id: 'create-new',
        name: 'Add "Shoes"',
        isCreateOption: true,
        createValue: 'Shoes',
      },
    ]);
  });

  it('does not add a create option when the name already exists', () => {
    expect(filterWithCreateOption(options, 'Food', (name) => `Add "${name}"`)).toEqual([
      { name: 'Food' },
    ]);
  });
});

describe('isCreateNamedOption', () => {
  it('detects create options', () => {
    expect(
      isCreateNamedOption({
        id: 'create-new',
        name: 'Add "X"',
        isCreateOption: true,
        createValue: 'X',
      })
    ).toBe(true);
    expect(isCreateNamedOption({ id: 1, name: 'Food' })).toBe(false);
  });
});
