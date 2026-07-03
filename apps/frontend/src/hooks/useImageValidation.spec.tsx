import { act, renderHook } from '@testing-library/react';
import { useImageValidation } from './useImageValidation';

const mockPost = jest.fn();

jest.mock('./useApiClient', () => ({
  useApiClient: () => ({
    post: mockPost,
  }),
}));

describe('useImageValidation', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('returns one passing result per file when validation is disabled', async () => {
    const files = [
      new File(['front'], 'front.jpg', { type: 'image/jpeg' }),
      new File(['side'], 'side.jpg', { type: 'image/jpeg' }),
    ];
    const { result } = renderHook(() => useImageValidation());

    await act(async () => {
      const response = await result.current.validateFiles(files);

      expect(response.passed).toBe(true);
      expect(response.results).toHaveLength(files.length);
      expect(response.results.map((r) => r.fileName)).toEqual([
        'front.jpg',
        'side.jpg',
      ]);
      expect(response.results.map((r) => r.clientIndex)).toEqual([0, 1]);
      expect(result.current.metadataFromResults(response.results)).toEqual([
        expect.objectContaining({
          quality_score: 100,
          validation_errors: [],
          validation_warnings: [],
        }),
        expect.objectContaining({
          quality_score: 100,
          validation_errors: [],
          validation_warnings: [],
        }),
      ]);
    });

    expect(mockPost).not.toHaveBeenCalled();
  });
});
