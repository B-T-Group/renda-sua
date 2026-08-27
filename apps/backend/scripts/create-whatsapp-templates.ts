/**
 * Upsert WhatsApp message templates on a WABA via Graph API.
 *
 * Run from repo root:
 *   npm run create:whatsapp-templates -- --access-token "$TOKEN"
 *   npm run create:whatsapp-templates -- --dry-run --access-token "$TOKEN"
 *   npm run create:whatsapp-templates -- --only rs_login_code
 *
 * Token also read from WHATSAPP_ACCESS_TOKEN. WABA id defaults to
 * 1014752277854609; override with --waba-id or WHATSAPP_WABA_ID.
 */
import {
  TEMPLATE_CATALOG,
  TEMPLATE_LANGUAGES,
  buildCreatePayload,
  buildUpdatePayload,
  catalogKey,
  shouldSkipStatus,
  templateNeedsUpdate,
  type CatalogTemplate,
  type GraphTemplate,
  type TemplateLanguage,
} from './whatsapp-meta-template-catalog';

type CliOptions = {
  accessToken: string;
  wabaId: string;
  dryRun: boolean;
  only: Set<string> | null;
  apiVersion: string;
};

type UpsertResult = 'created' | 'updated' | 'skipped' | 'failed';

type GraphListResponse = {
  data?: GraphTemplate[];
  paging?: { next?: string };
  error?: GraphErrorBody;
};

type GraphErrorBody = {
  message?: string;
  code?: number;
  error_user_msg?: string;
  error_data?: unknown;
};

type GraphWriteResponse = {
  id?: string;
  status?: string;
  success?: boolean;
  error?: GraphErrorBody;
};

const DEFAULT_WABA_ID = '1014752277854609';
const DEFAULT_API_VERSION = 'v25.0';
const LIST_FIELDS =
  'id,name,language,status,category,components,message_send_ttl_seconds';

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options.accessToken) {
    printUsage();
    process.exit(1);
  }
  console.log(`WABA ${options.wabaId} (${options.apiVersion})`);
  const templates = requireTemplates(options.only);
  const existing = await listExisting(options);
  const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };
  for (const template of templates) {
    for (const language of TEMPLATE_LANGUAGES) {
      const result = await upsertOne(options, existing, template, language);
      counts[result] += 1;
    }
  }
  printSummary(counts);
  if (counts.failed > 0) process.exit(1);
}

function parseOptions(argv: string[]): CliOptions {
  const raw = parseRawFlags(argv);
  const only = raw.only?.split(',').map((name) => name.trim()).filter(Boolean);
  return {
    accessToken: raw['access-token'] || process.env.WHATSAPP_ACCESS_TOKEN || '',
    wabaId: raw['waba-id'] || process.env.WHATSAPP_WABA_ID || DEFAULT_WABA_ID,
    dryRun: raw['dry-run'] === 'true',
    only: only?.length ? new Set(only) : null,
    apiVersion: raw['api-version'] || process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION,
  };
}

function parseRawFlags(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      flags['dry-run'] = 'true';
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    const key = flagName(arg);
    if (!key) continue;
    flags[key] = argv[i + 1] ?? '';
    i += 1;
  }
  return flags;
}

function flagName(arg: string): string | null {
  if (!arg.startsWith('--')) return null;
  return arg.slice(2);
}

function printUsage(): void {
  console.error(`Usage:
  npm run create:whatsapp-templates -- --access-token TOKEN
  npm run create:whatsapp-templates -- --dry-run --access-token TOKEN
  npm run create:whatsapp-templates -- --only rs_login_code,rs_delivery_pin

Options:
  --access-token   Meta user/system token (or WHATSAPP_ACCESS_TOKEN)
  --waba-id        WhatsApp Business Account id (default ${DEFAULT_WABA_ID})
  --dry-run        Print payloads without calling Graph
  --only           Comma-separated template names
  --api-version    Graph version (default ${DEFAULT_API_VERSION})`);
}

function requireTemplates(only: Set<string> | null): CatalogTemplate[] {
  const templates = selectedTemplates(only);
  if (only && templates.length === 0) {
    console.error('No catalog templates match --only');
    process.exit(1);
  }
  return templates;
}

function selectedTemplates(only: Set<string> | null): CatalogTemplate[] {
  if (!only) return TEMPLATE_CATALOG;
  return TEMPLATE_CATALOG.filter((template) => only.has(template.name));
}

