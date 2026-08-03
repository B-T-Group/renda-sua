/** Stage keys for the product-create processing screen. */
export type ProcessingStageKey =
  | 'upload'
  | 'draft'
  | 'cleanup'
  | 'analyze';

export type ProcessingStageStatus =
  | 'pending'
  | 'active'
  | 'done'
  | 'error'
  | 'skipped';

export interface ProcessingStageState {
  key: ProcessingStageKey;
  status: ProcessingStageStatus;
  detail?: string;
}

export const PROCESSING_TIMEOUTS_MS = {
  uploadOverall: 90_000,
  draft: 45_000,
  cleanup: 15_000,
  analyze: 45_000,
  /** Must cover the sum of stage budgets so healthy runs are not cut short. */
  overall: 210_000,
} as const;

export function initialProcessingStages(
  includeCleanup: boolean
): ProcessingStageState[] {
  const stages: ProcessingStageState[] = [
    { key: 'upload', status: 'pending' },
    { key: 'draft', status: 'pending' },
  ];
  if (includeCleanup) {
    stages.push({ key: 'cleanup', status: 'pending' });
  } else {
    stages.push({ key: 'cleanup', status: 'skipped' });
  }
  stages.push({ key: 'analyze', status: 'pending' });
  return stages;
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
