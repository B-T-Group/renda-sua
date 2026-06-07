import { VALIDATION_CODES } from '../types/image-validation.types';
import { aggregateScore, calculateScore } from './score-calculator.util';

describe('score-calculator', () => {
  it('starts at 100 with no issues', () => {
    expect(calculateScore([])).toBe(100);
  });

  it('deducts for warnings', () => {
    const score = calculateScore([
      {
        code: VALIDATION_CODES.POOR_LIGHTING,
        message: 'dark',
        severity: 'warning',
      },
    ]);
    expect(score).toBe(85);
  });

  it('aggregates average score', () => {
    expect(aggregateScore([{ score: 80 }, { score: 100 }])).toBe(90);
  });
});
