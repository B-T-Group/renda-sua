/**
 * Flag-on gallery and anytime pickup-photo screens. Not imported by the app.
 * Usage: node scripts/capture-pickup-photo-gallery/capture.mjs
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR || '/opt/cursor/artifacts/pickup-photo-gallery/v1';
const heroSrc = '/cursor/stores/bot/handoffs/pickup-photo-prefill/hero-jbl.png';
const fontSrc = '/cursor/stores/bot/handoffs/pickup-photo-prefill/Inter-Variable.ttf';

const copy = {
  en: {
    title: 'Pickup photos',
    report: 'Condition report',
    item: 'JBL PartyBox 310',
    ref: 'RB-25496259',
    loc: 'Atelier Nord, Toronto',
    camera: 'Camera',
    gallery: 'Gallery',
    anytime: 'Add pickup photos anytime before the rental starts.',
    badge: 'Not taken on pickup day',
    roles: ['Overview', 'Other side', 'Accessories', 'Extra 1'],
    onDay: '17 Nov · 10:14',
    offDay: '10 Nov · 09:30',
    sent: 'Sent to the renter',
    nav: ['Home', 'Orders', 'Rentals', 'Account'],
  },
  fr: {
    title: 'Photos de départ',
    report: "Constat d'état",
    item: 'JBL PartyBox 310',
    ref: 'RB-25496259',
    loc: 'Atelier Nord, Toronto',
    camera: 'Appareil',
    gallery: 'Galerie',
    anytime: 'Ajoutez les photos de départ à tout moment avant le début.',
    badge: 'Pas prise le jour du départ',
    roles: ["Vue d'ensemble", 'Autre côté', 'Accessoires', 'Supp. 1'],
    onDay: '17 nov. · 10:14',
    offDay: '10 nov. · 09:30',
    sent: 'Envoyé au locataire',
    nav: ['Accueil', 'Commandes', 'Locations', 'Compte'],
  },
};

const cameraIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2h6l2 2h3v11H4z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const galleryIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="10" r="1.5" fill="currentColor"/><path d="M3 16l5-4 4 3 3-2 6 5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

const css = `
@font-face{font-family:Inter;src:url("Inter-Variable.ttf") format("truetype");font-weight:100 900;font-display:block}
:root{--green:#0B7A3B;--green-dark:#085C2C;--green-soft:#DCF5E5;--bg:#FAF9F7;--line:#E6E1D8;--text:#0F172A;--muted:#64748B;--warn:#92400E;--warn-bg:#FEF3C7}
*{box-sizing:border-box}body{margin:0;background:#0f172a;font-family:Inter,system-ui,sans-serif;color:var(--text)}
.board{display:flex;flex-direction:column;gap:24px;padding:16px;width:max-content}
.phone{width:390px;background:var(--bg);border-radius:28px;border:8px solid #0b1220;overflow:hidden;display:flex;flex-direction:column}
.status{height:24px;display:flex;justify-content:space-between;padding:6px 16px 0;font-size:12px;font-weight:700}
.hdr{display:flex;align-items:center;gap:8px;padding:6px 12px 8px}
.hdr h2{flex:1;text-align:center;font-size:16px;margin:0}
.back{border:0;background:#fff;border-radius:999px;padding:6px 10px;font:inherit;font-weight:700;color:var(--green-dark)}
.body{padding:0 14px 14px;display:flex;flex-direction:column;gap:10px}
.cap{margin:0;font-size:12px;color:var(--muted);font-weight:600}
.note{margin:0;background:#e6f7fb;border-radius:12px;padding:8px 10px;font-size:13px;font-weight:600}
.chooser{position:relative;border-radius:16px;overflow:hidden;border:1.5px solid var(--line);background:#111}
.chooser img{width:100%;height:220px;object-fit:cover;display:block}
.sources{position:absolute;left:10px;right:10px;bottom:10px;display:flex;gap:8px}
.sources button{flex:1;min-height:40px;border:0;border-radius:12px;background:#fff;color:var(--green-dark);font:inherit;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tile{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.tile img{width:100%;height:92px;object-fit:cover;display:block}
.meta{padding:6px 8px 8px;display:flex;flex-direction:column;gap:4px}
.meta b{font-size:12px}
.stamp{font-size:11px;font-weight:700;color:var(--muted)}
.badge{align-self:flex-start;font-size:10px;font-weight:800;color:var(--warn);background:var(--warn-bg);border-radius:999px;padding:3px 7px;line-height:1.2}
.report{display:flex;flex-direction:column;gap:8px}
.row{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:12px;padding:8px}
.row img{width:64px;height:64px;object-fit:cover;border-radius:8px}
.row .copy{display:flex;flex-direction:column;gap:4px;min-width:0}
.row b{font-size:14px}
.web{width:980px;background:#F4F2EE;border-radius:14px;border:8px solid #0b1220;overflow:hidden}
.chrome{height:36px;background:#1e293b;display:flex;align-items:center;padding:0 12px;gap:8px}
.dots i{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:4px}
.r{background:#f87171}.y{background:#fbbf24}.g{background:#34d399}
.url{flex:1;background:#0f172a;color:#94a3b8;border-radius:8px;padding:5px 10px;font-size:12px}
.web-body{display:flex}
.nav{width:160px;background:#fff;border-right:1px solid var(--line);padding:12px}
.nav b{display:block;padding:6px;color:#0B2E6F}
.nav span{display:block;padding:6px 8px;border-radius:8px;color:var(--muted);font-weight:600;font-size:13px}
.nav .on{background:var(--green-soft);color:var(--green-dark)}
.main{flex:1;padding:16px 18px;display:grid;grid-template-columns:220px 1fr;gap:16px}
.panel{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px}
.panel h2{margin:0;font-size:20px}
.hero{width:100%;height:120px;object-fit:cover;border-radius:12px}
.h5{margin:8px 0 0;font-size:16px;font-weight:800}
`;

function phone(shot, c, body) {
  return `<article class="phone" data-shot="${shot}"><div class="status"><span>10:14</span><span>LTE</span></div><header class="hdr"><button class="back">‹</button><h2>${c.title}</h2></header><div class="body">${body}</div></article>`;
}

function slot(c) {
  return `<p class="cap">${c.item} · ${c.ref}</p><p class="note">${c.anytime}</p><div class="chooser"><img src="hero-jbl.png" alt="${c.roles[0]}"/><div class="sources"><button>${cameraIcon}<span>${c.camera}</span></button><button>${galleryIcon}<span>${c.gallery}</span></button></div></div>`;
}

function tile(c, label, stamp, off) {
  const badge = off ? `<span class="badge">${c.badge}</span>` : '';
  return `<div class="tile"><img src="hero-jbl.png" alt=""/><div class="meta"><b>${label}</b><span class="stamp">${stamp}</span>${badge}</div></div>`;
}

function tiles(c) {
  const cells = c.roles
    .map((label, index) => tile(c, label, index === 3 ? c.offDay : c.onDay, index === 3))
    .join('');
  return `<p class="cap">${c.item}</p><div class="grid">${cells}</div>`;
}

function reportRows(c) {
  return c.roles
    .map((label, index) => {
      const off = index === 3;
      const badge = off ? `<span class="badge">${c.badge}</span>` : '';
      return `<div class="row"><img src="hero-jbl.png" alt=""/><div class="copy"><b>${label}</b><span class="stamp">${off ? c.offDay : c.onDay}</span>${badge}</div></div>`;
    })
    .join('');
}

function web(shot, c) {
  const nav = c.nav.map((name, index) => `<span class="${index === 2 ? 'on' : ''}">${name}</span>`).join('');
  return `<article class="web" data-shot="${shot}"><div class="chrome"><span class="dots"><i class="r"></i><i class="y"></i><i class="g"></i></span><div class="url">business.rendasua.com/rentals/bookings/RB-25496259</div></div><div class="web-body"><aside class="nav"><b>Rendasua</b>${nav}</aside><div class="main"><div><img class="hero" src="hero-jbl.png" alt=""/><p class="h5">${c.item}</p><p class="cap">${c.loc}</p></div><section class="panel"><h2>${c.report}</h2><p class="cap">${c.sent}</p>${reportRows(c)}</section></div></div></article>`;
}

function pages() {
  return ['en', 'fr']
    .map((lang) => {
      const c = copy[lang];
      return [
        phone(`${lang}-slot`, c, slot(c)),
        phone(`${lang}-tiles`, c, tiles(c)),
        phone(`${lang}-report-mobile`, { ...c, title: c.report }, `<p class="cap">${c.sent}</p><div class="report">${reportRows(c)}</div>`),
        web(`${lang}-report-web`, c),
      ].join('');
    })
    .join('');
}

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${css}</style></head><body><div class="board">${pages()}</div></body></html>`;

mkdirSync(outDir, { recursive: true });
mkdirSync(here, { recursive: true });
copyFileSync(heroSrc, join(here, 'hero-jbl.png'));
copyFileSync(fontSrc, join(here, 'Inter-Variable.ttf'));
const pagePath = join(here, 'page.html');
writeFileSync(pagePath, html);

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto(`file://${pagePath}`, { waitUntil: 'networkidle' });
const shots = page.locator('[data-shot]');
const count = await shots.count();
const names = [];
for (let i = 0; i < count; i += 1) {
  const node = shots.nth(i);
  const name = await node.getAttribute('data-shot');
  const file = join(outDir, `${name}.png`);
  await node.screenshot({ path: file });
  names.push(file);
}
await browser.close();
console.log(names.join('\n'));
