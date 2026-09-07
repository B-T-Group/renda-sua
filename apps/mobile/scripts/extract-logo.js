/**
 * Extrait l'image PNG en base64 du SVG rendasua.svg et la sauvegarde en rendasua.png
 * À lancer une fois : node scripts/extract-logo.js
 */
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'assets', 'rendasua.svg');
const pngPath = path.join(__dirname, '..', 'assets', 'rendasua.png');

const svg = fs.readFileSync(svgPath, 'utf8');
const match = svg.match(/xlink:href="data:image\/png;base64,([^"]+)"/);
if (!match) {
  console.error('Aucune image base64 trouvée dans le SVG');
  process.exit(1);
}
const buffer = Buffer.from(match[1], 'base64');
fs.writeFileSync(pngPath, buffer);
console.log('OK: assets/rendasua.png créé');
