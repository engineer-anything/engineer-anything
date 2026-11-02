const http = require('http');

function cdpRequest(endpoint, method, path) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, endpoint);
    const req = http.request(u, { method }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('cdp timeout')); });
    req.end();
  });
}

async function openTab(endpoint, url) {
  const data = await cdpRequest(endpoint, 'PUT', `/json/new?${url}`);
  if (!data?.id) throw new Error('failed to open tab');
  return data.id;
}

async function closeTab(endpoint, targetId) {
  try { await cdpRequest(endpoint, 'GET', `/json/close/${targetId}`); } catch {}
}

async function listTargets(endpoint) {
  return cdpRequest(endpoint, 'GET', '/json/list');
}

module.exports = { cdpRequest, openTab, closeTab, listTargets };

