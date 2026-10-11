#!/usr/bin/env node

const { scan } = require('./index');

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('-'));

if (!url || args.includes('--help') || args.includes('-h')) {
  console.log(`
  [engineer Anything]

  usage:
    node src/cli.js <url> [options]

  options:
    --scope <full|api|ui|bundle>    what to scan (default: full)
    --depth <surface|standard|deep> how deep (default: standard)
    --cdp <endpoint>                chrome devtools endpoint (default: http://127.0.0.1:9222)
    --out <file>                    write output to file
    --json                          output raw json instead of markdown
    --quiet                         suppress progress output

  examples:
    node src/cli.js https://stripe.com
    node src/cli.js https://example.com --scope api --depth deep
    node src/cli.js https://linear.app --out reconstruction.md
    node src/cli.js https://vercel.com --json | jq '.stats'
`);
  process.exit(url ? 0 : 1);
}

const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const scope = flag('--scope', 'full');
const depth = flag('--depth', 'standard');
const cdp = flag('--cdp', 'http://127.0.0.1:9222');
const outFile = flag('--out', null);
const jsonMode = args.includes('--json');
const quiet = args.includes('--quiet');

async function main() {
  if (!quiet) {
    process.stderr.write(`[ea] scanning ${url}\n`);
    process.stderr.write(`[ea] scope=${scope} depth=${depth}\n`);
  }

  const result = await scan(url, {
    scope, depth, cdp,
    onStep: quiet ? null : step => process.stderr.write(`[ea] ${step}\n`),
  });

  if (jsonMode) {
    console.log(JSON.stringify({
      url: result.url,
      domain: result.domain,
      stats: result.stats,
      elapsed: result.elapsed,
      markdown: result.markdown,
    }, null, 2));
  } else if (outFile) {
    require('fs').writeFileSync(outFile, result.markdown);
    if (!quiet) process.stderr.write(`[ea] wrote ${outFile}\n`);
  } else {
    console.log(result.markdown);
  }

  if (!quiet) {
    const summary = result.stats.map(s => `${s.value} ${s.label}`).join(', ');
    process.stderr.write(`[ea] done in ${result.elapsed}s (${summary})\n`);
  }
}

main().catch(e => {
  process.stderr.write(`[ea] error: ${e.message}\n`);
  process.exit(1);
});
