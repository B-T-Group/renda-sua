#!/usr/bin/env node
/**
 * Read `eas update --json` output and append group id, runtime version, and
 * branch to the GitHub Actions job summary. Expects the development branch.
 */
const fs = require('fs');

function summarizeDevUpdate(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error('eas update --json did not return any updates');
  }
  const branches = [...new Set(updates.map((update) => update.branch))];
  if (branches.some((branch) => branch !== 'development')) {
    throw new Error(`Expected branch development, got ${branches.join(', ')}`);
  }
  const groups = [...new Set(updates.map((update) => update.group))];
  const runtimes = [...new Set(updates.map((update) => update.runtimeVersion))];
  const lines = [
    '## Dev EAS Update',
    '',
    '- Channel: `development` (eas.json development profile)',
    '- Branch: `development`',
    `- Runtime version: \`${runtimes.join(', ')}\``,
    `- Update group ID: \`${groups.join(', ')}\``,
  ];
  for (const update of updates) {
    lines.push(
      `- ${update.platform}: update \`${update.id}\` group \`${update.group}\` runtime \`${update.runtimeVersion}\``
    );
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const updates = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const summary = summarizeDevUpdate(updates);
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = { summarizeDevUpdate };
