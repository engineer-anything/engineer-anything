const { execSync } = require('child_process');

const REA_BIN = process.env.REA_BIN || 'rea';

function exec(command, args, opts = {}) {
  const cmd = `${REA_BIN} ${command} ${args.map(a => `'${String(a).replace(/'/g, "'\\''")}'`).join(' ')} --format json`;
  return execSync(cmd, {
    timeout: opts.timeout || 180000,
    maxBuffer: opts.maxBuffer || 50 * 1024 * 1024,
    encoding: 'utf-8',
  });
}

function parse(raw) {
  try { return JSON.parse(raw); } catch {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return { raw: raw.slice(0, 10000) };
}

module.exports = { exec, parse };