async function listExisting(options: CliOptions): Promise<Map<string, GraphTemplate>> {
  try {
    return await fetchAllTemplates(options);
  } catch (error) {
    if (!options.dryRun) throw error;
    const detail = error instanceof Error ? error.message : error;
    console.warn(`dry-run: could not list templates (${detail}); treating all as creates`);
    return new Map();
  }
}

async function fetchAllTemplates(options: CliOptions): Promise<Map<string, GraphTemplate>> {
  const byKey = new Map<string, GraphTemplate>();
  let url: string | undefined = listUrl(options);
  while (url) {
    const page = await graphGet<GraphListResponse>(url, options.accessToken);
    for (const item of page.data ?? []) {
      byKey.set(catalogKey(item.name, item.language), item);
    }
    url = page.paging?.next;
  }
  return byKey;
}

function listUrl(options: CliOptions): string {
  const params = new URLSearchParams({ fields: LIST_FIELDS, limit: '100' });
  return `https://graph.facebook.com/${options.apiVersion}/${options.wabaId}/message_templates?${params}`;
}

async function upsertOne(
  options: CliOptions,
  existing: Map<string, GraphTemplate>,
  template: CatalogTemplate,
  language: TemplateLanguage
): Promise<UpsertResult> {
  const label = `${template.name} (${language})`;
  const current = existing.get(catalogKey(template.name, language));
  if (current && shouldSkipStatus(current.status)) {
    console.log(`skip  ${label} — status ${current.status}`);
    return 'skipped';
  }
  if (!current) return createOne(options, template, language, label);
  if (!templateNeedsUpdate(current, template, language)) {
    console.log(`skip  ${label} — unchanged (${current.status ?? 'unknown'})`);
    return 'skipped';
  }
  return updateOne(options, current, template, language, label);
}

async function createOne(
  options: CliOptions,
  template: CatalogTemplate,
  language: TemplateLanguage,
  label: string
): Promise<UpsertResult> {
  const payload = buildCreatePayload(template, language);
  const url = `https://graph.facebook.com/${options.apiVersion}/${options.wabaId}/message_templates`;
  return writeTemplate(options, 'POST', url, payload, 'created', label);
}

async function updateOne(
  options: CliOptions,
  existing: GraphTemplate,
  template: CatalogTemplate,
  language: TemplateLanguage,
  label: string
): Promise<UpsertResult> {
  console.log(`update ${label} — current status ${existing.status ?? 'unknown'}`);
  const payload = buildUpdatePayload(template, language);
  const url = `https://graph.facebook.com/${options.apiVersion}/${existing.id}`;
  return writeTemplate(options, 'POST', url, payload, 'updated', label);
}

async function writeTemplate(
  options: CliOptions,
  method: 'POST',
  url: string,
  payload: Record<string, unknown>,
  action: 'created' | 'updated',
  label: string
): Promise<UpsertResult> {
  if (options.dryRun) {
    console.log(`dry-run ${action} ${label}\n${JSON.stringify(payload, null, 2)}`);
    return action;
  }
  try {
    const result = await graphWrite(method, url, options.accessToken, payload);
    console.log(`${action} ${label} — id=${result.id ?? 'n/a'} status=${result.status ?? 'ok'}`);
    return action;
  } catch (error) {
    console.error(`fail  ${label} — ${error instanceof Error ? error.message : error}`);
    return 'failed';
  }
}

async function graphGet<T extends { error?: GraphErrorBody }>(
  url: string,
  token: string
): Promise<T> {
  const response = await fetch(url, { headers: authHeaders(token) });
  return readGraphJson<T>(response);
}

async function graphWrite(
  method: 'POST',
  url: string,
  token: string,
  payload: Record<string, unknown>
): Promise<GraphWriteResponse> {
  const response = await fetch(url, {
    method,
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readGraphJson<GraphWriteResponse>(response);
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function readGraphJson<T extends { error?: GraphErrorBody }>(
  response: Response
): Promise<T> {
  const json = (await response.json()) as T;
  if (!response.ok || json.error) {
    throw new Error(formatGraphError(json.error, response.status));
  }
  return json;
}

function formatGraphError(error: GraphErrorBody | undefined, status: number): string {
  if (!error) return `HTTP ${status}`;
  return [error.message, error.error_user_msg, error.code != null ? `code ${error.code}` : '']
    .filter(Boolean)
    .join(' — ');
}

function printSummary(counts: Record<UpsertResult, number>): void {
  console.log(
    `\nDone. created=${counts.created} updated=${counts.updated} skipped=${counts.skipped} failed=${counts.failed}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
