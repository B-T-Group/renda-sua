import { describe, expect, it } from 'vitest';
import {
  clientQuickCommentsForStars,
  composeRatingComment,
  labelsForSelectedComments,
  pruneQuickCommentIds,
  toggleQuickCommentId,
} from './ratingQuickComments';

describe('clientQuickCommentsForStars', () => {
  it('returns nothing until a rating is chosen', () => {
    expect(clientQuickCommentsForStars(0)).toEqual([]);
  });

  it('returns positive chips for 4–5 stars', () => {
    const ids = clientQuickCommentsForStars(5).map((c) => c.id);
    expect(ids).toContain('polite');
    expect(ids).toContain('onTime');
    expect(ids).toContain('professional');
    expect(ids).not.toContain('late');
  });

  it('returns constructive chips for 1–3 stars', () => {
    const ids = clientQuickCommentsForStars(2).map((c) => c.id);
    expect(ids).toContain('late');
    expect(ids).not.toContain('polite');
  });
});

describe('pruneQuickCommentIds', () => {
  it('drops chips that are not in the current set', () => {
    const allowed = clientQuickCommentsForStars(2);
    expect(pruneQuickCommentIds(['polite', 'late'], allowed)).toEqual(['late']);
  });
});

describe('labelsForSelectedComments', () => {
  it('translates selected chips in tap order', () => {
    const defs = clientQuickCommentsForStars(5);
    const labels = labelsForSelectedComments(['onTime', 'polite'], defs, (_k, fallback) => fallback);
    expect(labels).toEqual(['Client was on time', 'Client was polite']);
  });
});

describe('composeRatingComment', () => {
  it('joins chips and extra text', () => {
    expect(composeRatingComment(['Client was polite', 'Client was on time'], 'Waited downstairs.')).toBe(
      'Client was polite. Client was on time. Waited downstairs.'
    );
  });

  it('returns only extra text when no chips are selected', () => {
    expect(composeRatingComment([], '  Great  ')).toBe('Great');
  });
});

describe('toggleQuickCommentId', () => {
  it('adds and removes an id', () => {
    expect(toggleQuickCommentId([], 'polite')).toEqual(['polite']);
    expect(toggleQuickCommentId(['polite'], 'polite')).toEqual([]);
  });
});
