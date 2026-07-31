import { VALIDATION_CODES } from '../image-validation/types/image-validation.types';
import {
  AI_REVIEW_HARD_REJECT_QUALITY_SCORE,
  AI_REVIEW_MIN_APPROVE_QUALITY_SCORE,
  assessAiReviewImageQuality,
  buildImageQualityRejectReason,
} from './ai-review-image-quality.util';

describe('assessAiReviewImageQuality', () => {
  it('rejects low-resolution dimensions', () => {
    const assessment = assessAiReviewImageQuality([
      { id: 'img-1', width: 640, height: 640, quality_score: 90 },
    ]);
    expect(assessment.mustReject).toBe(true);
    expect(assessment.mustNotApprove).toBe(true);
    expect(assessment.issues.some((i) => i.code === VALIDATION_CODES.LOW_RESOLUTION)).toBe(
      true
    );
  });

  it('rejects stored LOW_RESOLUTION warnings', () => {
    const assessment = assessAiReviewImageQuality([
      {
        id: 'img-1',
        width: 1200,
        height: 1200,
        validation_warnings: [{ code: VALIDATION_CODES.LOW_RESOLUTION }],
        quality_score: 90,
      },
    ]);
    expect(assessment.mustReject).toBe(true);
  });

  it('does not approve cluttered backgrounds', () => {
    const assessment = assessAiReviewImageQuality([
      {
        id: 'img-1',
        width: 1200,
        height: 1200,
        validation_warnings: [{ code: VALIDATION_CODES.CLUTTERED_BACKGROUND }],
        quality_score: 90,
      },
    ]);
    expect(assessment.mustReject).toBe(false);
    expect(assessment.mustNotApprove).toBe(true);
  });

  it('rejects very low quality scores', () => {
    const assessment = assessAiReviewImageQuality([
      {
        id: 'img-1',
        width: 1200,
        height: 1200,
        quality_score: AI_REVIEW_HARD_REJECT_QUALITY_SCORE - 1,
      },
    ]);
    expect(assessment.mustReject).toBe(true);
  });

  it('requires proposal for middling quality scores', () => {
    const assessment = assessAiReviewImageQuality([
      {
        id: 'img-1',
        width: 1200,
        height: 1200,
        quality_score: AI_REVIEW_MIN_APPROVE_QUALITY_SCORE - 1,
      },
    ]);
    expect(assessment.mustReject).toBe(false);
    expect(assessment.mustNotApprove).toBe(true);
  });

  it('allows high-quality images', () => {
    const assessment = assessAiReviewImageQuality([
      {
        id: 'img-1',
        width: 1200,
        height: 1200,
        quality_score: AI_REVIEW_MIN_APPROVE_QUALITY_SCORE,
      },
    ]);
    expect(assessment.mustReject).toBe(false);
    expect(assessment.mustNotApprove).toBe(false);
  });
});

describe('buildImageQualityRejectReason', () => {
  it('mentions resolution in the headline', () => {
    const reason = buildImageQualityRejectReason(
      assessAiReviewImageQuality([
        { id: 'img-1', width: 400, height: 400, quality_score: 90 },
      ])
    );
    expect(reason.toLowerCase()).toContain('resolution');
  });
});
