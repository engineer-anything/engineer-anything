const { openTab, closeTab } = require('./cdp');
const rea = require('./rea');

async function scan(url, opts = {}) {
  const cdp = opts.cdp || 'http://127.0.0.1:9222';
  const targetId = await openTab(cdp, url);
  try {
    const raw = rea.exec('inspect-web-page', [cdp, targetId, '--include-accessibility-text']);
    const bundleRaw = rea.exec("analyze-web-bundle", [cdp, targetId]);
    const bundle = rea.parse(bundleRaw);
    return { url, evidence: { inspect: rea.parse(raw) } };
  } finally {
    await closeTab(cdp, targetId);
  }
}

module.exports = { scan };
