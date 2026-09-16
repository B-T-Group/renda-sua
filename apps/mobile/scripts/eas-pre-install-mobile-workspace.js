/**
 * EAS detects the yarn workspaces root and runs install there.
 * Limit workspaces to mobile so backend `sharp` is never installed on builders.
 */
const fs = require('fs');
const path = require('path');

const rootPkgPath = path.resolve(__dirname, '../../../package.json');
const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
pkg.workspaces = ['apps/mobile'];
fs.writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('eas-pre-install: root workspaces limited to apps/mobile');
