/**
 * Sync HTML email templates from apps/backend/src/notifications/templates/{en,fr}
 * to Resend. Requires RESEND_API_KEY.
 *
 * Run from repo root:
 * - All templates: npm run sync:resend-templates
 * - One template:  npm run sync:resend-template -- en/my_template.html
 *   (bare filename syncs both en/ and fr/ when both files exist)
 */
import { readdir, readFile, realpath, stat, writeFile } from 'fs/promises';
import { dirname, join, relative, resolve, sep } from 'path';
import { Resend } from 'resend';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM =
  process.env.RESEND_FROM_EMAIL ?? 'Rendasua <noreply@rendasua.com>';

const TEMPLATES_ROOT = join(__dirname, '../src/notifications/templates');
const IDS_PATH = join(__dirname, '../src/notifications/resend-template-ids.json');

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY is not set');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

type TemplateVariable = {
  key: string;
  type: 'string' | 'number';
  fallbackValue?: string | number | null;
};

interface TemplateListItem {
  id: string;
  name: string;
}

const RESERVED = new Set([
  'FIRST_NAME',
  'LAST_NAME',
  'EMAIL',
  'RESEND_UNSUBSCRIBE_URL',
  'UNSUBSCRIBE_URL',
  'contact',
  'this',
]);

function extractVariables(html: string): TemplateVariable[] {
  const re = /\{\{\{([a-zA-Z0-9_]+)\}\}\}/g;
  const map = new Map<string, TemplateVariable>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const key = m[1];
    if (map.has(key)) continue;
    if (RESERVED.has(key)) {
      console.warn(`Warning: skipped reserved variable "${key}"`);
      continue;
    }
    map.set(key, { key, type: 'string', fallbackValue: '' });
    // Some older templates in Resend can report normalized uppercase variable
    // names (e.g. RECIPIENTNAME). Include an alias to avoid update failures.
    const upperKey = key.toUpperCase();
    if (!map.has(upperKey) && !RESERVED.has(upperKey)) {
      map.set(upperKey, { key: upperKey, type: 'string', fallbackValue: '' });
    }
  }
  return Array.from(map.values());
}

function subjectForTemplate(name: string): string {
  if (name.startsWith('agent_orders_nearby_summary')) {
    return name.endsWith('_fr')
      ? 'Commandes à proximité — Rendasua'
      : 'Orders near you — Rendasua';
  }
  if (name.startsWith('agent_order_proximity')) {
    return name.endsWith('_fr')
      ? 'Commande à proximité — Rendasua'
      : 'Order near you — Rendasua';
  }
  if (name.includes('rental_period_ended')) {
    return name.endsWith('_fr')
      ? 'Location — fin de période — Rendasua'
      : 'Rental period ended — Rendasua';
  }
  if (name.includes('business_rental_listing_approved')) {
    return name.endsWith('_fr')
      ? 'Annonce de location approuvée — Rendasua'
      : 'Rental listing approved — Rendasua';
  }
  if (name.includes('business_rental_listing_rejected')) {
    return name.endsWith('_fr')
      ? 'Annonce de location non approuvée — Rendasua'
      : 'Rental listing not approved — Rendasua';
  }
  if (name.includes('business_rental_booking_request')) {
    return name.endsWith('_fr')
      ? 'Nouvelle demande de location — Rendasua'
      : 'New rental booking request — Rendasua';
  }
  if (name.includes('client_rental_request_accepted')) {
    return name.endsWith('_fr')
      ? 'Demande de location acceptée — Rendasua'
      : 'Your rental request was accepted — Rendasua';
  }
  if (name.includes('client_rental_request_rejected')) {
    return name.endsWith('_fr')
      ? 'Demande de location refusée — Rendasua'
      : 'Update on your rental request — Rendasua';
  }
  if (name === 'client_order_created' || name === 'client_order_created_fr') {
    return name.endsWith('_fr')
      ? 'Commande passée — Rendasua'
      : 'Order placed — Rendasua';
  }
  return name.endsWith('_fr')
    ? 'Mise à jour de commande — Rendasua'
    : 'Rendasua — order update';
}

