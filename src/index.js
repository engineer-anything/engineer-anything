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
    } catch (e) {
      step(`dom: failed (${e.message.slice(0, 60)})`);
    }

    // bundles
    if (['full', 'bundle', 'api'].includes(scope)) {
      step('analyzing bundles...');
      try {
        const raw = rea.exec('analyze-web-bundle', [
          cdp, targetId,
          '--observation-ms', observationMs(depth, 'bundle'),
        ]);
        results.bundle = rea.parse(raw);
        step('bundles captured');
      } catch (e) {
        step(`bundles: skipped (${e.message.slice(0, 60)})`);
      }
    }

    // screenshot
    if (['full', 'ui'].includes(scope)) {
      step('capturing screenshot...');
      try {
        const raw = rea.exec('capture-web-screenshot', [cdp, targetId]);
        results.screenshot = rea.parse(raw);
        step('screenshot captured');
      } catch (e) {
        step(`screenshot: skipped (${e.message.slice(0, 60)})`);
      }
    }

    step('building reconstruction plan...');
    const markdown = buildMarkdown(url, scope, depth, results);
    const stats = buildStats(results);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    step('done');

    return { url, domain: extractDomain(url), scope, depth, markdown, stats, elapsed, evidence: results };
  } finally {
    await closeTab(cdp, targetId);
module.exports = { scan };
