import { apiRequest } from './apiClient';

export type ContentReportSubjectType =
  | 'reel'
  | 'reel_comment'
  | 'sale_item'
  | 'rental_listing';

export type ContentReportReason =
  | 'spam'
  | 'misleading'
  | 'inappropriate'
  | 'harassment'
  | 'intellectual_property'
  | 'off_platform_contact'
  | 'other';

export type SubmitContentReportInput = {
  subjectType: ContentReportSubjectType;
  subjectId: string;
  reason: ContentReportReason;
  details?: string;
};

export async function submitContentReport(
  input: SubmitContentReportInput
): Promise<void> {
  await apiRequest('/content-reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function blockBusinessContent(businessId: string): Promise<void> {
  await apiRequest(`/content-reports/block-business/${businessId}`, {
    method: 'POST',
  });
}