async function listAllTemplates(): Promise<TemplateListItem[]> {
  const all: TemplateListItem[] = [];
  let after: string | undefined;
  do {
    const { data, error } = await resend.templates.list({
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (error) {
      throw new Error(`list templates failed: ${JSON.stringify(error)}`);
    }
    const chunk = data?.data ?? [];
    all.push(...chunk);
    after =
      data?.has_more && chunk.length > 0
        ? chunk[chunk.length - 1].id
        : undefined;
  } while (after);
  return all;
}

async function findByName(name: string): Promise<TemplateListItem | null> {
  const templates = await listAllTemplates();
  return templates.find((t) => t.name === name) ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function createAndPublish(
  name: string,
  html: string,
  variables: TemplateVariable[]
): Promise<string> {
  const { data, error } = await resend.templates.create({
    name,
    from: DEFAULT_FROM,
    subject: subjectForTemplate(name),
    html,
    variables: variables.length > 0 ? variables : undefined,
  });
  if (error) {
    throw new Error(`create ${name}: ${JSON.stringify(error)}`);
  }
  const id = data?.id;
  if (!id) throw new Error(`create ${name}: no id returned`);
  console.log(`Created template: ${name} (${id})`);
  await sleep(2000);
  const pub = await resend.templates.publish(id);
  if (pub.error) {
    console.warn(`Publish warning ${name}: ${JSON.stringify(pub.error)}`);
  } else {
    console.log(`Published: ${name}`);
  }
  await sleep(2000);
  return id;
}

async function updateAndPublish(
  id: string,
  name: string,
  html: string,
  variables: TemplateVariable[]
): Promise<void> {
  const { error } = await resend.templates.update(id, {
    name,
    from: DEFAULT_FROM,
    subject: subjectForTemplate(name),
    html,
    variables: variables.length > 0 ? variables : undefined,
  });
  if (error) {
    throw new Error(`update ${name}: ${JSON.stringify(error)}`);
  }
  console.log(`Updated template: ${name} (${id})`);
  await sleep(2000);
  const pub = await resend.templates.publish(id);
  if (pub.error) {
    console.warn(`Publish warning ${name}: ${JSON.stringify(pub.error)}`);
  } else {
    console.log(`Published: ${name}`);
  }
  await sleep(2000);
}

function isInsideTemplatesRoot(filePath: string): boolean {
  const root = resolve(TEMPLATES_ROOT) + sep;
  const f = resolve(filePath);
  return f === resolve(TEMPLATES_ROOT) || f.startsWith(root);
}

async function targetsFromLocalePath(
  locale: 'en' | 'fr',
  filename: string
): Promise<Array<{ locale: 'en' | 'fr'; filename: string; filePath: string }>> {
  const filePath = join(TEMPLATES_ROOT, locale, filename);
  await stat(filePath);
  return [{ locale, filename, filePath }];
}

async function targetsFromBareFilename(
  filename: string
): Promise<Array<{ locale: 'en' | 'fr'; filename: string; filePath: string }>> {
  const out: Array<{ locale: 'en' | 'fr'; filename: string; filePath: string }> = [];
  for (const loc of ['en', 'fr'] as const) {
    const filePath = join(TEMPLATES_ROOT, loc, filename);
    try {
      await stat(filePath);
      out.push({ locale: loc, filename, filePath });
    } catch {
      /* missing locale file */
    }
  }
  if (out.length === 0) {
    throw new Error(
      `No template "${filename}" in en/ or fr/ under ${TEMPLATES_ROOT}`
    );
  }
  return out;
}

async function targetsFromResolvedFile(
  filePath: string
): Promise<Array<{ locale: 'en' | 'fr'; filename: string; filePath: string }>> {
  let resolved: string;
  try {
    resolved = await realpath(filePath);
  } catch {
    resolved = resolve(filePath);
  }
  if (!isInsideTemplatesRoot(resolved)) {
    throw new Error(`Path must be under ${TEMPLATES_ROOT}: ${resolved}`);
  }
  const rel = relative(resolve(TEMPLATES_ROOT), resolved);
  const parts = rel.split(sep);
  if (parts.length !== 2) {
    throw new Error(`Expected templates/<en|fr>/<file>.html, got: ${rel}`);
  }
  const [locale, filename] = parts;
  if (locale !== 'en' && locale !== 'fr') {
    throw new Error(`Locale folder must be en or fr, got: ${locale}`);
  }
  await stat(resolved);
  return [{ locale, filename, filePath: resolved }];
}

async function resolveTemplateTargets(
  raw: string
): Promise<Array<{ locale: 'en' | 'fr'; filename: string; filePath: string }>> {
  const input = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!input.endsWith('.html')) {
    throw new Error('Template reference must end with .html');
  }
  const localeMatch = input.match(/^(en|fr)[/\\]([^/\\]+\.html)$/i);
  if (localeMatch) {
    const locale = localeMatch[1].toLowerCase() as 'en' | 'fr';
    return targetsFromLocalePath(locale, localeMatch[2]);
  }
  if (!input.includes('/') && !input.includes(sep)) {
    return targetsFromBareFilename(input);
  }
  const cwdPath = resolve(process.cwd(), input);
  return targetsFromResolvedFile(cwdPath);
}

async function syncSingleTemplate(rawArg: string): Promise<void> {
  console.log('Resend single-template sync');
  console.log(`Templates: ${TEMPLATES_ROOT}`);
  console.log(`From: ${DEFAULT_FROM}\n`);

  const targets = await resolveTemplateTargets(rawArg);
  const raw = await readFile(IDS_PATH, 'utf-8');
  const idMap = JSON.parse(raw) as Record<string, string>;

  for (const t of targets) {
    await processFile(t.locale, t.filename, idMap);
    console.log('');
  }

  await writeFile(IDS_PATH, JSON.stringify(idMap, null, 2) + '\n', 'utf-8');
  console.log(`Wrote template ids: ${IDS_PATH}`);
  console.log('Done.');
}

async function processFile(
  locale: 'en' | 'fr',
  filename: string,
  idMap: Record<string, string>
): Promise<void> {
  const base = filename.replace(/\.html$/, '');
  const resendName = locale === 'fr' ? `${base}_fr` : base;
  const filePath = join(TEMPLATES_ROOT, locale, filename);
  const html = await readFile(filePath, 'utf-8');
  const variables = extractVariables(html);
  if (variables.length > 0) {
    console.log(
      `${resendName}: ${variables.length} vars — ${variables.map((v) => v.key).join(', ')}`
    );
  }
  const existing = await findByName(resendName);
  let id: string;
  if (existing) {
    await updateAndPublish(existing.id, resendName, html, variables);
    id = existing.id;
  } else {
    id = await createAndPublish(resendName, html, variables);
  }
  idMap[resendName] = id;
}

async function main(): Promise<void> {
  const singleArg = process.argv.slice(2)[0];
  if (singleArg) {
    await syncSingleTemplate(singleArg);
    return;
  }

  console.log('Resend template sync');
  console.log(`Templates: ${TEMPLATES_ROOT}`);
  console.log(`From: ${DEFAULT_FROM}\n`);

  const enDir = join(TEMPLATES_ROOT, 'en');
  const frDir = join(TEMPLATES_ROOT, 'fr');
  const enFiles = (await readdir(enDir)).filter((f) => f.endsWith('.html')).sort();
  const frFiles = (await readdir(frDir)).filter((f) => f.endsWith('.html')).sort();

  const raw = await readFile(IDS_PATH, 'utf-8');
  const idMap = JSON.parse(raw) as Record<string, string>;

  for (const f of enFiles) {
    await processFile('en', f, idMap);
    console.log('');
  }
  for (const f of frFiles) {
    await processFile('fr', f, idMap);
    console.log('');
  }

  await writeFile(IDS_PATH, JSON.stringify(idMap, null, 2) + '\n', 'utf-8');
  console.log(`Wrote template ids: ${IDS_PATH}`);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
