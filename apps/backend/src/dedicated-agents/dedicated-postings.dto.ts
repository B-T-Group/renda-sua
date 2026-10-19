/** #594 PR 7 posting bodies (validated in DedicatedPostingsService). */
export interface CreateDedicatedPostingDto {
  /** 1-10, default 1 (AC-B11). */
  headcount?: number;
  /** Subset of the location's enabled slots: morning / afternoon / evening. */
  slotKeys: string[];
  /** ISO days 1 (Monday) to 7 (Sunday); default all. */
  daysOfWeek?: number[];
  /** Plain text, at most 1,000 characters after links / e-mails / phone numbers are stripped. */
  terms?: string | null;
}

export interface UpdateDedicatedPostingTermsDto {
  terms: string | null;
}

export interface CloseDedicatedPostingDto {
  reason?: string;
}
