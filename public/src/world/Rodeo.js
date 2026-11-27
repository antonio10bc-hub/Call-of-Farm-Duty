import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { wrapAngle } from '../core/math.js';
import { CROPS } from '../content/crops.js';
import { L } from '../core/I18n.js';
import { buildHorse, animateHorse } from '../render/horse.js';

// El rodeo (el campo de tiro de las fichas de caballo): el jugador va montado a caballo dando
// vueltas a una pista con su valla blanca a cada lado. Cada vez, un recorrido de los de COURSES
// (con sus curvas y sus subidas y bajadas) y en un sentido o en el contrario. El caballo corre solo
// y salta las vallas de salto que hay por la pista; el jugador solo mira y dispara:
//   - siluetas (dianas y alienígenas, de formas y tamaños distintos) colgadas de un brazo que sale
//     de un poste de la valla: llegan dobladas y, al acercarse, el brazo gira hacia la pista y la
//     silueta se despliega cortando el paso. Un tiro y se dobla y se aparta; si no, el caballo se la
//     come y tropieza (pierde velocidad un rato)
//   - jinetes alienígenas en caballos alienígenas (con sus caretas de cartón, como los coches de
//     los mercaderes) que vienen de frente por la pista: si llegan, te arrollan y se llevan una
//     ficha (una vuelta menos); abatidos, suman a la racha alienígena
// Cada vuelta completa da una ficha de caballo: los blancos del campo son las vueltas (lap: no se
// les dispara), y lo que se dispara (siluetas y jinetes) no cuenta para lo recogido (noLoot).
const _d = new THREE.Object3D();
_d.rotation.order = 'YXZ';
const _v = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const EYE = 2.75; // la vista del jinete (a lomos del caballo)
const HALF = 1.9; // media anchura de la pista (de la valla de dentro a la de fuera)

// Los recorridos: la forma (r: armónicos del radio, k veces por vuelta con amplitud a) y las
// colinas (hills: cuántas y de qué altura, en metros con el campo normal)
export const COURSES = [
    { id: 'oval', name: L('THE OVAL', 'EL ÓVALO'), r: [], hills: [1, 0.45] },
    { id: 'bean', name: L('THE BEAN', 'LA JUDÍA'), r: [[1, 0.12], [2, 0.16]], hills: [2, 0.5] },
    { id: 'triangle', name: L('THE TRIANGLE', 'EL TRIÁNGULO'), r: [[3, 0.13]], hills: [3, 0.4] },
    { id: 'clover', name: L('THE CLOVER', 'EL TRÉBOL'), r: [[4, 0.1]], hills: [2, 0.6] },
    { id: 'snake', name: L('THE SNAKE', 'LA SERPIENTE'), r: [[5, 0.07], [2, 0.09]], hills: [3, 0.5] },
    { id: 'hill', name: L('THE BIG HILL', 'LA GRAN COLINA'), r: [[2, 0.1]], hills: [1, 0.9] },
];

export class Rodeo {
    constructor(outlineColor) {
        this.root = new THREE.Group();
        this.outlineColor = outlineColor;
        this.ink = outline(outlineColor);
        this.mats = new Map();
        this.list = []; // lo que se mueve (obstáculos y jinetes)
        this.decor = [];
        this.laps = [];
        this.on = false;
    }

    mat(c) {
        return this.mats.get(c) || this.mats.set(c, toon(c)).get(c);
    }

