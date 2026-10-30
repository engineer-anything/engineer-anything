const { scan } = require('../src/index');

async function main() {
  const result = await scan('https://example.com', {
    scope: 'full',
    depth: 'standard',
    onStep: step => console.log(`  ${step}`),
  });

  console.log(`\ndone in ${result.elapsed}s`);
  console.log(`stats: ${result.stats.map(s => `${s.value} ${s.label}`).join(', ')}`);
  console.log(`\n${result.markdown.slice(0, 500)}...`);
}

main().catch(console.error);


