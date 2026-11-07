// Build de la web publicada (Vercel: npm run build → dist/). En local no hace falta: el
// servidor sirve public/ tal cual, con sus módulos sueltos (y three.js aparte, vía el importmap).
//
// Copia public/ en dist/ y:
//  - empaqueta los módulos de src/ y three.js en un único src/main.<huella>.js minificado (una
//    sola petición, sin la cadena main.js → three.js, y solo lo que se usa de three.js)
//  - minifica style.css en style.<huella>.css
//  - con la huella en el nombre, esos archivos no cambian nunca: el navegador (vercel.json) y el
//    service worker (sw.js) los guardan para siempre; index.html apunta a los de esta versión
//  - el service worker se rehace con la lista de esta versión y su propio nombre de caché
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';

const OUT = 'dist';
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

await rm(OUT, { recursive: true, force: true });
// (three.js ya va dentro del paquete; de vendor/ solo queda su licencia)
await cp('public', OUT, { recursive: true, filter: (src) => !src.startsWith('public/src') && !src.endsWith('three.module.min.js') && !src.endsWith('style.css') });
await mkdir(`${OUT}/src`, { recursive: true });

const result = await build({
    entryPoints: ['public/src/main.js'],
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2020',
    alias: { three: './public/vendor/three.module.min.js' },
    write: false,
    legalComments: 'none',
    metafile: true,
});
const js = result.outputFiles[0].contents;
const jsName = `src/main.${hash(js)}.js`;
await writeFile(`${OUT}/${jsName}`, js);

const css = (await transform(await readFile('public/style.css', 'utf8'), { loader: 'css', minify: true })).code;
const cssName = `style.${hash(css)}.css`;
await writeFile(`${OUT}/${cssName}`, css);

// index.html: a los archivos de esta versión (y sin importmap: three.js ya va dentro); el módulo
// se pide desde el principio (modulepreload), sin esperar a leer toda la página
let html = await readFile('public/index.html', 'utf8');
html = html
    .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, `\n    <link rel="modulepreload" href="${jsName}">`)
    .replace('href="style.css"', `href="${cssName}"`)
    .replace('src="src/main.js"', `src="${jsName}"`);
if (!html.includes(jsName) || !html.includes(cssName) || html.includes('importmap')) throw new Error('index.html: no se han podido cambiar las rutas');
await writeFile(`${OUT}/index.html`, html);

// El service worker: su caché lleva la huella de esta versión y su lista, los archivos de ahora
let sw = await readFile('public/sw.js', 'utf8');
const version = hash(jsName + cssName + html + sw);
sw = sw
    .replace(/const CACHE = '[^']*';/, `const CACHE = 'cofd-${version}';`)
    .replace("'./src/main.js',", `'./${jsName}',`)
    .replace("'./style.css',", `'./${cssName}',`)
    .replace("    './vendor/three.module.min.js',\n", '');
if (!sw.includes(jsName) || sw.includes('three.module')) throw new Error('sw.js: no se ha podido cambiar la lista');
await writeFile(`${OUT}/sw.js`, sw);

const modules = Object.keys(result.metafile.inputs).length;
console.log(`dist/${jsName}: ${modules} módulos (con three.js) → ${(js.length / 1024).toFixed(0)} KB; dist/${cssName}: ${(css.length / 1024).toFixed(0)} KB`);
