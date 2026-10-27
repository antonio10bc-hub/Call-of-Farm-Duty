import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { Tower } from '../render/structures.js';
import { junkyard, barrelParts, JUNK } from '../render/junk.js';
import { CROPS } from '../content/crops.js';
import { FIELD } from '../content/field.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const _w = new THREE.Color(0xffffff);
const CLUMP = 20; // tallos por mata de trigo
const LEAVES = 9; // bloques de hojas por mata de tomate
const MAX = 64; // blancos como mucho

// Punto dentro del polígono (regla del rayo)
function inside(poly, x, z) {
    let ok = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ok = !ok;
    }
    return ok;
}

// Distancia de un punto al borde del polígono
function edgeDist(poly, x, z) {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j], b = poly[i];
        const vx = b.x - a.x, vz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
        best = Math.min(best, Math.hypot(x - a.x - vx * t, z - a.z - vz * t));
    }
    return best;
}

// Resto siempre positivo (las casillas lejanas tienen coordenadas negativas)
const mod = (a, n) => ((a % n) + n) % n;

function instanced(root, mat, n) {
    const m = new THREE.InstancedMesh(box(1, 1, 1), mat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    root.add(m);
    return m;
}

// Campo de tiro: un campo en forma de cuadrilátero de lados distintos, con una torre de vigía
// en cada esquina. Según a qué se entra:
//   - cosecha de trigo: las matas maduras son los blancos
//   - cosecha de tomates: matas de tomate con tomates gigantes; cada tomate es un blanco
//   - desbloqueo: el terreno está sucio y lleno de chatarra, con un barril rojo encima del
//     montón del fondo. Un disparo al barril lo hace volar todo y deja la tierra limpia.
export class SniperField {
    constructor(theme) {
        this.theme = theme;
        this.poly = FIELD.corners;
        this.cx = this.poly.reduce((s, p) => s + p.x, 0) / this.poly.length;
        this.cz = this.poly.reduce((s, p) => s + p.z, 0) / this.poly.length;
        this.root = new THREE.Group();
        this.animated = [];
        this.targets = [];
        this.plants = []; // matas de tomate (cada una con sus tomates en targets)
        this.junk = null;
        this.introT = 0;
        // Torres: un poco por fuera de cada esquina, girada hacia el centro
        this.towers = this.poly.map((p) => {
            const dx = p.x - this.cx, dz = p.z - this.cz, d = Math.hypot(dx, dz);
            const t = new Tower(theme.outline, true);
            const x = p.x + (dx / d) * FIELD.towerOut, z = p.z + (dz / d) * FIELD.towerOut;
            t.root.position.set(x, 0, z);
            t.root.rotation.y = Math.atan2(this.cx - x, this.cz - z) + Math.PI;
            this.root.add(t.root);
            return { x, z, floor: 3.2, model: t };
        });
        // La atalaya del desbloqueo: sola y muy lejos, mirando al montón de chatarra
        const F = FIELD.farTower, ft = new Tower(theme.outline, true);
        ft.root.position.set(F.x, 0, F.z);
        ft.root.rotation.y = Math.atan2(FIELD.pile.x - F.x, FIELD.pile.z - F.z) + Math.PI;
        ft.root.visible = false;
        this.root.add(ft.root);
        this.farTower = { x: F.x, z: F.z, floor: 3.2, model: ft };
        this.build();
    }

    // Desbloqueo: solo se ve la atalaya lejana (las cuatro del campo no están)
    setUnlockView(on) {
        for (const t of this.towers) t.model.root.visible = !on;
        this.farTower.model.root.visible = on;
    }

    build() {
        const { theme, root } = this;
        const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), toon(theme.grassFar));
        far.rotation.x = -Math.PI / 2;
        far.position.set(this.cx, -0.31, this.cz);
        root.add(far);

        // Casillas alrededor del campo: dentro tierra (arada o sucia), fuera hierba
        // (hasta la atalaya lejana del desbloqueo, que también pisa casillas)
        const xs = [...this.poly.map((p) => p.x), FIELD.farTower.x], zs = [...this.poly.map((p) => p.z), FIELD.farTower.z];
        const c0 = Math.floor(Math.min(...xs)) - 7, c1 = Math.ceil(Math.max(...xs)) + 7;
        const r0 = Math.floor(Math.min(...zs)) - 7, r1 = Math.ceil(Math.max(...zs)) + 7;
        const tiles = [];
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) tiles.push({ c, r, soil: inside(this.poly, c + 0.5, r + 0.5) });
        const floor = new THREE.InstancedMesh(box(1, 0.3, 1), toon(0xffffff), tiles.length);
        tiles.forEach(({ c, r, soil }, i) => floor.setColorAt(i, _c.setHex(soil ? theme.soil[r & 1] : theme.grass[mod(c * 5 + r * 3, 3)]).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter)));
        this.addAnimated(floor, tiles.map(({ c, r, soil }) => ({ x: c + 0.5, y: soil ? -0.12 : -0.15, z: r + 0.5 })));
        this.floor = floor;
        this.tiles = tiles;

        // Rastrojo: plantitas bajas por todo el campo (decorado, no se dispara). Su color
        // depende de a qué se entra (dress)
        const stub = [];
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
            for (let k = 0; k < 3; k++) {
                const x = c + Math.random(), z = r + Math.random();
                if (!inside(this.poly, x, z)) continue;
                const h = 0.1 + Math.random() * 0.18;
                stub.push({ x, y: h / 2, z, sx: 0.05, sy: h, sz: 0.05, ry: 0, tone: Math.random() });
            }
        }
        this.stubMesh = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), Math.max(1, stub.length));
        this.stub = stub;
        this.addAnimated(this.stubMesh, stub);

        // Valla a lo largo de los bordes del campo
        const posts = [];
        for (let i = 0; i < this.poly.length; i++) {
            const a = this.poly[i], b = this.poly[(i + 1) % this.poly.length];
            const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(len / 1.2);
            for (let k = 0; k <= n; k++) posts.push({ x: a.x + ((b.x - a.x) * k) / n, y: 0.3, z: a.z + ((b.z - a.z) * k) / n, sx: 0.12, sy: 0.6, sz: 0.12 });
        }
        this.addHulled(0x9a6a3a, posts);

        // Árboles alrededor, y colinas a lo lejos
        const trunks = [], leaves = [];
        const F = FIELD.farTower, P = FIELD.pile;
        for (let k = 0; k < 60; k++) {
            const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 16, s = 0.9 + Math.random() * 0.7;
            const x = this.cx + Math.sin(a) * d, z = this.cz + Math.cos(a) * d;
            // Ninguno entre la atalaya lejana y el barril (ni pegado a ella)
            if (segDist(x, z, F.x, F.z, P.x, P.z) < 3.5 + FIELD.pileJitter) continue;
            trunks.push({ x, y: 0.5 * s, z, sx: 0.3 * s, sy: s, sz: 0.3 * s });
            leaves.push({ x, y: 1.35 * s, z, sx: 1.5 * s, sy: 0.9 * s, sz: 1.5 * s, ry: k, k: 0 });
            leaves.push({ x, y: 2.0 * s, z, sx: 1.05 * s, sy: 0.7 * s, sz: 1.05 * s, ry: k + 0.4, k: 1 });
        }
        this.addHulled(0x7a4f2a, trunks);
        const lm = this.addHulled(0xffffff, leaves);
        leaves.forEach((p, i) => lm.setColorAt(i, _c.setHex(theme.leaves[(p.k + i) % 3])));
        // Nubes
        const mat = toon(theme.clouds), hullMat = outline(theme.outline);
        this.clouds = [];
        for (let i = 0; i < 10; i++) {
            const g = new THREE.Group();
            const parts = 3 + (i % 3);
            for (let k = 0; k < parts; k++) {
                const w = 1.8 + Math.random() * 2, h = 0.8 + Math.random() * 0.5, d = 1.4 + Math.random();
                const m = new THREE.Mesh(box(1, 1, 1), mat);
                m.scale.set(w, h, d);
                m.position.set(k * 1.4 - parts * 0.7, Math.random() * 0.4, (Math.random() - 0.5) * 0.8);
                const o = new THREE.Mesh(box(1, 1, 1), hullMat);
                o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
                o.position.copy(m.position);
                g.add(m, o);
            }
            const a = (i / 10) * Math.PI * 2;
            g.position.set(this.cx + Math.sin(a) * (30 + Math.random() * 15), 10 + Math.random() * 6, this.cz + Math.cos(a) * (30 + Math.random() * 15));
            g.userData.speed = 0.3 + Math.random() * 0.4;
            root.add(g);
            this.clouds.push(g);
        }

        // Blancos: matas de trigo (tallos y espigas) y matas de tomate (hojas, tallo, tutor y
        // tomates con su contorno y su rabito), instanciados y rellenados al entrar
        this.tStalks = instanced(root, toon(0xffffff), MAX * CLUMP);
        this.tEars = instanced(root, toon(0xffffff), MAX * CLUMP);
        this.tLeaves = instanced(root, toon(0xffffff), MAX * LEAVES);
        this.tStems = instanced(root, toon(0xffffff), MAX * 2);
        this.tFruit = instanced(root, toon(0xffffff), MAX);
        this.tFruitHull = instanced(root, outline(theme.outline), MAX);
        this.tCalyx = instanced(root, toon(CROPS.tomato.calyx), MAX);
    }

    addHulled(color, pts) {
        const n = Math.max(1, pts.length);
        const mesh = new THREE.InstancedMesh(box(1, 1, 1), toon(color), n);
        const hull = new THREE.InstancedMesh(box(1, 1, 1), outline(this.theme.outline), n);
        this.addAnimated(mesh, pts);
        this.addAnimated(hull, pts.map((p) => ({ ...p, sx: (p.sx || 1) + OUTLINE * 2, sy: (p.sy || 1) + OUTLINE * 2, sz: (p.sz || 1) + OUTLINE * 2 })));
        return mesh;
    }

    addAnimated(mesh, positions) {
        mesh.frustumCulled = false;
        mesh.count = positions.length;
        const delays = positions.map((p) => Math.min(1.2, Math.hypot(p.x - this.cx, p.z - this.cz) * 0.03));
        const entry = { mesh, positions, delays };
        this.animated.push(entry);
        this.root.add(mesh);
        this.layout(entry, 0);
        return entry;
    }

    layout({ mesh, positions, delays }, t) {
        positions.forEach((p, i) => {
            const k = Math.min(1, Math.max(0, (t - delays[i]) / 0.45));
            const s = k <= 0 ? 0.0001 : easeOutBack(k);
            _d.position.set(p.x, p.y - (1 - k) * 3, p.z);
            _d.rotation.set(0, p.ry || 0, 0);
            _d.scale.set(p.sx || 1, (p.sy || 1) * s, p.sz || 1);
            _d.updateMatrix();
            mesh.setMatrixAt(i, _d.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
    }

    // Aspecto del suelo según a qué se entra: 'wheat' / 'tomato' (tierra arada con rastrojo o
    // brotes) o 'junk' (tierra sucia con maleza seca)
    dress(kind) {
        const { theme } = this;
        this.tiles.forEach(({ c, r, soil }, i) => {
            if (!soil) return;
            const col = kind === 'junk' ? JUNK.ground[mod(c * 7 + r * 5 + mod(c * r, 3), JUNK.ground.length)] : theme.soil[r & 1];
            this.floor.setColorAt(i, _c.setHex(col).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter));
        });
        this.floor.instanceColor.needsUpdate = true;
        const T = CROPS.tomato;
        this.stub.forEach((s, i) => {
            const col = kind === 'junk' ? (s.tone < 0.6 ? 0x8a7a4a : 0x6f8a3a) : kind === 'tomato' ? T.leaves[i % 3] : s.tone < 0.7 ? 0xb8a050 : CROPS.wheat.stages[1];
            this.stubMesh.setColorAt(i, _c.setHex(col).offsetHSL(0, 0, (s.tone - 0.5) * 0.1));
        });
        this.stubMesh.instanceColor.needsUpdate = true;
        this.cleaning = null;
    }

    // Un sitio libre dentro del campo, lejos del borde y de los demás (a más de spacing)
    freeSpot(taken, spacing) {
        const xs = this.poly.map((p) => p.x), zs = this.poly.map((p) => p.z);
        let x = 0, z = 0;
        for (let tries = 0; tries < 80; tries++) {
            x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs));
            z = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
            if (!inside(this.poly, x, z) || edgeDist(this.poly, x, z) < FIELD.margin) continue;
            if (taken.some((s) => Math.hypot(s.x - x, s.z - z) < spacing)) continue;
            break;
        }
        return { x, z };
    }

    // Coloca los blancos de la cosecha: count matas de trigo o count tomates (en matas de 1 a 3)
    spawn(crop, count) {
        this.clearSheaves();
        this.dress(crop);
        this.crop = crop;
        count = Math.min(count, MAX);
        if (crop === 'tomato') return this.spawnTomatoes(count);
        for (let i = 0; i < count; i++) {
            const { x, z } = this.freeSpot(this.targets, 1.6);
            const stalks = Array.from({ length: CLUMP }, () => {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.38;
                return { ox: Math.sin(a) * r, oz: Math.cos(a) * r, h: 1.2 + Math.random() * 0.45 - r * 0.6, tilt: (Math.random() - 0.5) * 0.25, dir: Math.random() * Math.PI * 2, ph: Math.random() * 6, tone: Math.random() };
            });
            this.targets.push({ x, y: 0.9, z, stalks, alive: true, grow: -0.5 - i * 0.06, landed: false, flash: 0, dying: 0 });
        }
        this.tStalks.count = this.tEars.count = this.targets.length * CLUMP;
    }

    spawnTomatoes(count) {
        let left = count;
        while (left > 0) {
            const n = Math.min(left, 1 + ((Math.random() * 3) | 0));
            const { x, z } = this.freeSpot(this.plants, 2.2);
            const plant = {
                x, z, h: 1.7 + Math.random() * 0.3, ph: Math.random() * 6, grow: -0.5 - this.plants.length * 0.08, g: 0.0001, sway: 0,
                leaves: Array.from({ length: LEAVES }, (_, k) => ({ a: k * 2.4 + Math.random() * 0.5, y: 0.3 + (k / LEAVES) * 1.35, r: 0.22 + Math.random() * 0.16, w: 0.72 - (k / LEAVES) * 0.32, tone: Math.random() })),
            };
            this.plants.push(plant);
            const a0 = Math.random() * Math.PI * 2;
            for (let k = 0; k < n; k++) {
                // Tomates gigantes colgando alrededor del tallo, a distintas alturas
                const a = a0 + (k / n) * Math.PI * 2, size = 0.55 + Math.random() * 0.15;
                const tx = x + Math.sin(a) * 0.5, tz = z + Math.cos(a) * 0.5, ty = 0.55 + k * 0.38 + Math.random() * 0.1;
                this.targets.push({ plant, x: tx, y: ty, z: tz, size, ry: a, tone: Math.random(), alive: true, grow: plant.grow - 0.15 - k * 0.08, landed: false, flash: 0, dying: 0 });
            }
            left -= n;
        }
        this.tLeaves.count = this.plants.length * LEAVES;
        this.tStems.count = this.plants.length * 2;
        this.tFruit.count = this.tFruitHull.count = this.tCalyx.count = this.targets.length;
        const T = CROPS.tomato;
        this.plants.forEach((p, pi) => {
            p.leaves.forEach((l, k) => this.tLeaves.setColorAt(pi * LEAVES + k, _c.setHex(T.leaves[(k + pi) % 3]).offsetHSL(0, 0, (l.tone - 0.5) * 0.08)));
            this.tStems.setColorAt(pi * 2, _c.setHex(T.leaves[2]));
            this.tStems.setColorAt(pi * 2 + 1, _c.setHex(T.stake));
        });
        this.tLeaves.instanceColor.needsUpdate = this.tStems.instanceColor.needsUpdate = true;
    }

    // Terreno abandonado: chatarra a montones por todo el campo y por la hierba hasta la atalaya
    // lejana y, al fondo, el gran montón con el barril rojo
    spawnJunk() {
        this.clearSheaves();
        this.dress('junk');
        this.crop = null;
        const F = this.farTower, xs = this.poly.map((p) => p.x), zs = this.poly.map((p) => p.z);
        // El montón, cada vez en un sitio algo distinto (dentro del campo, lejos del borde)
        let P = FIELD.pile;
        for (let k = 0; k < 30; k++) {
            const x = FIELD.pile.x + (Math.random() * 2 - 1) * FIELD.pileJitter, z = FIELD.pile.z + (Math.random() * 2 - 1) * FIELD.pileJitter;
            if (inside(this.poly, x, z) && edgeDist(this.poly, x, z) > 3) {
                P = { x, z };
                break;
            }
        }
        const { pieces, barrel } = junkyard({
            x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs),
            px: P.x, pz: P.z, count: 120,
            inside: (x, z) => inside(this.poly, x, z) && edgeDist(this.poly, x, z) > 0.8,
            layers: [[2.4, 11], [1.8, 9], [1.3, 7], [0.8, 4]],
        });
        // Fuera del campo: chatarra por la hierba en el camino hasta la atalaya
        const out = junkyard({
            x0: F.x - 12, x1: Math.max(...xs) + 8, z0: F.z - 12, z1: Math.max(...zs) + 8, px: 9999, pz: 9999, count: 110, layers: [],
            inside: (x, z) => !inside(this.poly, x, z) && edgeDist(this.poly, x, z) > 0.8 && Math.hypot(x - F.x, z - F.z) > 6 && segDist(x, z, F.x, F.z, P.x, P.z) < 16,
        });
        pieces.push(...out.pieces);
        const g = new THREE.Group(), ink = outline(this.theme.outline), mats = new Map();
        const mat = (c) => mats.get(c) || mats.set(c, toon(c)).get(c);
        const part = (p, parent) => {
            const m = new THREE.Mesh(box(1, 1, 1), mat(p.color));
            m.scale.set(p.sx, p.sy, p.sz);
            const o = new THREE.Mesh(box(1, 1, 1), ink);
            o.scale.set(p.sx + OUTLINE * 2, p.sy + OUTLINE * 2, p.sz + OUTLINE * 2);
            const holder = new THREE.Group();
            holder.position.set(p.x, p.y, p.z);
            holder.rotation.set(0, p.ry || 0, p.rz || 0);
            holder.add(m, o);
            parent.add(holder);
            return holder;
        };
        const flying = pieces.map((p) => ({ obj: part(p, g), vx: 0, vy: 0, vz: 0, spin: 0 }));
        // El barril: sus piezas en un grupo propio (es lo que hay que darle)
        const bg = new THREE.Group();
        for (const p of barrelParts({ ...barrel, x: 0, y: 0, z: 0 })) part(p, bg);
        bg.position.set(barrel.x, barrel.y, barrel.z);
        g.add(bg);
        // Contorno que brilla alrededor del barril (casco invertido de color vivo, sin luz): el
        // blanco se distingue desde la atalaya
        const glow = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff3e1a, side: THREE.BackSide }));
        glow.scale.set(barrel.w * 1.4, barrel.h * 1.3, barrel.w * 1.4);
        glow.position.y = barrel.h / 2;
        bg.add(glow);
        // Bola de fuego de la explosión: cubos anidados que crecen y se apagan
        const fireball = [0xffffff, 0xffe03a, 0xff9a1f, 0xff3e1a].map((c, i) => {
            const m = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false }));
            m.visible = false;
            m.position.set(barrel.x, barrel.y + barrel.h / 2, barrel.z);
            m.rotation.set(i * 0.4, i * 0.7, i * 0.2);
            m.renderOrder = 10 - i;
            g.add(m);
            return m;
        });
        this.root.add(g);
        const r = barrel.w * 0.6;
        this.junk = {
            group: g, pieces: flying, barrel: bg, glow, fireball, mats, center: barrel, t: -1, idle: 0,
            body: mats.get(JUNK.barrel),
            hit: [barrel.x - r, barrel.y, barrel.z - r, barrel.x + r, barrel.y + barrel.h, barrel.z + r],
            pile: [P.x - 3, 0, P.z - 3, P.x + 3, barrel.y, P.z + 3],
        };
    }

    // El barril (para apuntar y para las pruebas): centro y radio
    get barrel() {
        const b = this.junk && this.junk.center;
        return b ? { x: b.x, y: b.y + b.h / 2, z: b.z } : null;
    }

    // Boom: la chatarra sale volando desde el barril y la tierra se limpia en ola
    explode() {
        const J = this.junk;
        if (!J || J.t >= 0) return;
        J.t = 0;
        J.barrel.visible = false;
        for (const m of J.fireball) m.visible = true;
        const b = J.center;
        // La onda llega a todo: lo de cerca sale disparado y lo de lejos, a saltos
        for (const p of J.pieces) {
            const dx = p.obj.position.x - b.x, dz = p.obj.position.z - b.z, d = Math.hypot(dx, dz) || 1;
            const k = 30 / (1 + d * 0.1);
            p.vx = (dx / d) * k * (0.6 + Math.random() * 0.5);
            p.vz = (dz / d) * k * (0.6 + Math.random() * 0.5);
            p.vy = (9 + Math.random() * 14) / (1 + d * 0.035);
            p.spin = (Math.random() - 0.5) * 18;
            p.delay = d * 0.012; // la onda tarda en llegar a lo de lejos
        }
        this.cleaning = { x: b.x, z: b.z, t: 0, done: new Set() };
    }

    get exploded() {
        return !!this.junk && this.junk.t >= 0;
    }

    clearJunk() {
        if (!this.junk) return;
        this.root.remove(this.junk.group);
        for (const m of this.junk.mats.values()) m.dispose();
        for (const m of [...this.junk.fireball, this.junk.glow]) m.material.dispose();
        this.junk = null;
    }

    clearSheaves() {
        this.targets.length = 0;
        this.plants.length = 0;
        for (const m of [this.tStalks, this.tEars, this.tLeaves, this.tStems, this.tFruit, this.tFruitHull, this.tCalyx]) m.count = 0;
        this.clearJunk();
    }

    get sheaves() {
        return this.targets;
    }

    get remaining() {
        return this.targets.reduce((n, s) => n + (s.alive ? 1 : 0), 0);
    }

    // Rayo contra las cajas de los blancos vivos: la bala los atraviesa todos hasta tocar el
    // suelo (colateral). Devuelve [{ sheaf, t }] del más cercano al más lejano.
    raycast(origin, dir) {
        const ground = dir.y < -1e-6 ? -origin.y / dir.y : Infinity;
        const hits = [];
        for (const s of this.targets) {
            if (!s.alive || !s.landed) continue;
            const t = rayBox(origin, dir, ...hitBox(s));
            if (t !== null && t <= ground) hits.push({ sheaf: s, t });
        }
        return hits.sort((a, b) => a.t - b.t);
    }

    // Desbloqueo: ¿la bala da al barril (barrel), a la chatarra del montón (pile) o a nada?
    raycastJunk(origin, dir) {
        const J = this.junk;
        if (!J || J.t >= 0) return null;
        const t = rayBox(origin, dir, ...J.hit);
        if (t !== null) return { barrel: true, t };
        const tp = rayBox(origin, dir, ...J.pile);
        return tp !== null ? { pile: true, t: tp } : null;
    }

    // onLand(target): cuando un blanco termina de brotar
    update(dt, time, eye, onLand) {
        if (this.introT < 2.2) {
            this.introT += dt;
            for (const a of this.animated) this.layout(a, this.introT);
        }
        for (const s of this.targets) {
            if (!s.landed) {
                s.grow += dt;
                const k = Math.min(1, Math.max(0, s.grow / 0.5));
                s.g = k <= 0 ? 0.0001 : easeOutBack(k);
                if (k >= 1) {
                    s.landed = true;
                    if (onLand) onLand(s);
                }
            }
            if (s.dying > 0) s.dying = Math.max(0, s.dying - dt);
            s.flash = Math.max(0, s.flash - dt * 6);
        }
        if (this.crop === 'wheat') this.drawWheat(time);
        else if (this.crop === 'tomato') this.drawTomatoes(dt, time);
        if (this.junk) this.updateJunk(dt);
        for (const t of this.towers) t.model.update(dt);
        for (const c of this.clouds) {
            const a = Math.atan2(c.position.x - this.cx, c.position.z - this.cz) + c.userData.speed * dt * 0.015;
            const d = Math.hypot(c.position.x - this.cx, c.position.z - this.cz);
            c.position.x = this.cx + Math.sin(a) * d;
            c.position.z = this.cz + Math.cos(a) * d;
        }
    }

    drawWheat(time) {
        this.targets.forEach((s, ti) => {
            const gone = !s.alive && s.dying <= 0;
            const pop = !s.alive ? 1 + (0.14 - s.dying) * 2.5 : 1;
            s.stalks.forEach((st, k) => {
                const i = ti * CLUMP + k;
                const h = st.h * (s.g || 0.0001) * (gone ? 0.0001 : 1);
                // Viento: se mecen en ola, más las de arriba
                const sway = st.tilt + Math.sin(time * 1.8 - s.x * 0.4 + st.ph * 0.2) * 0.1;
                const sx = Math.sin(st.dir) * Math.sin(sway), sz = Math.cos(st.dir) * Math.sin(sway);
                _d.position.set(s.x + st.ox * pop + sx * h / 2, Math.cos(sway) * h / 2, s.z + st.oz * pop + sz * h / 2);
                _d.rotation.set(Math.cos(st.dir) * sway, 0, -Math.sin(st.dir) * sway);
                _d.scale.set(0.06 * pop, Math.max(0.0001, h), 0.06 * pop);
                _d.updateMatrix();
                this.tStalks.setMatrixAt(i, _d.matrix);
                _c.setHex(CROPS.wheat.stages[3]).offsetHSL(0, 0, (st.tone - 0.5) * 0.1).lerp(_w, s.flash);
                this.tStalks.setColorAt(i, _c);
                const e = gone ? 0.0001 : (s.g || 0.0001) * pop;
                _d.position.set(s.x + st.ox * pop + sx * (h + 0.12), Math.cos(sway) * (h + 0.12), s.z + st.oz * pop + sz * (h + 0.12));
                _d.scale.set(0.11 * e, 0.28 * e, 0.11 * e);
                _d.updateMatrix();
                this.tEars.setMatrixAt(i, _d.matrix);
                _c.setHex(st.tone < 0.5 ? CROPS.wheat.ear : CROPS.wheat.earDark).lerp(_w, s.flash);
                this.tEars.setColorAt(i, _c);
            });
        });
        for (const m of [this.tStalks, this.tEars]) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
    }

    // Matas de tomate (hojas, tallo y tutor) y sus tomates gigantes, un poco aplastados como
    // los de verdad, con contorno y rabito verde
    drawTomatoes(dt, time) {
        const T = CROPS.tomato;
        this.plants.forEach((p, pi) => {
            p.grow += dt;
            const k = Math.min(1, Math.max(0, p.grow / 0.5));
            p.g = k <= 0 ? 0.0001 : easeOutBack(k);
            p.sway = Math.sin(time * 1.5 - p.x * 0.4 + p.ph) * 0.05;
            const h = p.h * p.g;
            p.leaves.forEach((l, k2) => {
                const y = l.y * p.g;
                _d.position.set(p.x + Math.sin(l.a) * l.r * p.g + p.sway * y, y, p.z + Math.cos(l.a) * l.r * p.g);
                _d.rotation.set(0, l.a, p.sway);
                _d.scale.set(l.w * p.g, 0.3 * p.g, l.w * 0.8 * p.g);
                _d.updateMatrix();
                this.tLeaves.setMatrixAt(pi * LEAVES + k2, _d.matrix);
            });
            _d.position.set(p.x + p.sway * h * 0.5, h / 2, p.z);
            _d.rotation.set(0, 0, p.sway);
            _d.scale.set(0.1, Math.max(0.0001, h), 0.1);
            _d.updateMatrix();
            this.tStems.setMatrixAt(pi * 2, _d.matrix);
            _d.position.set(p.x - 0.22, h * 0.58, p.z + 0.12);
            _d.rotation.set(0, 0, 0);
            _d.scale.set(0.07, Math.max(0.0001, h * 1.16), 0.07);
            _d.updateMatrix();
            this.tStems.setMatrixAt(pi * 2 + 1, _d.matrix);
        });
        this.targets.forEach((s, i) => {
            const gone = !s.alive && s.dying <= 0;
            const pop = !s.alive ? 1 + (0.14 - s.dying) * 3 : 1;
            const e = gone ? 0.0001 : (s.g || 0.0001) * pop;
            const sw = s.plant.sway * s.y;
            _d.position.set(s.x + sw, s.y, s.z);
            _d.rotation.set(0, s.ry, 0);
            _d.scale.set(s.size * e, s.size * 0.86 * e, s.size * e);
            _d.updateMatrix();
            this.tFruit.setMatrixAt(i, _d.matrix);
            _d.scale.set(gone ? 0.0001 : s.size * e + OUTLINE * 2, gone ? 0.0001 : s.size * 0.86 * e + OUTLINE * 2, gone ? 0.0001 : s.size * e + OUTLINE * 2);
            _d.updateMatrix();
            this.tFruitHull.setMatrixAt(i, _d.matrix);
            _c.setHex(s.tone < 0.5 ? T.fruit : T.fruitDark).lerp(_w, s.flash);
            this.tFruit.setColorAt(i, _c);
            _d.position.set(s.x + sw, s.y + s.size * 0.43 * e, s.z);
            _d.scale.set(s.size * 0.5 * e, 0.1 * e, s.size * 0.5 * e);
            _d.updateMatrix();
            this.tCalyx.setMatrixAt(i, _d.matrix);
        });
        for (const m of [this.tLeaves, this.tStems, this.tFruit, this.tFruitHull, this.tCalyx]) {
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
    }

    // Tras la explosión: las piezas vuelan, giran, rebotan y se encogen. La tierra se va
    // limpiando en un anillo que sale del barril.
    updateJunk(dt) {
        const J = this.junk;
        if (J.t < 0) {
            // Espera: el barril tiembla, late y parpadea, y su contorno brilla (rojo a amarillo)
            const t = (J.idle += dt), b = J.center, beat = Math.max(0, Math.sin(t * 6)) ** 6;
            J.barrel.rotation.set(Math.sin(t * 7.3) * 0.05, t * 0.6, Math.sin(t * 9.1) * 0.05);
            J.barrel.scale.setScalar(1 + beat * 0.12);
            J.body.color.setHex(JUNK.barrel).lerp(_w, (Math.sin(t * 6) > 0.85 ? 0.55 : 0) + beat * 0.2);
            const k = 0.5 + 0.5 * Math.sin(t * 4);
            J.glow.material.color.setHex(0xff2a1a).lerp(_c.setHex(0xffe03a), k);
            J.glow.scale.set(b.w * (1.3 + k * 0.25), b.h * (1.22 + k * 0.18), b.w * (1.3 + k * 0.25));
            return;
        }
        J.t += dt;
        // Bola de fuego: crece de golpe y se apaga
        J.fireball.forEach((m, i) => {
            const grow = Math.min(1, J.t / (0.25 + i * 0.08)), fade = Math.max(0, (J.t - 0.3 - i * 0.12) / 0.9);
            // De dentro afuera: núcleo blanco, amarillo, naranja y rojo
            m.scale.setScalar(Math.max(0.0001, (2 + 10 * (1 - (1 - grow) ** 3)) * (0.55 + i * 0.15) * (1 + fade * 0.4)));
            m.material.opacity = Math.max(0, 1 - fade);
            m.rotation.y += dt * (1 + i);
            m.visible = fade < 1;
        });
        for (const p of J.pieces) {
            const o = p.obj;
            if (p.delay > 0) {
                p.delay -= dt;
                continue;
            }
            p.vy -= 18 * dt;
            o.position.x += p.vx * dt;
            o.position.y = Math.max(0.1, o.position.y + p.vy * dt);
            o.position.z += p.vz * dt;
            if (o.position.y <= 0.1 && p.vy < 0) {
                p.vy *= -0.3;
                p.vx *= 0.6;
                p.vz *= 0.6;
            }
            o.rotation.x += p.spin * dt;
            o.rotation.z += p.spin * 0.7 * dt;
            o.scale.setScalar(Math.max(0.0001, 1 - Math.max(0, J.t - 1.6) / 0.8));
        }
        const C = this.cleaning;
        if (!C) return;
        C.t += dt;
        const R = C.t * 26, { theme } = this;
        this.tiles.forEach(({ c, r, soil }, i) => {
            if (!soil || C.done.has(i) || Math.hypot(c + 0.5 - C.x, r + 0.5 - C.z) > R) return;
            C.done.add(i);
            this.floor.setColorAt(i, _c.setHex(theme.soil[r & 1]).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter));
        });
        this.floor.instanceColor.needsUpdate = true;
        if (R > 60) this.cleaning = null;
    }

    restartIntro() {
        this.introT = 0;
    }
}

// Distancia de (x, z) al segmento a-b
function segDist(x, z, ax, az, bx, bz) {
    const vx = bx - ax, vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(x - ax - vx * t, z - az - vz * t);
}

// Caja de impacto de un blanco: se ciñe a la silueta de la mata de trigo (tallos y espigas) o
// al tomate (algo más grande que él, que se ve enorme pero es lo que hay que darle)
function hitBox(s) {
    if (!s.plant) return [s.x - 0.36, 0, s.z - 0.36, s.x + 0.36, 1.55, s.z + 0.36];
    const r = s.size * 0.62;
    return [s.x - r, s.y - r, s.z - r, s.x + r, s.y + r, s.z + r];
}

// Rayo contra caja alineada con los ejes (método de las franjas). Devuelve t o null.
function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = Infinity;
    for (const [oa, da, lo, hi] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
        if (Math.abs(da) < 1e-9) {
            if (oa < lo || oa > hi) return null;
            continue;
        }
        let t0 = (lo - oa) / da, t1 = (hi - oa) / da;
        if (t0 > t1) [t0, t1] = [t1, t0];
        tmin = Math.max(tmin, t0);
        tmax = Math.min(tmax, t1);
        if (tmin > tmax) return null;
    }
    return tmin;
}
