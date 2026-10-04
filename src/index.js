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
  }
}

function nr(evidence) {
  return evidence?.normalized_result || evidence || {};
}

function observationMs(depth, phase) {
  if (depth === 'deep') return '5000';
  if (depth === 'surface') return '500';
  return phase === 'bundle' ? '3000' : '2000';
}

function buildMarkdown(url, scope, depth, results) {
  const domain = extractDomain(url);
  let md = `# Reconstruction: ${domain}\n`;
  md += `scope: ${scope} | depth: ${depth} | target: ${url}\n`;
  md += `generated: ${new Date().toISOString()}\n\n`;

  if (results.inspect) {
    const d = nr(results.inspect);
    md += `## Page Structure\n\n`;

    if (d.target) {
      md += `- title: ${d.target.title || 'none'}\n`;
      md += `- url: ${d.target.url || url}\n`;
      md += `- origin: ${d.target.origin || 'unknown'}\n`;
    }

    if (d.dom) {
      md += `- dom nodes: ${d.dom.total_nodes || 'unknown'}\n\n`;

      if (d.dom.nodes && Array.isArray(d.dom.nodes)) {
        const tags = {};
        for (const n of d.dom.nodes) {
          const t = n.node_name || n.nodeName || n.tag;
          if (t && !t.startsWith('#')) tags[t] = (tags[t] || 0) + 1;
        }
        const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 20);
        if (sorted.length) {
          md += `### dom tag distribution\n\n`;
          for (const [tag, count] of sorted) md += `- \`${tag}\`: ${count}\n`;
          md += `\n`;
        }
      }
    }

    if (d.frames?.length) {
      md += `### frames (${d.frames.length})\n\n`;
      for (const f of d.frames.slice(0, 10)) md += `- ${f.url || f.name || 'frame'}\n`;
      md += `\n`;
    }

    if (d.scripts?.items?.length) {
      md += `### scripts (${d.scripts.total || d.scripts.items.length})\n\n`;
      for (const s of d.scripts.items.slice(0, 20)) md += `- ${s.url || 'inline'} (${fmtSize(s.length || s.size)})\n`;
      md += `\n`;
    }

    if (d.network?.requests?.length) {
      md += `### network requests (${d.network.requests.length})\n\n`;
      for (const r of d.network.requests.slice(0, 30))
        md += `- ${r.method || 'GET'} ${r.url || r.request_url || '?'} > ${r.status || r.response_status || '?'}\n`;
      md += `\n`;
    }

    if (d.accessibility?.text_capture?.status === 'included') {
      const parts = [];
      for (const n of (d.accessibility?.nodes || [])) {
        const name = n.name?.value || n.name;
        if (name && typeof name === 'string' && name.trim().length > 1) parts.push(name.trim());
      }
      if (parts.length) {
        md += `### page text (accessibility)\n\n\`\`\`\n${[...new Set(parts)].join('\n').slice(0, 4000)}\n\`\`\`\n\n`;
      }
    }

    if (d.storage) {
      const items = [];
      if (d.storage.local_storage_keys?.length) items.push(`localStorage: ${d.storage.local_storage_keys.length} keys`);
      if (d.storage.session_storage_keys?.length) items.push(`sessionStorage: ${d.storage.session_storage_keys.length} keys`);
      if (d.storage.indexed_db_names?.length) items.push(`indexedDB: ${d.storage.indexed_db_names.join(', ')}`);
      if (d.storage.cache_names?.length) items.push(`caches: ${d.storage.cache_names.join(', ')}`);
      if (items.length) {
        md += `### storage\n\n`;
        for (const i of items) md += `- ${i}\n`;
        md += `\n`;
      }
    }

    if (d.metadata?.dom_urls?.length) {
      md += `### referenced urls (${d.metadata.dom_urls.length})\n\n`;
      for (const u of d.metadata.dom_urls.slice(0, 30)) {
        if (typeof u === 'string') md += `- ${u}\n`;
        else if (u?.url) md += `- ${u.url}\n`;
      }
      md += `\n`;
    }
  }

  if (results.bundle) {
    const b = nr(results.bundle);
    md += `## Bundle Analysis\n\n`;

    const scripts = b.scripts?.items || (Array.isArray(b.scripts) ? b.scripts : []);
    if (scripts.length) {
      md += `scripts: ${scripts.length}\n\n`;
      for (const s of scripts.slice(0, 25)) md += `- ${s.url || s.source_url || 'inline'} (${fmtSize(s.length || s.size || s.byte_count)})\n`;
      md += `\n`;
    }

    const eps = b.api_endpoints || b.endpoints;
    if (eps && Array.isArray(eps) && eps.length) {
      md += `### api endpoints (${eps.length})\n\n`;
      for (const ep of eps.slice(0, 60)) {
        if (typeof ep === 'string') md += `- ${ep}\n`;
        else md += `- ${ep.method || '?'} ${ep.path || ep.url || JSON.stringify(ep)}\n`;
      }
      md += `\n`;
    }

    const deps = b.dependencies || b.imports || b.modules;
    if (deps) {
      const list = Array.isArray(deps) ? deps : Object.keys(deps);
      if (list.length) {
        md += `### dependencies (${list.length})\n\n`;
        for (const d of list.slice(0, 50)) md += `- ${typeof d === 'string' ? d : d.name || JSON.stringify(d)}\n`;
        md += `\n`;
      }
    }
  }

  if (results.screenshot) {
    const s = nr(results.screenshot);
    md += `## Visual Capture\n\nscreenshot captured.\n`;
    if (s.viewport) md += `viewport: ${s.viewport.width}x${s.viewport.height}\n`;
    md += `\n`;
  }

  md += `## Evidence (raw)\n\n\`\`\`json\n`;
  const raw = JSON.stringify(results, null, 2);
  md += raw.length > 15000 ? raw.slice(0, 15000) + '\n...(truncated)' : raw;
  md += `\n\`\`\`\n\n---\ngenerated by [engineer Anything](https://enganything.com)\n`;

  return md;
}

function buildStats(results) {
  const stats = [];
  if (results.inspect) {
    const d = nr(results.inspect);
    if (d.dom?.total_nodes) stats.push({ label: 'nodes', value: d.dom.total_nodes });
    if (d.accessibility?.nodes?.length) stats.push({ label: 'a11y nodes', value: d.accessibility.nodes.length });
    if (d.scripts?.total || d.scripts?.items?.length) stats.push({ label: 'scripts', value: d.scripts.total || d.scripts.items.length });
    if (d.network?.requests?.length) stats.push({ label: 'requests', value: d.network.requests.length });
  }
  if (results.bundle) {
    const b = nr(results.bundle);
    const s = b.scripts?.items?.length || (Array.isArray(b.scripts) ? b.scripts.length : 0);
    if (s) stats.push({ label: 'bundle scripts', value: s });
  }
  return stats;
}

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function fmtSize(bytes) {
  if (!bytes) return '?';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { scan };















