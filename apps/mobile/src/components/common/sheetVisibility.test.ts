import { sheetVisibilityCommand } from './sheetVisibility';

describe('sheetVisibilityCommand', () => {
  it('does not dismiss a sheet that has never opened', () => {
    expect(sheetVisibilityCommand(false, false, false)).toBe('none');
  });

  it('presents when the sheet should be open', () => {
    expect(sheetVisibilityCommand(true, false, false)).toBe('present');
    expect(sheetVisibilityCommand(true, true, true)).toBe('present');
  });

  it('does not dismiss again after the sheet closed itself', () => {
    expect(sheetVisibilityCommand(false, true, true)).toBe('none');
  });

  it('dismisses when the parent hides a sheet that is still open', () => {
    expect(sheetVisibilityCommand(false, true, false)).toBe('dismiss');
  });
});
