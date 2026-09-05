import { applySuggestionToForm } from './applyVariantSuggestion';

const form = {
  name: 'T-shirt',
  color: 'Blue',
  sku: 'TSH-BLU',
  price: 4000,
  weight: 180,
  weight_unit: 'g',
  dimensions: 'M',
};

const suggestion = {
  name: 'T-shirt — Red',
  color: 'Red',
  sku: 'TSH-RED',
  price: 5000,
  weight: 200,
  weightUnit: 'kg',
  dimensions: 'L',
};

describe('applySuggestionToForm', () => {
  it('fills unlocked fields from the AI suggestion', () => {
    expect(applySuggestionToForm(form, suggestion, new Set())).toEqual({
      name: 'T-shirt — Red',
      color: 'Red',
      sku: 'TSH-RED',
      price: 5000,
      weight: 200,
      weight_unit: 'kg',
      dimensions: 'L',
    });
  });

  it('does not overwrite fields the merchant already edited', () => {
    const actual = applySuggestionToForm(
      form,
      suggestion,
      new Set(['name', 'price', 'sku'])
    );

    expect(actual.name).toBe('T-shirt');
    expect(actual.price).toBe(4000);
    expect(actual.sku).toBe('TSH-BLU');
    expect(actual.color).toBe('Red');
  });

  it('keeps current values when the suggestion is blank or missing', () => {
    const actual = applySuggestionToForm(
      form,
      { name: '   ', color: '', price: undefined },
      new Set()
    );

    expect(actual.name).toBe('T-shirt');
    expect(actual.color).toBe('Blue');
    expect(actual.price).toBe(4000);
  });
});
