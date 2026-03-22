/**
 * Sync HTML email templates from apps/backend/src/notifications/templates/{en,fr}
 * to Resend. Requires RESEND_API_KEY.
 *
 * Run from repo root: npm run sync:resend-templates
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
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
