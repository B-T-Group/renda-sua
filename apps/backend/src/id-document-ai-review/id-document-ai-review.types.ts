export const ID_DOCUMENT_PROMPT_VERSION = 'id-document-ai-review-v1';

export const ID_AI_MIN_CONFIDENCE = 0.75;

export type IdDocumentAiDecision = 'approve' | 'needs_review';

export type IdDocumentAiReviewStatus = 'running' | 'completed' | 'failed';

export type IdDocumentPersona = 'business' | 'agent';

export interface IdDocumentModelResult {
  isIdDocument: boolean;
  extractedName: string | null;
  nameMatches: boolean;
  confidence: number;
  reasons: string[];
}

export interface PendingIdUpload {
  id: string;
  user_id: string;
  key: string;
  content_type: string;
  file_name: string;
  created_at: string;
  document_type: { name: string };
  user: {
    id: string;
    first_name: string;
    last_name: string;
    business?: { id: string; name: string } | null;
    agent?: { id: string } | null;
  };
  id_document_ai_reviews: Array<{
    id: string;
    status: IdDocumentAiReviewStatus;
    decision: IdDocumentAiDecision | null;
    created_at: string;
  }>;
}

export interface IdDocumentReviewContext {
  upload: PendingIdUpload;
  persona: IdDocumentPersona;
  expectedName: string;
  alternateNames: string[];
  displayName: string;
  adminUrl: string;
}
