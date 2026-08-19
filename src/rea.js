const { execSync } = require('child_process');
const REA_BIN = process.env.REA_BIN || 'rea';

function exec(command, args) {
  const cmd = `${REA_BIN} ${command} ${args.map(a => `'${a}'`).join(' ')} --format json`;
  return execSync(cmd, { timeout: 120000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' });
}

function parse(raw) {
  try { return JSON.parse(raw); } catch { return { raw: raw.slice(0, 5000) }; }
}

module.exports = { exec, parse };
