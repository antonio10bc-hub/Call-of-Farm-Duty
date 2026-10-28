// npm run test:related [ref]: ejecuta solo las pruebas afectadas por lo que ha cambiado respecto
// a ref (por defecto HEAD: lo que aún no está en un commit), con un solo worker.
//   - Cada archivo del juego se asocia a las pruebas de su área (MAP).
//   - Si cambia una prueba, se ejecuta ese archivo; si cambian las utilidades o la
//     configuración de las pruebas, todos.
//   - Lo que es de todo el juego (main.js, index.html, style.css, core/...) ejecuta las @smoke.
import { execSync, spawnSync } from 'node:child_process';

const ref = process.argv[2] || 'HEAD';
const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = [...new Set([...sh(`git diff --name-only ${ref}`), ...sh('git ls-files --others --exclude-standard')])];

const MAP = [
    [/^public\/src\/(world\/Farm|render\/(structures|junk|VoxelModel|materials)|content\/farm)\.js$/, ['map', 'unlock', 'ufo']],
    [/^public\/src\/(game\/Sniper|world\/SniperField|render\/(RifleModel|Shockwaves)|ui\/Scope)\.js$/, ['sniper', 'killstreaks', 'unlock']],
    [/^public\/src\/(game\/Killstreaks|content\/killstreaks)\.js$/, ['killstreaks', 'debug']],
    [/^public\/src\/(game\/Flyers|content\/ufo)\.js$/, ['ufo']],
    [/^public\/src\/game\/FarmState\.js$/, ['map', 'debug', 'unlock']],
    [/^public\/src\/content\/(crops|field)\.js$/, ['sniper', 'unlock']],
];

const files = new Set();
let all = false, smoke = false;
for (const f of changed) {
    const spec = f.match(/^tests\/(\w+)\.spec\.js$/);
    if (spec) files.add(spec[1]);
    else if (/^(tests\/helpers\.js|playwright\.config\.js|package\.json)$/.test(f)) all = true;
    else {
        const hit = MAP.find(([re]) => re.test(f));
        if (hit) hit[1].forEach((s) => files.add(s));
        else if (f.startsWith('public/')) smoke = true;
    }
}

const run = (args) => {
    console.log(`> npx playwright test ${args.join(' ')}`);
    const r = spawnSync('npx', ['playwright', 'test', ...args, '--workers=1'], { stdio: 'inherit' });
    if (r.status) process.exit(r.status);
};
if (all) run([]);
else {
    if (files.size) run([...files].map((s) => `tests/${s}.spec.js`));
    if (smoke) run(['--grep', '@smoke']);
    if (!files.size && !smoke) console.log('Nada del juego ni de las pruebas ha cambiado: no hay pruebas que ejecutar.');
}
