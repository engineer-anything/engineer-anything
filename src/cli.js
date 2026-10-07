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
const url = process.argv[2];
if (!url) { console.log("usage: node src/cli.js <url>"); process.exit(1); }
scan(url).then(r => console.log(r.markdown)).catch(e => { console.error(e.message); process.exit(1); });
