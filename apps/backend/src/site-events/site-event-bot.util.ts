/**
 * Heuristic blocklist for obvious non-browser / automation clients.
 * Avoids generic "bot" substring (would match unrelated tokens like "both").
 */
const BOT_UA_MARKERS = [
  'googlebot',
  'bingbot',
  'slackbot',
  'twitterbot',
  'facebookexternalhit',
  'curl/',
  'wget/',
  'python-requests',
  'postman',
  'insomnia',
  'httpie',
  'axios/',
  'node-fetch',
  'go-http-client',
  'scrapy',
  'phantomjs',
  'headlesschrome',
  'selenium',
  'puppeteer',
  'ahrefs',
  'semrush',
  'dotbot',
  'embedly',
  'bytespider',
  'petalbot',
];

const MIN_UA_LEN = 8;

export function isLikelyAutomatedSiteEventClient(
  userAgent: string | undefined
): boolean {
  if (!userAgent || userAgent.trim().length < MIN_UA_LEN) {
    return true;
  }
  const lower = userAgent.toLowerCase();
  return BOT_UA_MARKERS.some((m) => lower.includes(m));
}
