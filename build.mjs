import { cp, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });
await mkdir('dist/assets', { recursive: true });
for (const entry of ['index.html', 'styles.css', 'assets/badge.webp', 'assets/yard.svg']) {
  await cp(entry, `dist/${entry}`);
}
await build({
  entryPoints: ['game.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  legalComments: 'eof',
  outfile: 'dist/game.js',
});
