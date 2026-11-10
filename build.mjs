import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });
for (const entry of ['index.html', 'styles.css', 'assets']) {
  await cp(entry, `dist/${entry}`, { recursive: true });
}
await build({
  entryPoints: ['site.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'eof',
  outfile: 'dist/site.js',
});
