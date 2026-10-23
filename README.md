# [engineer Anything]

reverse engineer any web application from the command line.

give it a url. it rips apart the DOM, scripts, accessibility tree, network calls, the whole thing. you get a markdown reconstruction plan back.

**web:** [enganything.com](https://enganything.com)

## what it does

- full DOM tree extraction with tag frequency analysis
- javascript bundle capture and dependency mapping
- accessibility tree with semantic text content
- viewport screenshots and layout capture
- network request observation and API route detection
- storage inventory (localStorage, sessionStorage, indexedDB, caches)

## setup

```bash
git clone https://github.com/engineer-anything/engineer-anything
cd engineer-anything
npm install
```

you need [rea](https://github.com/morluto/rea) and chrome running with remote debugging:

```bash
npm install -g rea-agents
chromium --headless --remote-debugging-port=9222 &
```

## usage

```bash
# full scan
node src/cli.js https://stripe.com

# api surface only
node src/cli.js https://api.example.com --scope api

# deep scan, save to file
node src/cli.js https://linear.app --depth deep --out reconstruction.md

# json output for piping
node src/cli.js https://vercel.com --json | jq '.stats'

# custom chrome endpoint
node src/cli.js https://example.com --cdp http://localhost:9222
```

### flags

| flag | default | what it does |
|------|---------|-------------|
| `--scope` | `full` | full, api, ui, or bundle |
| `--depth` | `standard` | surface, standard, or deep |
| `--cdp` | `http://127.0.0.1:9222` | chrome devtools endpoint |
| `--out` | stdout | write to file |
| `--json` | - | raw json output |
| `--quiet` | - | no progress logs |

### scopes

| scope | what gets scanned |
|-------|-------------------|
| `full` | dom + bundles + screenshot + everything |
| `api` | dom + bundles (focused on endpoints) |
| `ui` | dom + screenshot |
| `bundle` | javascript bundles only |

### depth

| depth | behavior |
|-------|----------|
| `surface` | quick pass, 500ms observation |
| `standard` | 2-3s observation per phase |
| `deep` | 5s observation, more data |

## as a library

```javascript
const { scan } = require('./src/index');

const result = await scan('https://stripe.com', {
  scope: 'full',
  depth: 'standard',
  cdp: 'http://127.0.0.1:9222',
  onStep: step => console.log(step),
});

result.markdown   // full reconstruction plan
result.stats      // [{ label: 'nodes', value: 3595 }, ...]
result.elapsed    // '24.9'
result.evidence   // raw rea evidence objects
result.domain     // 'stripe.com'
```

## how it works

1. opens a fresh chrome tab via CDP
2. navigates to the target url and waits for load
3. runs `rea inspect-web-page` for DOM and accessibility data
4. runs `rea analyze-web-bundle` for script and dependency analysis
5. runs `rea capture-web-screenshot` for visual capture
6. builds a structured markdown reconstruction plan
7. closes the tab

all analysis is passive. nothing gets executed or modified on the target.

