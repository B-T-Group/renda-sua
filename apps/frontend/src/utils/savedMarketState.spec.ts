import {
  isSavedStateInList,
  shouldClearMissingSavedState,
} from './savedMarketState';

describe('isSavedStateInList', () => {
  it('treats QC and Quebec as the same state, in either direction', () => {
    expect(isSavedStateInList('CA', 'QC', ['Quebec', 'Manitoba'])).toBe(true);
    expect(isSavedStateInList('CA', 'Quebec', ['QC', 'MB'])).toBe(true);
    expect(isSavedStateInList('CA', 'ON', ['Ontario'])).toBe(true);
    expect(isSavedStateInList('CA', 'Ontario', ['ON'])).toBe(true);
  });

  it('is case-insensitive and keeps a state that is still in the list', () => {
    expect(isSavedStateInList('CA', 'ontario', ['Ontario'])).toBe(true);
    expect(isSavedStateInList('CA', 'Ontario', ['Quebec'])).toBe(false);
  });
});

describe('shouldClearMissingSavedState', () => {
  const base = {
    countryCode: 'CA',
    stateCode: 'Ontario',
    knownStates: ['Quebec'],
  };

  it('does not clear while the list is loading', () => {
    expect(
      shouldClearMissingSavedState({
        ...base,
        loaded: false,
        loading: true,
        loadFailed: false,
      })
    ).toBe(false);
  });

  it('does not clear when the request failed, even if the list is empty', () => {
    expect(
      shouldClearMissingSavedState({
        ...base,
        knownStates: [],
        loaded: false,
        loading: false,
        loadFailed: true,
      })
    ).toBe(false);
  });

  it('clears once a successful list does not contain the saved state', () => {
    expect(
      shouldClearMissingSavedState({
        ...base,
        loaded: true,
        loading: false,
        loadFailed: false,
      })
    ).toBe(true);
  });

  it('keeps the saved state when the loaded list includes it under a synonym', () => {
    expect(
      shouldClearMissingSavedState({
        countryCode: 'CA',
        stateCode: 'ON',
        knownStates: ['Quebec', 'Ontario'],
        loaded: true,
        loading: false,
        loadFailed: false,
      })
    ).toBe(false);
  });

  it('does nothing when the user is already on All of the country', () => {
    expect(
      shouldClearMissingSavedState({
        countryCode: 'CA',
        stateCode: null,
        knownStates: ['Quebec'],
        loaded: true,
        loading: false,
        loadFailed: false,
      })
    ).toBe(false);
  });

  it('clears a saved state when the successful list is empty', () => {
    expect(
      shouldClearMissingSavedState({
        countryCode: 'CI',
        stateCode: 'Abidjan',
        knownStates: [],
        loaded: true,
        loading: false,
        loadFailed: false,
      })
    ).toBe(true);
  });
});
