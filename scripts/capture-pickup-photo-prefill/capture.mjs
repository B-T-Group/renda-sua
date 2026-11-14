/**
 * Flag-on pickup-photo screens. Not imported by the app.
 * Usage: node scripts/capture-pickup-photo-prefill/capture.mjs
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir =
  process.env.OUT_DIR || '/opt/cursor/artifacts/pickup-photo-prefill/v2';
const heroSrc =
  '/cursor/stores/bot/handoffs/pickup-photo-prefill/hero-jbl.png';

const copy = {
  en: {
    title: 'Pickup photos',
    item: 'JBL PartyBox 310',
    ref: 'RB-25496259',
    loc: "Stripe Rail – L'Assomption",
    start: 'Start from last report',
    summary: 'Last return · 10 Nov · 12 photos · 4 checks',
    note: 'The last return photos are a guide only. You must retake every photo today, ideally with the renter there.',
    guide: 'Use as guide',
    blank: 'Start blank',
    progress: '5 of 12 retaken',
    retakeNote: 'Old photos are a guide. Every slot must be retaken.',
    from: 'from 10 Nov',
    confirm: 'Confirm',
    retake: 'Retake',
    blocked: "Can't send yet",
    submit: 'Submit report',
    blockedBody: 'Retake all photos before sending',
    missing:
      '7 angles from the 10 Nov guide are still missing. Retake them, or skip an extra angle with a reason.',
    retakeMissing: 'Retake missing photos',
    source: 'Photo source',
    camera: 'In-app camera',
    cameraReq: 'Required for pickup photos.',
    library: 'Photo library',
    libraryOff: 'Disabled for this report.',
    libraryNote: 'Gallery photos stay off for this report. Take the photo in the app.',
    take: 'Take photo',
    today: 'Pickup today, take the condition photos with the renter.',
    takePhotos: 'Take pickup photos',
    early: 'You can prepare the checklist now; photos are taken on pickup day.',
    prepare: 'Prepare checklist',
    web: 'Take pickup photos in the Rendasua app',
    enable: 'Enable the camera',
    denied:
      'Pickup photos have to be taken in the app. Turn on the camera in Settings. The photo library stays off.',
    settings: 'Open Settings',
    extra: (n) => `Extra angle ${n}`,
    roles: ['Overview', 'Other side', 'Accessories'],
    checks: [
      ['Condition', 'Overall good'],
      ['Accessories', 'Cable and mic'],
      ['Wear', 'Light scuff on the grille'],
    ],
    missingLine: (count) => `${count} angles from the 10 Nov guide are still missing. Retake them, or skip an extra angle with a reason.`,
    skip: 'Skip this angle',
    reason: 'Angle not on this unit',
    nav: ['Home', 'Orders', 'Rentals', 'Account'],
    back: 'Booking',
    checklist: 'Checklist',
  },
  fr: {
    title: 'Photos de départ',
    item: 'JBL PartyBox 310',
    ref: 'RB-25496259',
    loc: "Stripe Rail – L'Assomption",
    start: 'Reprendre le dernier rapport',
    summary: 'Dernier retour · 10 nov. · 12 photos · 4 contrôles',
    note: "Les photos du dernier retour servent de repère. Vous devez toutes les reprendre aujourd'hui, avec le locataire si possible.",
    guide: 'Utiliser comme guide',
    blank: 'Partir de zéro',
    progress: '5 sur 12 reprises',
    retakeNote: 'Les anciennes photos sont un guide. Chaque case doit être reprise.',
    from: 'depuis le 10 nov.',
    confirm: 'Confirmer',
    retake: 'Reprendre',
    blocked: 'Envoi bloqué',
    submit: 'Envoyer le constat',
    blockedBody: "Reprenez toutes les photos avant l'envoi",
    missing:
      '7 angles du guide du 10 nov. manquent encore. Reprenez-les, ou ignorez un angle supplémentaire avec un motif.',
    retakeMissing: 'Reprendre les photos manquantes',
    source: 'Source de la photo',
    camera: "Appareil photo de l'application",
    cameraReq: 'Requis pour les photos de départ.',
    library: 'Galerie',
    libraryOff: 'Désactivée pour ce rapport.',
    libraryNote:
      "La galerie reste fermée pour ce rapport. Prenez la photo dans l'application.",
    take: 'Prendre la photo',
    today: "Départ aujourd'hui, prenez les photos d'état avec le locataire.",
    takePhotos: 'Prendre les photos de départ',
    early:
      'Vous pouvez préparer la liste maintenant ; les photos se prennent le jour du départ.',
    prepare: 'Préparer la liste',
    web: "Prenez les photos de départ dans l'application Rendasua",
    enable: "Activez l'appareil photo",
    denied:
      "Les photos de départ se prennent dans l'application. Activez l'appareil photo dans les réglages. La galerie reste désactivée.",
    settings: 'Ouvrir les réglages',
    extra: (n) => `Angle supplémentaire ${n}`,
    roles: ['Vue d’ensemble', 'Autre côté', 'Accessoires'],
    checks: [
      ['État', 'Bon état général'],
      ['Accessoires', 'Câble et micro'],
      ['Usure', 'Léger frottement sur la grille'],
    ],
    missingLine: (count) => `${count} angles du guide du 10 nov. manquent encore. Reprenez-les, ou ignorez un angle supplémentaire avec un motif.`,
    skip: 'Ignorer cet angle',
    reason: 'Angle absent sur cette unité',
    nav: ['Accueil', 'Commandes', 'Locations', 'Compte'],
    back: 'Réservation',
    checklist: 'Liste de contrôle',
  },
};

const css = `
@font-face{font-family:Inter;src:url("Inter-Variable.ttf") format("truetype");font-weight:100 900;font-display:block}
:root{--green:#0B7A3B;--green-dark:#085C2C;--green-soft:#DCF5E5;--bg:#FAF9F7;--line:#E6E1D8;--text:#0F172A;--muted:#64748B;--warn-tint:#FEF3C7;--err:#B91C1C;--err-tint:#fee2e2;--info-tint:#e6f7fb}
*{box-sizing:border-box} body{margin:0;background:#0f172a;font-family:Inter,system-ui,sans-serif;color:var(--text)}
.board{display:flex;flex-direction:column;gap:28px;padding:24px}
.phone{width:390px;height:844px;background:var(--bg);border-radius:36px;border:10px solid #0b1220;overflow:hidden;display:flex;flex-direction:column}
.status{height:28px;display:flex;justify-content:space-between;padding:8px 18px 0;font-size:12px;font-weight:700}
.hdr{min-height:52px;display:flex;align-items:center;padding:4px 12px;gap:8px}
.back{background:#fff;border:0;border-radius:999px;padding:8px 12px;font:inherit;font-weight:700;color:var(--green-dark)}
.hdr h2{flex:1;text-align:center;font-size:17px;margin:0}
.body{flex:1;overflow:hidden;padding:4px 16px 8px;display:flex;flex-direction:column;gap:10px}
.footer{padding:10px 16px 14px;background:#fff;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.hero{width:100%;height:120px;object-fit:cover;border-radius:16px}
.h5{font-size:20px;font-weight:800;margin:0}
.cap,.loc{font-size:12px;color:var(--muted);font-weight:600;margin:2px 0 0}
.row{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.pill{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:#0B7A3B18;color:#085C2C;border:1px solid #0B7A3B44}
.btn{min-height:48px;border-radius:12px;border:0;font-weight:700;font-size:15px;font-family:inherit;width:100%}
.btn-green{background:var(--green);color:#fff}
.btn-outline{background:#fff;color:var(--green-dark);border:1.5px solid var(--green)}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.guide{display:flex;gap:12px}
.thumb{width:64px;height:64px;border-radius:12px;object-fit:cover}
.card h3{margin:0 0 4px;font-size:16px}
.card p,.note{margin:0;font-size:13px;line-height:1.4;font-weight:600}
.note{background:var(--info-tint);border-radius:12px;padding:10px 12px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.slot{position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;border:1.5px solid var(--line);background:#e5e7eb}
.slot img{width:100%;height:100%;object-fit:cover}
.slot.ghost img{opacity:.35}
.slot.fresh{border-color:#0B7A3B66}
.tag{position:absolute;left:0;right:0;bottom:0;font-size:8px;font-weight:700;color:#fff;text-align:center;padding:3px 2px;background:linear-gradient(transparent,rgba(15,23,42,.75))}
.progress{font-size:13px;font-weight:700}
.bar{height:6px;background:#E6E1D8;border-radius:99px;overflow:hidden;margin-top:4px}
.bar i{display:block;height:100%;width:41%;background:var(--green)}
.check{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}
.angle{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)}
.angle img{width:40px;height:40px;border-radius:8px;object-fit:cover;opacity:.35}
.angle b{flex:1;font-size:14px}
.angle button{border:1px solid var(--green);background:#fff;color:var(--green-dark);border-radius:10px;font-weight:700;padding:6px 10px;font-family:inherit}
.from{font-size:10px;font-weight:800;color:#92400e;background:var(--warn-tint);border-radius:999px;padding:3px 7px}
.err{background:var(--err-tint);color:#9F1239;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:600}
.lock{display:flex;gap:12px;align-items:center;padding:12px;border:1.5px dashed #D0C9BE;border-radius:14px;background:#fff}
.lock.off{opacity:.55}
.phase{background:#0E749014;border:1px solid #0E749055;border-radius:16px;padding:12px}
.phase h3{margin:0 0 6px;font-size:16px}
.sheet{margin-top:auto;background:#fff;border-radius:20px 20px 0 0;padding:16px;box-shadow:0 -8px 24px rgba(15,23,42,.12)}
.web{width:1280px;height:800px;background:#F4F2EE;border-radius:16px;border:10px solid #0b1220;overflow:hidden;display:flex;flex-direction:column}
.chrome{height:40px;background:#1e293b;display:flex;align-items:center;padding:0 14px;gap:8px}
.dots i{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px}
.r{background:#f87171}.y{background:#fbbf24}.g{background:#34d399}
.url{flex:1;background:#0f172a;color:#94a3b8;border-radius:8px;padding:6px 12px;font-size:12px}
.web-body{flex:1;display:flex;min-height:0}
.nav{width:200px;background:#fff;border-right:1px solid var(--line);padding:16px 12px}
.nav b{display:block;padding:8px;color:#0B2E6F}
.nav span{display:block;padding:8px 10px;border-radius:10px;color:var(--muted);font-weight:600}
.nav .on{background:var(--green-soft);color:var(--green-dark)}
.main{flex:1;padding:20px 28px;display:grid;grid-template-columns:280px 1fr;gap:20px}
.panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px}
.panel h2{margin:0;font-size:22px}
.web .grid{grid-template-columns:repeat(6,1fr)}
.btns{display:flex;gap:10px}
.btns .btn{width:auto;flex:1}
`;

function slots(c, freshCount) {
  const labels = [...c.roles, ...Array.from({ length: 9 }, (_, i) => c.extra(i + 1))];
  return labels
    .map((label, i) => {
      const fresh = i < freshCount;
      return `<div class="slot ${fresh ? 'fresh' : 'ghost'}"><img src="hero-jbl.png" alt=""/><span class="tag">${fresh ? '17 Nov · 10:14' : `${label} · ${c.from}`}</span></div>`;
    })
    .join('');
}

function checks(c) {
  return c.checks
    .map(
      ([k, v]) =>
        `<div class="check"><div><b>${k}</b><div>${v}</div></div><span class="from">${c.from}</span></div>`
    )
    .join('');
}

function phone(shot, c, body, footer = '') {
  return `<article class="phone" data-shot="${shot}"><div class="status"><span>10:14</span><span>LTE</span></div><header class="hdr"><button class="back">‹</button><h2>${c.title}</h2></header><div class="body">${body}</div>${footer}</article>`;
}

function head(c) {
  return `<div class="row"><div><p class="h5">${c.item}</p><p class="cap">${c.ref}</p><p class="loc">${c.loc}</p></div><span class="pill">Reserved</span></div>`;
}

function web(shot, c, panel) {
  return `<article class="web" data-shot="${shot}"><div class="chrome"><span class="dots"><i class="r"></i><i class="y"></i><i class="g"></i></span><div class="url">business.rendasua.com/rentals/bookings/RB-25496259</div></div><div class="web-body"><aside class="nav"><b>Rendasua</b>${c.nav
    .map((n, i) => `<span class="${i === 2 ? 'on' : ''}">${n}</span>`)
    .join('')}</aside><div class="main"><div><img class="hero" src="hero-jbl.png" alt="" style="height:180px"/>${head(c)}</div><section class="panel">${panel}</section></div></div></article>`;
}

function missingAngles(c) {
  return [3, 4, 5, 6, 7, 8, 9].map((n) => c.extra(n));
}

function blockedList(c) {
  const rows = missingAngles(c);
  const items = rows
    .map(
      (label) =>
        `<div class="angle"><img src="hero-jbl.png" alt=""/><b>${label}</b><button>${c.skip}</button></div>`
    )
    .join('');
  return `<section class="card"><h3>${c.blocked}</h3><p>${c.blockedBody}</p><p class="err">${c.missingLine(rows.length)}</p>${items}</section>`;
}

function pages(lang, c) {
  const startBody = `<img class="hero" src="hero-jbl.png" alt=""/>${head(c)}<section class="card guide"><img class="thumb" src="hero-jbl.png" alt=""/><div><h3>${c.start}</h3><p>${c.summary}</p></div></section><p class="note">${c.note}</p>`;
  const startFoot = `<footer class="footer"><button class="btn btn-green">${c.guide}</button><button class="btn btn-outline">${c.blank}</button></footer>`;
  const gridBody = `<p class="progress">${c.progress}</p><div class="bar"><i></i></div><p class="note">${c.retakeNote}</p><div class="grid">${slots(c, 5)}</div><section class="card">${checks(c)}<button class="btn btn-outline" style="margin-top:8px">${c.skip}</button><p class="cap">${c.reason}</p></section>`;
  const blocked = blockedList(c);
  const camera = `${head(c)}<div class="sheet"><h3>${c.source}</h3><div class="lock"><div><b>${c.camera}</b><div class="cap">${c.cameraReq}</div></div></div><div class="lock off"><div><b>${c.library}</b><div class="cap">${c.libraryOff}</div></div></div><p class="note">${c.libraryNote}</p><button class="btn btn-green">${c.take}</button></div>`;
  const today = `<img class="hero" src="hero-jbl.png" alt=""/>${head(c)}<section class="phase"><h3>${c.title}</h3><p>${c.today}</p></section>`;
  const early = `<img class="hero" src="hero-jbl.png" alt=""/>${head(c)}<section class="phase"><h3>${c.title}</h3><p>${c.early}</p><p class="note">${c.note}</p></section><section class="card">${checks(c)}</section>`;
  const denied = `<section class="card" style="margin-top:80px;text-align:center"><h3>${c.enable}</h3><p>${c.denied}</p></section>`;
  const deniedFoot = `<footer class="footer"><button class="btn btn-green">${c.settings}</button></footer>`;
  const webNotice = `<p class="err">${c.web}</p>`;
  return [
    phone(`${lang}-01-start`, c, startBody, startFoot),
    phone(`${lang}-02-grid`, c, gridBody, `<footer class="footer"><button class="btn btn-green" disabled style="opacity:.45">${c.blockedBody}</button></footer>`),
    phone(`${lang}-03-blocked`, c, blocked, `<footer class="footer"><button class="btn btn-green" disabled style="opacity:.45">${c.submit}</button></footer>`),
    phone(`${lang}-04-camera`, c, camera),
    phone(`${lang}-05-today`, c, today, `<footer class="footer"><button class="btn btn-green">${c.takePhotos}</button></footer>`),
    phone(`${lang}-05-early`, c, early, `<footer class="footer"><button class="btn btn-outline">${c.prepare}</button></footer>`),
    phone(`${lang}-camera-denied`, c, denied, deniedFoot),
    web(`${lang}-01-start-web`, c, `<h2>${c.start}</h2><p>${c.summary}</p><p class="note">${c.note}</p>${webNotice}<div class="btns"><button class="btn btn-green">${c.guide}</button><button class="btn btn-outline">${c.blank}</button></div>`),
    web(`${lang}-02-grid-web`, c, `<h2>${c.title}</h2><p class="progress">${c.progress}</p>${webNotice}<div class="grid">${slots(c, 5)}</div><div>${checks(c)}</div>`),
    web(`${lang}-03-blocked-web`, c, `<h2>${c.blocked}</h2>${blockedList(c)}${webNotice}`),
    web(`${lang}-04-readonly-web`, c, `<h2>${c.title}</h2>${webNotice}<p class="note">${c.note}</p><div class="lock off"><div><b>${c.library}</b><div class="cap">${c.libraryOff}</div></div></div>`),
    web(`${lang}-05-today-web`, c, `<h2>${c.title}</h2><p>${c.today}</p>${webNotice}<button class="btn btn-outline">${c.checklist}</button>`),
    web(`${lang}-05-early-web`, c, `<h2>${c.prepare}</h2><p>${c.early}</p><div>${checks(c)}</div><button class="btn btn-green">${c.prepare}</button>`),
  ].join('');
}

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${css}</style></head><body><div class="board">${pages('en', copy.en)}${pages('fr', copy.fr)}</div></body></html>`;

mkdirSync(outDir, { recursive: true });
mkdirSync(here, { recursive: true });
copyFileSync(heroSrc, join(here, 'hero-jbl.png'));
copyFileSync(
  '/cursor/stores/bot/handoffs/pickup-photo-prefill/Inter-Variable.ttf',
  join(here, 'Inter-Variable.ttf')
);
const { writeFileSync } = await import('node:fs');
const pagePath = join(here, 'page.html');
writeFileSync(pagePath, html);

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`file://${pagePath}`, { waitUntil: 'networkidle' });
const shots = page.locator('[data-shot]');
const count = await shots.count();
const names = [];
for (let i = 0; i < count; i += 1) {
  const node = shots.nth(i);
  const name = await node.getAttribute('data-shot');
  if (!name?.includes('-03-')) continue;
  const file = join(outDir, `${name}.png`);
  await node.screenshot({ path: file });
  names.push(file);
}
await browser.close();
console.log(names.join('\n'));
