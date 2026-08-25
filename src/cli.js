#!/usr/bin/env node
const { scan } = require('./index');
const url = process.argv[2];
if (!url) { console.log('usage: node src/cli.js <url>'); process.exit(1); }
scan(url).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exit(1); });
