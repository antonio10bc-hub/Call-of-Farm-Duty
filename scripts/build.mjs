// Build de la web publicada (Vercel: npm run build → dist/). En local no hace falta: el
// servidor sirve public/ tal cual, con sus módulos sueltos.
//
// Copia public/ en dist/ y sustituye los módulos de src/ por un único src/main.js
// empaquetado y minificado (three.js se queda aparte, en vendor/, vía el importmap). Así la
// primera carga hace una petición en lugar de decenas. También minifica style.css.
import { build, transform } from 'esbuild';
import { cp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = 'dist';

await rm(OUT, { recursive: true, force: true });
await cp('public', OUT, { recursive: true, filter: (src) => !src.startsWith('public/src') });
await mkdir(`${OUT}/src`, { recursive: true });

const result = await build({
    entryPoints: ['public/src/main.js'],
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2020',
    external: ['three'],
    outfile: `${OUT}/src/main.js`,
    legalComments: 'none',
    metafile: true,
});

const css = await transform(await readFile('public/style.css', 'utf8'), { loader: 'css', minify: true });
await writeFile(`${OUT}/style.css`, css.code);

const modules = Object.keys(result.metafile.inputs).length;
const bytes = result.metafile.outputs[`${OUT}/src/main.js`].bytes;
console.log(`dist/src/main.js: ${modules} módulos → 1 archivo de ${(bytes / 1024).toFixed(0)} KB`);
