import { useCallback, useState } from 'react';
import {
  blockBusinessContent,
  submitContentReport,
  type ContentReportReason,
  type ContentReportSubjectType,
} from '../services/contentReportsApi';

export function useContentReport() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = useCallback(
    async (params: {
      subjectType: ContentReportSubjectType;
      subjectId: string;
      reason: ContentReportReason;
      details?: string;
    }) => {
      setSubmitting(true);
      setError(null);
      try {
        await submitContentReport({
          subjectType: params.subjectType,
          subjectId: params.subjectId,
          reason: params.reason,
          details: params.details,
        });
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to submit report');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  const blockMerchant = useCallback(async (businessId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await blockBusinessContent(businessId);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to block merchant');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { report, blockMerchant, submitting, error, clearError: () => setError(null) };
}
