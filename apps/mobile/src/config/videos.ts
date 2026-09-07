/**
 * Stub config vidéos – app agent n'utilise pas Contentful/YouTube.
 */

export interface YouTubeVideoInfo {
  id?: string;
  title?: string;
  [key: string]: unknown;
}

export interface FormattedVideoItem {
  title?: string;
  url?: string;
  [key: string]: unknown;
}

export async function getAllYouTubeVideosInfo(): Promise<YouTubeVideoInfo[]> {
  return [];
}

export function formatYouTubeVideosForApp(_videos: YouTubeVideoInfo[]): FormattedVideoItem[] {
  return [];
}