    part(g, w, h, d, c, x, y, z, line = true) {
        const m = new THREE.Mesh(box(w, h, d), this.mat(c));
        m.position.set(x, y, z);
        g.add(m);
        if (line) {
            const o = new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), this.ink);
            o.position.copy(m.position);
            g.add(o);
        }
        return m;
    }

    // ---------- La pista: medida por su longitud (s, en metros) ----------
    // course: el recorrido (de COURSES); reverse: en el sentido contrario
    buildTrack(f, course, reverse) {
        const sc = f.scale || 1, rx = 8.6 * sc, rz = 5.8 * sc, N = 900, pts = [];
        const ph = course.r.map(() => rand(0, Math.PI * 2)), [nh, H] = course.hills, hp = rand(0, Math.PI * 2);
        let len = 0;
        for (let i = 0; i <= N; i++) {
            const a = ((reverse ? N - i : i) / N) * Math.PI * 2;
            const r = 1 + course.r.reduce((t, [k, amp], j) => t + amp * Math.cos(k * a + ph[j]), 0);
            // (las colinas: nh jorobas por vuelta, de 0 a H; con el campo grande, más altas)
            const y = H * Math.sqrt(sc) * Math.pow(0.5 - 0.5 * Math.cos(nh * a + hp), 1.5);
            const x = f.cx + Math.cos(a) * rx * r, z = f.cz + Math.sin(a) * rz * r;
            if (i) len += Math.hypot(x - pts[i - 1].x, z - pts[i - 1].z, y - pts[i - 1].y);
            pts.push({ x, y, z, s: len });
        }
        this.track = { pts, len, N, course, reverse };
    }

    // Punto de la pista a s metros de la salida, desplazado side metros hacia un lado:
    // { x, y, z, tx, tz, slope } (tx, tz: hacia dónde va, en llano; slope: lo que sube por metro)
    at(s, side = 0, out = {}) {
        const T = this.track, L = T.len;
        s = ((s % L) + L) % L;
        let lo = 0, hi = T.N;
        while (hi - lo > 1) {
            const m = (lo + hi) >> 1;
            if (T.pts[m].s <= s) lo = m;
            else hi = m;
        }
        const a = T.pts[lo], b = T.pts[hi], k = (s - a.s) / Math.max(1e-6, b.s - a.s), d = Math.max(1e-6, Math.hypot(b.x - a.x, b.z - a.z));
        const tx = (b.x - a.x) / d, tz = (b.z - a.z) / d;
        out.x = a.x + (b.x - a.x) * k + tz * side;
        out.z = a.z + (b.z - a.z) * k - tx * side;
        out.y = a.y + (b.y - a.y) * k;
        out.tx = tx;
        out.tz = tz;
        out.slope = (b.y - a.y) / d;
        return out;
    }

    // Vallas blancas a los dos lados (postes y dos travesaños), instanciadas, y la tierra de la pista:
    // donde sube, sobre un terraplén de tierra
    buildFences() {
        const L = this.track.len, n = Math.round(L / 2.2), posts = [], rails = [], dirt = [];
        const p = {}, q = {};
        for (const side of [-HALF - 0.2, HALF + 0.2]) for (let i = 0; i < n; i++) {
            this.at((i / n) * L, side, p);
            this.at(((i + 1) / n) * L, side, q);
            posts.push({ x: p.x, y: p.y + 0.55, z: p.z, sx: 0.16, sy: 1.1, sz: 0.16, ry: 0, c: 0x8a5a34 });
            const ry = Math.atan2(q.x - p.x, q.z - p.z), len = Math.hypot(q.x - p.x, q.z - p.z), rx = -Math.atan2(q.y - p.y, len);
            for (const y of [0.5, 0.92]) rails.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + y, z: (p.z + q.z) / 2, sx: 0.08, sy: 0.12, sz: Math.hypot(len, q.y - p.y) + 0.05, ry, rx, c: 0xfff6e8 });
        }
        for (let i = 0; i < n * 3; i++) {
            this.at((i / (n * 3)) * L, 0, p);
            this.at(((i + 1) / (n * 3)) * L, 0, q);
            const top = Math.max(p.y, q.y) + 0.06;
            dirt.push({ x: (p.x + q.x) / 2, y: top / 2, z: (p.z + q.z) / 2, sx: HALF * 2 + 0.6, sy: top, sz: Math.hypot(q.x - p.x, q.z - p.z) + 0.12, ry: Math.atan2(q.x - p.x, q.z - p.z), c: i % 2 ? 0xb8925a : 0xc09a62 });
        }
        this.instances([...posts, ...rails], true);
        this.instances(dirt, false);
    }

    instances(list, line) {
        const make = (m) => {
            const mesh = new THREE.InstancedMesh(box(1, 1, 1), m, list.length);
            list.forEach((b, i) => {
                const o = line && m === this.ink ? OUTLINE * 2 : 0;
                _d.position.set(b.x, b.y, b.z);
                _d.rotation.set(b.rx || 0, b.ry, 0);
                _d.scale.set(b.sx + o, b.sy + o, b.sz + o);
                _d.updateMatrix();
                mesh.setMatrixAt(i, _d.matrix);
                if (m !== this.ink) mesh.setColorAt(i, new THREE.Color(b.c));
            });
            this.root.add(mesh);
            this.decor.push(mesh);
        };
        make(toon(0xffffff));
        if (line) make(this.ink);
    }

    // Una valla de salto atravesada en la pista (postes de rayas y dos barras rojas y blancas)
    hurdle(s) {
        const g = new THREE.Group(), p = this.at(s);
        g.position.set(p.x, p.y, p.z);
        g.rotation.y = Math.atan2(p.tx, p.tz);
        for (const x of [-HALF + 0.1, HALF - 0.1]) {
            for (let k = 0; k < 4; k++) this.part(g, 0.18, 0.3, 0.18, k % 2 ? 0xffffff : 0xc8402e, x, 0.15 + k * 0.3, 0, k === 0);
            this.part(g, 0.28, 0.08, 0.28, 0xffd23f, x, 1.24, 0);
        }
        for (const [y, c] of [[0.42, 0xffffff], [0.78, 0xc8402e]]) this.part(g, HALF * 2 - 0.3, 0.1, 0.1, c, 0, y, 0);
        this.root.add(g);
        this.decor.push(g);
        this.hurdles.push({ s, g });
    }

    // La salida (y la meta): raya blanca en el suelo y su arco con el cartel y banderines
    finishLine() {
        const g = new THREE.Group(), p = this.at(0);
        g.position.set(p.x, p.y, p.z);
        g.rotation.y = Math.atan2(p.tx, p.tz);
        for (let k = 0; k < 8; k++) this.part(g, (HALF * 2) / 8, 0.04, 0.4, k % 2 ? 0xffffff : 0x2a2622, -HALF + (k + 0.5) * (HALF * 2) / 8, 0.07, 0, false);
        for (const x of [-HALF - 0.5, HALF + 0.5]) this.part(g, 0.24, 3.6, 0.24, 0x8a5a34, x, 1.8, 0);
        this.part(g, HALF * 2 + 1.6, 0.7, 0.16, 0xffd23f, 0, 3.4, 0);
        this.part(g, HALF * 2 + 1.2, 0.46, 0.18, 0xc8402e, 0, 3.4, 0, false);
        for (let k = 0; k < 7; k++) this.part(g, 0.24, 0.3, 0.04, [0x5ab4ff, 0xffd23f, 0xff7ae0, 0x7dff4a][k % 4], -HALF + k * (HALF * 2) / 6, 2.85, 0, false);
        this.root.add(g);
        this.decor.push(g);
    }

    // count: las vueltas (cada una, una ficha). f: el campo (SniperField)
    spawn(count, f) {
        this.clear();
        this.f = f;
        this.on = true;
        this.hold = false;
        // El recorrido de hoy, y en qué sentido (course: para las pruebas, uno concreto)
        const course = (this.force && COURSES.find((c) => c.id === this.force.course)) || pick(COURSES);
        const reverse = this.force && this.force.reverse !== undefined ? this.force.reverse : Math.random() < 0.5;
        this.buildTrack(f, course, reverse);
        this.buildFences();
        this.finishLine();
        this.hurdles = [];
        const L = this.track.len, nh = f.scale > 1.6 ? 4 : 3;
        for (let k = 0; k < nh; k++) this.hurdle(L * (k + 0.55) / nh);
        // Las vueltas (los blancos que cuentan): invisibles y lejos de todo, no brotan ni se disparan
        for (let i = 0; i < count; i++) {
            const s = { kind: 'lap', lap: true, mod: this, x: f.cx + 9999, y: -50, z: f.cz, hb: [0.01, 0.01, 0.01], alive: true, landed: false, grow: -1e9, flash: 0, dying: 0 };
            this.laps.push(s);
            f.targets.push(s);
        }
        // El caballo del jugador: se ve su cuello y su cabeza por delante
        this.mount = buildHorse(this.ink);
        this.mount.g.rotation.order = 'YXZ';
        this.root.add(this.mount.g);
        this.decor.push(this.mount.g);
        // La carrera: s (metros recorridos desde la salida), v (velocidad) y lo demás
        this.R = { s: 1.5, v: 0, yaw: null, tilt: 0, stun: 0, jump: -1, lap: 0, nextObs: 3, nextRider: rand(3, 5) };
    }

    hittable(s) {
        return s.alive && s.landed && !s.lap && (s.kind !== 'sign' || s.open > 0.7);
    }

    get speed() {
        return CROPS.tomato.speed * Math.sqrt(this.f.scale || 1);
    }

    // ---------- Lo que sale en la pista ----------
    // Lejos de las vallas de salto, de la salida y de lo que ya hay
    freeS(s) {
        const L = this.track.len, gap = (a, b) => {
            const d = (((a - b) % L) + L) % L;
            return Math.min(d, L - d);
        };
        if (this.hurdles.some((h) => gap(h.s, s) < 4) || gap(0, s) < 3) return false;
        return !this.list.some((o) => o.alive && gap(o.s, s) < 4);
    }

    // Una silueta de chapa (plana, con su contorno) colgando de su bisagra (la parte de arriba en
    // y = 0, hacia abajo). Devuelve su ancho y su alto. Formas: diana redonda, diana cuadrada,
    // alienígena de cuerpo entero y cabeza de alienígena (cada una de su tamaño)
    silhouette(g, kind, k) {
        const T = 0.06, px = (w, h, c, x, y, line = true) => this.part(g, w * k, h * k, T, c, x * k, -y * k, 0, line);
        if (kind === 'bull' || kind === 'square') {
            // (pixelada: filas de cuadros; la redonda, recortada en círculo)
            const n = 7, c = (n - 1) / 2, cols = [0xffffff, 0xc8402e, 0xffffff, 0xc8402e];
            for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
                const d = kind === 'bull' ? Math.hypot(i - c, j - c) : Math.max(Math.abs(i - c), Math.abs(j - c));
                if (d > c + 0.45) continue;
                px(0.16, 0.16, d < 0.8 ? 0xffd23f : cols[Math.min(3, Math.floor(d))], (i - c) * 0.16, 0.2 + j * 0.16, false);
            }
            px(0.16 * n + 0.08, 0.16 * n + 0.08, 0x2a1a0e, 0, 0.2 + c * 0.16, false).position.z = -0.03;
            px(0.04, 0.2, 0x5a5048, 0, 0.1); // (la varilla de la que cuelga)
            return [1.2 * k, 1.4 * k];
        }
        const G = 0x3ec82a, D = 0x2a6a1a;
        px(0.04, 0.2, 0x5a5048, 0, 0.1);
        if (kind === 'alien') {
            // De cuerpo entero: antena, cabeza enorme, cuello, cuerpo y piernas, todo de chapa verde
            px(0.12, 0.12, 0xff3e5e, 0, 0.26);
            px(0.04, 0.16, D, 0, 0.4);
            px(0.62, 0.46, G, 0, 0.7);
            for (const x of [-0.14, 0.14]) px(0.14, 0.1, 0x111111, x, 0.72, false).position.z = 0.04;
            px(0.36, 0.5, G, 0, 1.18);
            for (const x of [-0.25, 0.25]) px(0.1, 0.42, G, x, 1.18);
            for (const x of [-0.1, 0.1]) px(0.12, 0.44, D, x, 1.64);
            return [0.7 * k, 1.9 * k];
        }
        // La cabeza de alienígena: ancha, con sus dos antenas y los ojos enormes
        for (const x of [-0.24, 0.24]) {
            px(0.04, 0.22, D, x, 0.3);
            px(0.12, 0.12, 0xff3e5e, x, 0.18);
        }
        px(0.9, 0.62, G, 0, 0.72);
        px(0.6, 0.18, G, 0, 1.1);
        for (const x of [-0.2, 0.2]) px(0.22, 0.16, 0x111111, x, 0.72, false).position.z = 0.04;
        return [0.95 * k, 1.25 * k];
    }

    // Una silueta en un poste de la valla (s: dónde). Llega doblada: el brazo, pegado a la valla, y
    // la silueta, plegada contra él; al acercarse el jinete, el brazo gira hacia la pista y la
    // silueta cae y se queda colgando, cortando el paso
    obstacle(s) {
        const side = Math.random() < 0.5 ? -1 : 1, p = this.at(s, side * (HALF + 0.2));
        const g = new THREE.Group();
        g.position.set(p.x, p.y, p.z);
        g.rotation.y = Math.atan2(p.tx, p.tz); // (en g: +z hacia donde va la pista, +x hacia el lado del poste)
        const kind = pick(['bull', 'square', 'alien', 'head']), k = rand(0.75, 1.35);
        const H = 2.5 + rand(0, 0.5) * k;
        this.part(g, 0.2, H, 0.2, 0x5a5048, 0, H / 2, 0);
        this.part(g, 0.3, 0.12, 0.3, 0x3a302a, 0, H, 0);
        // El brazo: gira en lo alto del poste; su silueta, en una bisagra a lo largo de él
        const arm = new THREE.Group();
        arm.position.y = H;
        g.add(arm);
        const reach = rand(1.3, 2.3);
        this.part(arm, reach + 0.3, 0.1, 0.1, 0xffd23f, (reach + 0.3) / 2, 0, 0);
        const hinge = new THREE.Group();
        hinge.position.x = reach;
        arm.add(hinge);
        const [w, h] = this.silhouette(hinge, kind, k);
        const mark = new THREE.Object3D();
        mark.position.y = -h * 0.55;
        hinge.add(mark);
        g.scale.setScalar(0.0001);
        this.root.add(g);
        const o = { kind: 'sign', mod: this, noLoot: true, obj: g, arm, hinge, mark, side, s, x: p.x, y: p.y + H - h / 2, z: p.z, hb: [w / 2, h / 2, w / 2],
            open: 0, opening: false, knock: 0, alive: true, landed: false, grow: 0, flash: 0, dying: 0, gone: 0 };
        this.pose(o);
        this.list.push(o);
        this.f.targets.push(o);
    }

    // Cómo está la silueta: open (0 doblada, 1 cortando el paso) y knock (de un tiro: se dobla hacia atrás)
    pose(o) {
        const a = Math.min(1, o.open / 0.6), b = Math.max(0, Math.min(1, (o.open - 0.45) / 0.35));
        const e = (t) => t * t * (3 - 2 * t);
        // El brazo: de pegado a la valla (hacia atrás) a cruzando la pista (hacia dentro)
        o.arm.rotation.y = Math.PI / 2 + e(a) * (o.side > 0 ? Math.PI / 2 : -Math.PI / 2);
        // La silueta: de plegada contra el brazo a colgando (y, de un tiro, se dobla hacia atrás)
        o.hinge.rotation.x = -o.side * Math.PI / 2 * (1 - e(b)) + o.knock * 1.5; // (plegada hacia fuera de la pista)
        o.obj.updateMatrixWorld(true);
        o.mark.getWorldPosition(_v);
        o.x = _v.x;
        o.y = _v.y;
        o.z = _v.z;
    }

    // Un jinete alienígena que viene de frente por la pista (s: dónde sale)
    rider(s) {
        const h = buildHorse(this.ink, true), side = rand(-0.8, 0.8), p = this.at(s, side);
        h.g.rotation.order = 'YXZ';
        h.g.position.set(p.x, p.y, p.z);
        h.g.scale.setScalar(0.0001);
        this.root.add(h.g);
        const o = { kind: 'rider', mod: this, noLoot: true, rider: true, h, obj: h.g, s, side, v: rand(4.5, 6), x: p.x, y: p.y + 1.5, z: p.z, hb: [0.6, 1.5, 0.6], alive: true, landed: false, grow: 0, flash: 0, dying: 0, gone: 0, spin: 0 };
        this.list.push(o);
        this.f.targets.push(o);
        return o;
    }

    // ---------- La carrera (la llama Sniper en cada fotograma) ----------
    ride(dt, sn) {
        const R = this.R, L = this.track.len;
        if (!R) return;
        const done = sn.ending >= 0, sc = Math.sqrt(this.f.scale || 1);
        let p = this.at(R.s);
        // Velocidad: arranca poco a poco; cuesta arriba va más despacio y cuesta abajo, más deprisa;
        // tras un tropiezo va despacio un rato; al acabar (o con hold, para las pruebas), se para
        R.stun = Math.max(0, R.stun - dt);
        const hill = Math.max(0.6, Math.min(1.3, 1 - p.slope * 0.8));
        const want = done || this.hold ? 0 : this.speed * hill * (R.stun > 0 ? 0.3 : 1);
        R.v += (want - R.v) * Math.min(1, dt * (R.stun > 0 ? 6 : 1.4));
        R.s += R.v * dt;
        // Las vueltas: cada vez que se pasa por la meta, una ficha
        while (!done && R.s >= (R.lap + 1) * L) {
            R.lap++;
            const lap = this.laps.find((l) => l.alive);
            if (lap) {
                const q = this.at(R.s + 6);
                lap.x = q.x;
                lap.y = q.y + 2.6;
                lap.z = q.z;
                lap.landed = true;
                if (sn.hooks.onLap) sn.hooks.onLap(R.lap);
                sn.harvest([lap]);
                lap.x += 9999;
            }
        }
        // Las vallas de salto: el caballo salta solo al llegar (la vista sube y baja)
        const pos = R.s % L;
        if (R.jump < 0 && R.v > 1) for (const h of this.hurdles) {
            const ahead = ((h.s - pos) % L + L) % L;
            if (ahead < R.v * 0.32) {
                R.jump = 0;
                sn.hooks.sfx.play('whoosh');
                break;
            }
        }
        p = this.at(R.s);
        let air = 0;
        if (R.jump >= 0) {
            R.jump += dt / 0.75;
            air = Math.sin(Math.min(1, R.jump) * Math.PI);
            if (R.jump >= 1) {
                R.jump = -1;
                sn.dipV -= 2.6;
                sn.trauma = Math.min(1, sn.trauma + 0.15);
                sn.hooks.sfx.play('drop');
                sn.particles.burst(p.x, p.y + 0.1, p.z, 16, [sn.theme.dust, 0xc09a62], { speed: 1.8, up: 1.4, size: 0.1, ttl: 0.5 });
            }
        }
        // La vista: a lomos del caballo, con el trote; el giro de la pista gira también la vista, y
        // las cuestas la inclinan
        const k = Math.min(1, R.v / 4), tilt = Math.atan(p.slope) * 0.4;
        R.step = (R.step || 0) + dt * (2 + R.v * 1.6);
        const yaw = Math.atan2(-p.tx, -p.tz);
        if (R.yaw !== null) {
            sn.lookYaw += wrapAngle(yaw - R.yaw);
            sn.lookPitch = Math.max(-1.4, Math.min(1.4, sn.lookPitch + tilt - R.tilt));
        } else [sn.lookYaw, sn.lookPitch] = [yaw, -0.04 + tilt]; // (al empezar, mirando al frente)
        R.yaw = yaw;
        R.tilt = tilt;
        sn.pos.set(p.x, p.y + EYE + air * 1.25 + Math.abs(Math.sin(R.step)) * 0.12 * k, p.z);
        // El caballo (debajo del jinete): se le ve el cuello y la cabeza por delante
        const M = this.mount;
        M.g.position.set(p.x - p.tx * 0.75, p.y + air * 1.25, p.z - p.tz * 0.75); // (el jinete, sentado en la silla)
        M.g.rotation.set(-Math.atan(p.slope) - air * 0.25, Math.atan2(p.tx, p.tz), 0);
        M.step = R.step;
        animateHorse(M, 0, sn.time, R.v, air);
        if (done) return;
        // Siluetas que salen por delante (dobladas, en su poste)
        if (!this.hold && (R.nextObs -= dt) <= 0) {
            R.nextObs = rand(1.8, 3.0) / sc;
            for (let t = 0; t < 6; t++) {
                const s = R.s + rand(26, 34) * Math.min(1.4, sc);
                if (this.freeS(s)) {
                    this.obstacle(s);
                    break;
                }
            }
        }
        // Jinetes alienígenas (más de noche)
        const aliens = sn.walkersOn !== false && !(sn.debug && sn.debug.noAliens) && !sn.calm;
        if (aliens && !this.hold && (R.nextRider -= dt) <= 0) {
            R.nextRider = rand(4, 7) / (1 + (sn.nightK || 0));
            const r = this.rider(R.s + rand(30, 40) * Math.min(1.4, sc));
            if (r) sn.hooks.sfx.play('neigh');
        }
        // Las siluetas se despliegan al acercarse; lo que llega vivo, tropiezo (y el jinete se lleva una ficha)
        for (const o of this.list) {
            if (!o.alive) continue;
            if (o.rider && o.landed) o.s -= o.v * dt;
            const gap = o.s - R.s;
            if (o.kind === 'sign' && !o.opening && gap < 17 * Math.min(1.3, sc)) {
                o.opening = true;
                sn.hooks.sfx.play('corner');
            }
            if (gap < (o.rider ? 1.2 : 0.7)) this.crash(o, sn);
        }
    }

    // Choque contra algo de la pista: tropiezo, sacudida y su ruido; el jinete, además, se lleva
    // una ficha (una vuelta menos)
    crash(o, sn) {
        const R = this.R;
        o.alive = false;
        o.crashed = true;
        R.stun = o.rider ? 1.8 : 1.3;
        sn.trauma = 1;
        sn.dipV -= 3;
        sn.streak = sn.streakT = 0;
        sn.hooks.sfx.play('crateHit');
        sn.hooks.sfx.play('drop');
        sn.particles.burst(o.x, o.y, o.z, 30, o.rider ? [0x7dff4a, 0xd8ffb0, 0xffffff] : [0xc8402e, 0xffffff, 0x3ec82a, 0xffd23f], { speed: 3, up: 3, size: 0.12, ttl: 0.7 });
        if (sn.hooks.onCrash) sn.hooks.onCrash(!!o.rider);
        if (o.rider) {
            const lap = [...this.laps].reverse().find((l) => l.alive);
            if (lap) {
                lap.alive = false;
                _v.set(o.x, o.y + 1, o.z).project(sn.camera);
                if (sn.hooks.onStolen) sn.hooks.onStolen(lap, _v.x, _v.y);
            }
            sn.checkEnd();
        }
    }

    // Animación de lo que hay en la pista (la llama el campo en cada fotograma)
    update(dt, time) {
        if (!this.on) return;
        const p = {}, at = this.R ? this.R.s : 0;
        this.list = this.list.filter((o) => {
            const k = o.landed ? 1 : Math.max(0.0001, typeof o.g === 'number' ? o.g : 0.0001);
            if (o.crashed) o.gone += dt * 3;
            if (o.rider) {
                if (!o.alive && !o.crashed) o.gone += dt * 1.4;
                this.at(o.s, o.side, p);
                o.x = p.x;
                o.z = p.z;
                o.y = p.y + 1.5;
                // Abatido: el jinete sale volando dando vueltas y el caballo se va al galope y se encoge
                if (!o.alive && !o.crashed) {
                    o.spin += dt;
                    o.h.rider.position.y = 1.66 + Math.sin(Math.min(1, o.spin / 0.6) * Math.PI) * 1.5;
                    o.h.rider.rotation.x += dt * 14;
                }
                o.obj.position.set(o.x, p.y, o.z);
                o.obj.rotation.set(Math.atan(p.slope), Math.atan2(-p.tx, -p.tz), 0); // (de frente: al revés que el jugador)
                animateHorse(o.h, dt, time, o.landed ? o.v : 0);
                o.s -= (!o.alive ? o.v * 0.5 : 0) * dt;
                o.obj.scale.setScalar(o.alive ? k : Math.max(0.0001, 1 - o.gone));
            } else {
                // La silueta: se despliega; de un tiro se dobla hacia atrás y el brazo vuelve a la valla
                if (o.alive && o.opening) o.open = Math.min(1, o.open + dt * 1.25);
                if (!o.alive && !o.crashed) {
                    o.knock = Math.min(1, o.knock + dt * 5);
                    if (o.knock >= 1) o.open = Math.max(0, o.open - dt * 1.6);
                }
                if (o.flash > 0) o.hinge.rotation.z = Math.sin(time * 60) * o.flash * 0.1;
                this.pose(o);
                o.obj.scale.setScalar(o.crashed ? Math.max(0.0001, 1 - o.gone) : k);
                // (ya atrás: se quita)
                if (at - o.s > 5) o.gone = 1;
            }
            if (o.gone >= 1) {
                this.root.remove(o.obj);
                const i = this.f.targets.indexOf(o);
                if (i >= 0) this.f.targets.splice(i, 1);
                if (o.alive) o.alive = false;
                return false;
            }
            return true;
        });
    }

    clear() {
        for (const g of [...this.list.map((o) => o.obj), ...this.decor]) this.root.remove(g);
        for (const m of this.decor) if (m.isInstancedMesh) m.dispose();
        this.list.length = 0;
        this.decor.length = 0;
        this.laps.length = 0;
        this.hurdles = [];
        this.R = null;
        this.on = false;
    }
}
