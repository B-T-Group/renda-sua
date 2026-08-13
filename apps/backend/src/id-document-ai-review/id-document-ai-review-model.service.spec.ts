import { IdDocumentAiReviewModelService } from './id-document-ai-review-model.service';

describe('IdDocumentAiReviewModelService', () => {
  const service = new IdDocumentAiReviewModelService(
    { get: () => undefined } as any,
    {} as any
  );

  it('parses a valid model payload', () => {
    const result = service.parseResult({
      isIdDocument: true,
      extractedName: 'Ada Lovelace',
      nameMatches: true,
      confidence: 0.91,
      reasons: ['names match'],
    });
    expect(result).toEqual({
      isIdDocument: true,
      extractedName: 'Ada Lovelace',
      nameMatches: true,
      confidence: 0.91,
      reasons: ['names match'],
    });
  });

  it('clamps confidence and coerces missing fields safely', () => {
    const result = service.parseResult({
      isIdDocument: 'yes',
      extractedName: '',
      nameMatches: 1,
      confidence: 2.5,
      reasons: 'bad',
    });
    expect(result.isIdDocument).toBe(false);
    expect(result.extractedName).toBeNull();
    expect(result.nameMatches).toBe(false);
    expect(result.confidence).toBe(1);
    expect(result.reasons).toEqual([]);
  });
});
