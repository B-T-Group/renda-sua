import {
  EXPORT_PROGRESS_STEPS,
  exportOrderDocLabel,
  exportOrderIsStopped,
  exportOrderNextStepHint,
  exportOrderProgressIndex,
} from './exportOrderProgress';

describe('exportOrderProgress', () => {
  it('maps statuses onto the progress steps', () => {
    expect(exportOrderProgressIndex('SUBMITTED')).toBe(0);
    expect(exportOrderProgressIndex('PROFORMA_ISSUED')).toBe(1);
    expect(exportOrderProgressIndex('DEPOSIT_REQUIRED')).toBe(2);
    expect(exportOrderProgressIndex('FINANCED_30')).toBe(4);
    expect(exportOrderProgressIndex('CLOSED')).toBe(EXPORT_PROGRESS_STEPS.length - 1);
  });

  it('has no step for stopped or unknown statuses', () => {
    expect(exportOrderIsStopped('CANCELLED')).toBe(true);
    expect(exportOrderProgressIndex('CANCELLED')).toBe(-1);
    expect(exportOrderProgressIndex('NOPE')).toBe(-1);
  });

  it('gives guidance for every known status', () => {
    expect(exportOrderNextStepHint('PROFORMA_ISSUED')?.title).toBe('Your proforma is ready');
    expect(exportOrderNextStepHint('NOPE')).toBeNull();
  });

  it('names document types', () => {
    expect(exportOrderDocLabel('PRO')).toBe('Proforma invoice');
    expect(exportOrderDocLabel('XYZ')).toBe('XYZ');
  });
});
