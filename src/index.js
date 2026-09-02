const { openTab, closeTab } = require('./cdp');
const rea = require('./rea');

const DEFAULT_CDP = 'http://127.0.0.1:9222';

async function scan(url, opts = {}) {
  const scope = opts.scope || 'full';
  const depth = opts.depth || 'standard';
  const cdp = opts.cdp || DEFAULT_CDP;
  const onStep = opts.onStep || null;

  const step = (msg) => { if (onStep) onStep(msg); };
  const startTime = Date.now();

  if (!url || !url.match(/^https?:\/\/.+\..+/)) {
    throw new Error('invalid url');
  }

  step('opening browser tab...');
  const targetId = await openTab(cdp, url);
  step(`tab ready: ${targetId.slice(0, 12)}...`);

  await delay(3000);

  const results = {};

  try {
    // inspect
    step('capturing page snapshot...');
    try {
      const raw = rea.exec('inspect-web-page', [
        cdp, targetId,
        '--include-accessibility-text',
        '--include-console-text',
        '--include-json-body-shapes',
        '--observation-ms', observationMs(depth, 'inspect'),
      ]);
      results.inspect = rea.parse(raw);
      const d = nr(results.inspect);
      step(`dom: ${d.dom?.total_nodes || '?'} nodes, ${d.accessibility?.nodes?.length || 0} a11y nodes`);
module.exports = { scan };
