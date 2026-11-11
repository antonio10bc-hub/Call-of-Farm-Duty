import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';
import { easeOutBack } from '../core/math.js';
import { Tower } from '../render/structures.js';
import { junkyard, barrelParts, JUNK } from '../render/junk.js';
import { CROPS } from '../content/crops.js';
import { buildCow, animateCow } from '../render/cow.js';
import { buildSheep, animateSheep } from '../render/sheep.js';
import { buildPig, animatePig } from '../render/pig.js';
import { buildFish, animateFish } from '../render/fish.js';
import { buildChicken, animateChicken } from '../render/chicken.js';
import { FIELD } from '../content/field.js';
import { RangeTargets } from './RangeTargets.js';
import { BeeSun } from './BeeSun.js';

const _d = new THREE.Object3D();
const _c = new THREE.Color();
const _w = new THREE.Color(0xffffff);
const CLUMP = 20; // tallos por mata de trigo
const LEAVES = 9; // bloques de hojas por mata de tomate
const MAX = 300; // blancos como mucho (el maíz al máximo, 260)

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
//   - cosecha de calabazas: calabazas enormes entre hojas; aguantan varios tiros y paran la bala
//   - leche: vacas que corren por el prado; cada poco se les llena la ubre y, llena, un tiro a la
//     ubre da un cubo
//   - cosecha de maíz: matas altas en hileras con dos mazorcas cada una (los blancos)
//   - desbloqueo: el terreno está sucio y lleno de chatarra, con un barril rojo encima del
//     montón del fondo. Un disparo al barril lo hace volar todo y deja la tierra limpia.
// scale: tamaño del campo (1 = el normal); el cuadrilátero y sus torres crecen desde su centro,
// y los árboles y las nubes se apartan con él. El barril y la atalaya lejana del desbloqueo
// no se mueven (se desbloquea siempre con el campo de tamaño normal).
export class SniperField {
    constructor(theme, scale = 1) {
        this.theme = theme;
        this.scale = scale;
        const C = FIELD.corners, ccx = C.reduce((s, p) => s + p.x, 0) / C.length, ccz = C.reduce((s, p) => s + p.z, 0) / C.length;
        this.poly = C.map((p) => ({ x: ccx + (p.x - ccx) * scale, z: ccz + (p.z - ccz) * scale }));
        this.cx = ccx;
        this.cz = ccz;
        this.radius = Math.max(...this.poly.map((p) => Math.hypot(p.x - ccx, p.z - ccz)));
        this.root = new THREE.Group();
        this.animated = [];
        this.targets = [];
        this.plants = []; // matas (de tomate, de maíz...), cada una con sus blancos en targets
        this.junk = null;
        this.introT = 0;
        // Torres: un poco por fuera de cada esquina, girada hacia el centro, con su plataforma de
        // la caja sorpresa en la barandilla izquierda (ledge: dónde, en el mundo)
        this.towers = this.poly.map((p) => {
            const dx = p.x - this.cx, dz = p.z - this.cz, d = Math.hypot(dx, dz);
            const t = new Tower(theme.outline, true, true);
            const x = p.x + (dx / d) * FIELD.towerOut, z = p.z + (dz / d) * FIELD.towerOut;
            t.root.position.set(x, 0, z);
            t.root.rotation.y = Math.atan2(this.cx - x, this.cz - z) + Math.PI;
            this.root.add(t.root);
            t.root.updateMatrixWorld(true);
            const L = t.root.localToWorld(new THREE.Vector3(t.ledge.x, t.ledge.y, t.ledge.z));
            return { x, z, floor: 3.2, model: t, ledge: { x: L.x, y: L.y, z: L.z } };
        });
        // La atalaya del desbloqueo: sola y muy lejos, mirando al montón de chatarra
        const F = FIELD.farTower, ft = new Tower(theme.outline, true);
        ft.root.position.set(F.x, 0, F.z);
        ft.root.rotation.y = Math.atan2(FIELD.pile.x - F.x, FIELD.pile.z - F.z) + Math.PI;
        ft.root.visible = false;
        this.root.add(ft.root);
        this.farTower = { x: F.x, z: F.z, floor: 3.2, model: ft };
        // El campo de tiro de pruebas: dianas y su línea de tiro (solo se ven ahí)
        this.rangeT = new RangeTargets(theme.outline);
        this.root.add(this.rangeT.root);
        // Abejas con su gota de miel y girasoles que giran
        this.beeSun = new BeeSun(theme.outline);
        this.root.add(this.beeSun.root);
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
            const a = Math.random() * Math.PI * 2, d = (20 + Math.random() * 16) * this.scale, s = 0.9 + Math.random() * 0.7;
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
            g.position.set(this.cx + Math.sin(a) * (30 + Math.random() * 15) * this.scale, 10 + Math.random() * 6, this.cz + Math.cos(a) * (30 + Math.random() * 15) * this.scale);
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
        // La laguna (si su cultivo la tiene): llena casi todo el campo, con una orilla de arena
        // junto a la valla
        const P = CROPS[kind] && CROPS[kind].pond;
        this.pond = P ? { x: this.cx, z: this.cz, edge: P } : null;
        const inPond = (x, z, m = 0) => this.inPond(x, z, m);
        this.tiles.forEach(({ c, r, soil }, i) => {
            if (!soil) return;
            const col = kind === 'range' ? [0xd8c08a, 0xccb47e, 0xc8ae78][mod(c * 3 + r * 5, 3)] // (el campo de pruebas: arena)
                : kind === 'junk' ? JUNK.ground[mod(c * 7 + r * 5 + mod(c * r, 3), JUNK.ground.length)]
                : inPond(c + 0.5, r + 0.5) ? [0x4aa8e0, 0x3f98d4][(c + r) & 1] // (el agua)
                : inPond(c + 0.5, r + 0.5, 1.3) ? [0xd9c48a, 0xccb67a][(c + r) & 1] // (la orilla)
                : CROPS[kind] && CROPS[kind].mud ? [0x7a5232, 0x6a4628, 0x8a5e38][mod(c * 3 + r * 5, 3)] // (la pocilga, de barro)
                : CROPS[kind] && CROPS[kind].pasture ? [0xa8e070, 0x9ad962, 0xb4e67a][mod(c * 3 + r * 5, 3)] : theme.soil[r & 1];
            this.floor.setColorAt(i, _c.setHex(col).offsetHSL(0, 0, (Math.random() - 0.5) * theme.grassJitter));
        });
        this.floor.instanceColor.needsUpdate = true;
        const T = CROPS.tomato;
        this.stub.forEach((s, i) => {
            const own = CROPS[kind] && CROPS[kind].stub;
            if (inPond(s.x, s.z)) return this.stubMesh.setColorAt(i, _c.setHex(0x6ac0f0)); // (en el agua, brillos)
            const col = kind === 'junk' ? (s.tone < 0.6 ? 0x8a7a4a : 0x6f8a3a) : own ? own[i % own.length] : kind === 'tomato' ? T.leaves[i % 3] : s.tone < 0.7 ? 0xb8a050 : CROPS.wheat.stages[1];
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
        // El campo de pruebas: dianas (sin torres: se tira de pie desde la línea de tiro)
        if (crop === 'range') {
            for (const t of this.towers) t.model.root.visible = false;
            return this.rangeT.spawn(this.rangeMode || 'mix', this.targets);
        }
        if (crop === 'honey' || crop === 'sunflower') return this.beeSun.spawn(crop, count, this);
        if (crop === 'tomato') return this.spawnTomatoes(count);
        if (crop === 'pumpkin') return this.spawnPumpkins(count);
        if (crop === 'corn') return this.spawnCorn(count);
        if (crop === 'milk') return this.spawnCows(count);
        if (crop === 'wool') return this.spawnSheep(count);
        if (crop === 'truffle') return this.spawnPigs(count);
        if (crop === 'fish') return this.spawnFish(count);
        if (crop === 'egg') return this.spawnHens(count);
        for (let i = 0; i < count; i++) {
            const { x, z } = this.freeSpot(this.targets, count > 90 ? 1.2 : 1.6); // (más juntas si hay muchas)
            const stalks = Array.from({ length: CLUMP }, () => {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.38;
                return { ox: Math.sin(a) * r, oz: Math.cos(a) * r, h: 1.2 + Math.random() * 0.45 - r * 0.6, tilt: (Math.random() - 0.5) * 0.25, dir: Math.random() * Math.PI * 2, ph: Math.random() * 6, tone: Math.random() };
            });
            // Brotan en ola (más deprisa cuantas más hay, para no esperar)
            this.targets.push({ x, y: 0.9, z, stalks, alive: true, grow: -0.5 - i * Math.min(0.06, 2.4 / count), landed: false, flash: 0, dying: 0 });
        }
        this.tStalks.count = this.tEars.count = this.targets.length * CLUMP;
    }

    spawnTomatoes(count) {
        let left = count;
        while (left > 0) {
            const n = Math.min(left, 1 + ((Math.random() * 3) | 0));
            const { x, z } = this.freeSpot(this.plants, count > 60 ? 1.8 : 2.2); // (más juntas si hay muchas)
            const plant = {
                x, z, h: 1.7 + Math.random() * 0.3, ph: Math.random() * 6, grow: -0.5 - this.plants.length * Math.min(0.08, 4.8 / count), g: 0.0001, sway: 0,
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
        this.tCalyx.material.color.setHex(T.calyx);
        this.plants.forEach((p, pi) => {
            p.leaves.forEach((l, k) => this.tLeaves.setColorAt(pi * LEAVES + k, _c.setHex(T.leaves[(k + pi) % 3]).offsetHSL(0, 0, (l.tone - 0.5) * 0.08)));
            this.tStems.setColorAt(pi * 2, _c.setHex(T.leaves[2]));
            this.tStems.setColorAt(pi * 2 + 1, _c.setHex(T.stake));
        });
        this.tLeaves.instanceColor.needsUpdate = this.tStems.instanceColor.needsUpdate = true;
    }

    // Matas (sus hojas y tallos) recién creadas: colores de cada bloque
    paintPlants(C, stems) {
        this.tLeaves.count = this.plants.length * LEAVES;
        this.tStems.count = this.plants.length * 2;
        this.tFruit.count = this.tFruitHull.count = this.tCalyx.count = this.targets.length;
        this.plants.forEach((p, pi) => {
            p.leaves.forEach((l, k) => this.tLeaves.setColorAt(pi * LEAVES + k, _c.setHex(C.leaves[(k + pi) % 3]).offsetHSL(0, 0, (l.tone - 0.5) * 0.08)));
            this.tStems.setColorAt(pi * 2, _c.setHex(stems[0]));
            this.tStems.setColorAt(pi * 2 + 1, _c.setHex(stems[1]));
        });
        this.tLeaves.instanceColor.needsUpdate = this.tStems.instanceColor.needsUpdate = true;
        this.tCalyx.material.color.setHex(C.calyx);
    }

    // Calabazas: cada una con su mata de hojas grandes alrededor, en el suelo
    spawnPumpkins(count) {
        const C = CROPS.pumpkin;
        for (let i = 0; i < count; i++) {
            const { x, z } = this.freeSpot(this.plants, 2.6);
            const grow = -0.5 - i * Math.min(0.12, 4 / count);
            const plant = { x, z, h: 0, ph: Math.random() * 6, grow, g: 0.0001, sway: 0, flat: true,
                leaves: Array.from({ length: LEAVES }, (_, k) => ({ a: k * 0.7 + Math.random() * 0.4, y: 0.05 + (k % 3) * 0.04, r: 0.7 + (k % 3) * 0.25, w: 0.55 + Math.random() * 0.2, tone: Math.random() })) };
            this.plants.push(plant);
            const size = 1.0 + Math.random() * 0.3;
            this.targets.push({ plant, kind: 'pumpkin', x, y: size * 0.4, z, size, hp: C.hp, ry: Math.random() * Math.PI, tone: Math.random(), alive: true, grow: grow - 0.15, landed: false, flash: 0, dying: 0 });
        }
        this.paintPlants(C, [C.calyx, C.calyx]);
    }

    // Maíz: matas altas en hileras (todas en la misma dirección, al azar en cada partida), con
    // dos mazorcas cada una a media altura
    spawnCorn(count) {
        const C = CROPS.corn, a = Math.random() * Math.PI, ux = Math.cos(a), uz = Math.sin(a);
        const xs = this.poly.map((p) => p.x), zs = this.poly.map((p) => p.z), R = Math.max(...xs) - Math.min(...xs) + Math.max(...zs) - Math.min(...zs);
        const spots = [];
        for (let i = -R; i <= R; i += 1.9) for (let j = -R; j <= R; j += 1.05) {
            const x = this.cx + ux * j - uz * i, z = this.cz + uz * j + ux * i;
            if (inside(this.poly, x, z) && edgeDist(this.poly, x, z) > FIELD.margin) spots.push({ x, z });
        }
        // Las que caben, repartidas por todo el campo (saltándose algunas)
        const want = Math.min(Math.ceil(count / 2), spots.length);
        for (let i = spots.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [spots[i], spots[j]] = [spots[j], spots[i]];
        }
        let left = count;
        spots.slice(0, want).forEach(({ x, z }, i) => {
            const grow = -0.5 - i * Math.min(0.06, 3 / want), h = 2.4 + Math.random() * 0.5;
            const plant = { x, z, h, ph: Math.random() * 6, grow, g: 0.0001, sway: 0, tall: true,
                leaves: Array.from({ length: LEAVES }, (_, k) => ({ a: k * 2.4 + Math.random() * 0.5, y: 0.3 + (k / LEAVES) * (h - 0.6), r: 0.18, w: 0.7 - (k / LEAVES) * 0.3, tone: Math.random() })) };
            this.plants.push(plant);
            for (let k = 0; k < 2 && left > 0; k++, left--) {
                const ca = Math.random() * Math.PI * 2;
                this.targets.push({ plant, kind: 'corn', x: x + Math.sin(ca) * 0.2, y: 1.15 + k * 0.45 + Math.random() * 0.15, z: z + Math.cos(ca) * 0.2, size: 0.42, ry: ca, tone: Math.random(), alive: true, grow: grow - 0.15 - k * 0.08, landed: false, flash: 0, dying: 0 });
            }
        });
        this.paintPlants(C, [C.stalk, 0xe8d08a]);
    }

    // Vacas: cada una corre por el prado a su ritmo; la ubre se le va hinchando (swell) hasta
    // hacerse gigante, la vaca acaba botando sobre ella y, llena, es el blanco (s.x, s.y, s.z: la
    // ubre; s.ur, s.uh: su tamaño)
    spawnCows(count) {
        if (!this.herd) {
            this.herd = new THREE.Group();
            this.root.add(this.herd);
        }
        const ink = outline(this.theme.outline), [a, b] = CROPS.milk.swell;
        for (let i = 0; i < count; i++) {
            const { x, z } = this.freeSpot(this.targets, 2.4);
            const cow = buildCow(ink);
            this.herd.add(cow.g);
            this.targets.push({ kind: 'cow', cow, x, y: 0.55, z, ur: 0.34, uh: 0.3, cx: x, cz: z, ry: Math.random() * 6, goal: null, speed: 0, pace: 1 + Math.random() * 2.8,
                swell: Math.random() * 0.4, rate: 1 / (a + Math.random() * (b - a)), alive: true, grow: -0.5 - i * 0.12, landed: false, flash: 0, dying: 0 });
        }
    }

    // Un sitio del prado al que ir corriendo (lejos del borde)
    cowGoal() {
        return this.freeSpot([], 0);
    }

    drawCows(dt, time) {
        for (const s of this.targets) {
            const c = s.cow;
            c.g.visible = !s.gone; // (se la ha llevado un ovni)
            if (!s.goal || Math.hypot(s.goal.x - s.cx, s.goal.z - s.cz) < 0.5) {
                s.goal = this.cowGoal();
                // A veces echa a galopar, a veces va al paso
                s.speed = s.pace * (Math.random() < 0.3 ? 1.6 : 1);
            }
            const dx = s.goal.x - s.cx, dz = s.goal.z - s.cz, d = Math.hypot(dx, dz) || 1, v = s.landed ? s.speed : 0;
            s.cx += (dx / d) * v * dt;
            s.cz += (dz / d) * v * dt;
            const want = Math.atan2(dx, dz);
            s.ry += Math.atan2(Math.sin(want - s.ry), Math.cos(want - s.ry)) * Math.min(1, dt * 5);
            if (s.alive && s.landed && s.swell < 1 && (s.swell += dt * s.rate) >= 1) {
                s.swell = 1;
                if (this.onFull) this.onFull(s);
            }
            else if (!s.alive) s.swell = Math.max(0, s.swell - dt * 3); // ordeñada: se vacía
            c.g.position.set(s.cx, 0, s.cz);
            c.g.rotation.y = s.ry;
            c.g.scale.setScalar((s.g || 0.0001) * 1.15);
            animateCow(c, dt, time, v, s.swell);
            if (c.boing && this.onBoing) this.onBoing(s);
            // La ubre, en el mundo (el blanco): crece y sube con la vaca (s.ur, s.uh: su tamaño)
            const sin = Math.sin(s.ry), cos = Math.cos(s.ry), back = -0.18 * 1.15;
            s.x = s.cx + sin * back;
            s.z = s.cz + cos * back;
            s.y = (c.lift + 0.62 - 0.1 * c.us) * 1.15;
            s.ur = Math.max(0.34, 0.19 * c.us * 1.15);
            s.uh = Math.max(0.3, 0.16 * c.us * 1.15);
            if (s.flash > 0) c.udder.scale.multiplyScalar(1 + s.flash * 0.3);
        }
    }

    // Ovejas: corren por todo el prado de un lado a otro, al azar (cada una con su velocidad, y
    // de vez en cuando cambian de rumbo), rebotan contra el borde y entre ellas (como bolas de
    // billar), y el vellón les crece (swell) hasta hacerse una bola gigante: llena, es el blanco
    // (s.x, s.y, s.z: el centro de la bola; s.ur: su radio)
    // Cerdos: en su pocilga de barro, cada uno coge carrerilla (acelera en una dirección) y se
    // tira de barriga a deslizarse por el barro hasta pararse; se levanta, elige otro rumbo y
    // otra vez. Rebotan contra el borde y entre ellos. Hozando, cada poco uno encuentra una trufa
    // (swell) y la lleva en el lomo: es el blanco (s.x, s.y, s.z: la trufa)
    spawnPigs(count) {
        if (!this.herd) {
            this.herd = new THREE.Group();
            this.root.add(this.herd);
        }
        const ink = outline(this.theme.outline), [a, b] = CROPS.truffle.swell;
        for (let i = 0; i < count; i++) {
            const { x, z } = this.freeSpot(this.targets, 2.2), ang = Math.random() * Math.PI * 2;
            const pig = buildPig(ink);
            this.herd.add(pig.g);
            this.targets.push({ kind: 'pig', cow: pig, x, y: 1, z, ur: 0.4, uh: 0.35, cx: x, cz: z, ry: ang, vx: 0, vz: 0, head: ang, mode: 'run', t: Math.random() * 1.2, top: 5 + Math.random() * 2.5, slide: 0, rad: 0.5, splash: 0,
                swell: Math.random() * 0.4, rate: 1 / (a + Math.random() * (b - a)), alive: true, grow: -0.5 - i * 0.12, landed: false, flash: 0, dying: 0 });
        }
    }

    drawPigs(dt, time) {
        const list = this.targets;
        for (const s of list) {
            const c = s.cow;
            c.g.visible = !s.gone; // (se lo ha llevado un ovni)
            if (!s.landed) continue;
            let sp = Math.hypot(s.vx, s.vz);
            if (s.mode === 'run') {
                // Carrerilla: acelera en su rumbo y, al rato, se tira de barriga
                sp = Math.min(s.top, sp + dt * 7);
                s.vx = Math.sin(s.head) * sp;
                s.vz = Math.cos(s.head) * sp;
                if ((s.t -= dt) <= 0) s.mode = 'slide';
            } else {
                // Deslizándose: el barro apenas frena; al pararse, otro rumbo y a correr
                const k = Math.exp(-dt * 0.55);
                s.vx *= k;
                s.vz *= k;
                if (sp < 0.7) {
                    s.mode = 'run';
                    s.t = 0.7 + Math.random() * 0.9;
                    s.top = 5 + Math.random() * 2.5;
                    s.head = Math.atan2(s.vx, s.vz) + (Math.random() - 0.5) * 3;
                }
                if ((s.splash -= dt) <= 0 && sp > 1.5) {
                    s.splash = 0.12;
                    if (this.onSplash) this.onSplash(s);
                }
            }
            s.slide += ((s.mode === 'slide' ? 1 : 0) - s.slide) * Math.min(1, dt * 10);
            s.cx += s.vx * dt;
            s.cz += s.vz * dt;
            // Contra el borde: rebota hacia dentro (y sigue a lo suyo)
            if (!inside(this.poly, s.cx, s.cz) || edgeDist(this.poly, s.cx, s.cz) < FIELD.margin + 0.4) {
                const dx = this.cx - s.cx, dz = this.cz - s.cz, d = Math.hypot(dx, dz) || 1, v = Math.max(1, Math.hypot(s.vx, s.vz));
                s.head = Math.atan2(dx / d, dz / d) + (Math.random() - 0.5) * 1.2;
                s.vx = Math.sin(s.head) * v;
                s.vz = Math.cos(s.head) * v;
                s.cx += s.vx * dt * 2;
                s.cz += s.vz * dt * 2;
            }
            if (s.alive && s.swell < 1 && (s.swell += dt * s.rate) >= 1) {
                s.swell = 1;
                if (this.onFull) this.onFull(s);
            } else if (!s.alive) s.swell = 0; // (su trufa, ya tuya)
        }
        // Entre ellos: si se tocan, se separan y se cambian la velocidad (choque)
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const A = list[i], B = list[j];
            if (!A.landed || !B.landed || A.gone || B.gone) continue;
            const dx = B.cx - A.cx, dz = B.cz - A.cz, d = Math.hypot(dx, dz), min = A.rad + B.rad;
            if (d >= min || d < 1e-4) continue;
            const nx = dx / d, nz = dz / d, push = (min - d) / 2;
            A.cx -= nx * push;
            A.cz -= nz * push;
            B.cx += nx * push;
            B.cz += nz * push;
            const va = A.vx * nx + A.vz * nz, vb = B.vx * nx + B.vz * nz;
            if (va - vb <= 0) continue;
            A.vx += (vb - va) * nx;
            A.vz += (vb - va) * nz;
            B.vx += (va - vb) * nx;
            B.vz += (va - vb) * nz;
            for (const P of [A, B]) P.head = Math.atan2(P.vx, P.vz);
            if (this.onBoing && Math.random() < 0.5) this.onBoing(A);
        }
        for (const s of list) {
            const c = s.cow, v = s.landed ? Math.hypot(s.vx, s.vz) : 0;
            if (v > 0.2) {
                const want = Math.atan2(s.vx, s.vz);
                s.ry += Math.atan2(Math.sin(want - s.ry), Math.cos(want - s.ry)) * Math.min(1, dt * (s.mode === 'slide' ? 3 : 8));
            }
            c.g.position.set(s.cx, 0, s.cz);
            c.g.rotation.y = s.ry;
            c.g.scale.setScalar((s.g || 0.0001) * 1.15);
            animatePig(c, dt, time, v, s.slide, s.alive ? Math.max(0, (s.swell - 0.85) / 0.15) : 0);
            // La trufa del lomo, en el mundo (el blanco)
            s.x = s.cx;
            s.z = s.cz;
            s.y = (c.body.position.y + 0.95) * 1.15;
            if (s.flash > 0) c.truffle.scale.multiplyScalar(1 + s.flash * 0.3);
        }
    }

    spawnSheep(count) {
        if (!this.herd) {
            this.herd = new THREE.Group();
            this.root.add(this.herd);
        }
        const ink = outline(this.theme.outline), [a, b] = CROPS.wool.swell;
        for (let i = 0; i < count; i++) {
            const { x, z } = this.freeSpot(this.targets, count > 20 ? 1.6 : 2.4), ang = Math.random() * Math.PI * 2, sp = 1.6 + Math.random() * 2.2;
            const sheep = buildSheep(ink);
            this.herd.add(sheep.g);
            this.targets.push({ kind: 'sheep', cow: sheep, x, y: 0.7, z, ur: 0.4, uh: 0.4, cx: x, cz: z, ry: ang, vx: Math.sin(ang) * sp, vz: Math.cos(ang) * sp, pace: sp, turn: 1 + Math.random() * 3, rad: 0.5,
                swell: Math.random() * 0.4, rate: 1 / (a + Math.random() * (b - a)), alive: true, grow: -0.5 - i * 0.12, landed: false, flash: 0, dying: 0 });
        }
    }

    drawSheep(dt, time) {
        const list = this.targets;
        for (const s of list) {
            const c = s.cow;
            c.g.visible = !s.gone; // (se la ha llevado un ovni)
            if (!s.landed) continue;
            // De vez en cuando, otro rumbo (y otra prisa); rodando, más deprisa
            if ((s.turn -= dt) <= 0) {
                s.turn = 1.2 + Math.random() * 3;
                const ang = Math.atan2(s.vx, s.vz) + (Math.random() - 0.5) * 2.4, sp = s.pace * (0.7 + Math.random() * 0.8) * (1 + s.swell * 0.5);
                s.vx = Math.sin(ang) * sp;
                s.vz = Math.cos(ang) * sp;
            }
            s.cx += s.vx * dt;
            s.cz += s.vz * dt;
            // Contra el borde del prado: rebota hacia dentro
            if (!inside(this.poly, s.cx, s.cz) || edgeDist(this.poly, s.cx, s.cz) < FIELD.margin + s.rad * 0.6) {
                const dx = this.cx - s.cx, dz = this.cz - s.cz, d = Math.hypot(dx, dz) || 1, sp = Math.hypot(s.vx, s.vz) || s.pace;
                const ang = Math.atan2(dx / d, dz / d) + (Math.random() - 0.5) * 1.2;
                s.vx = Math.sin(ang) * sp;
                s.vz = Math.cos(ang) * sp;
                s.cx += s.vx * dt * 2;
                s.cz += s.vz * dt * 2;
            }
            if (s.alive && s.swell < 1 && (s.swell += dt * s.rate) >= 1) {
                s.swell = 1;
                if (this.onFull) this.onFull(s);
            } else if (!s.alive) s.swell = Math.max(0, s.swell - dt * 2.5); // esquilada: la bola se deshace
        }
        // Entre ellas: si se tocan, se separan y se cambian la velocidad (choque de bolas)
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const A = list[i], B = list[j];
            if (!A.landed || !B.landed || A.gone || B.gone) continue;
            const dx = B.cx - A.cx, dz = B.cz - A.cz, d = Math.hypot(dx, dz), min = A.rad + B.rad;
            if (d >= min || d < 1e-4) continue;
            const nx = dx / d, nz = dz / d, push = (min - d) / 2;
            A.cx -= nx * push;
            A.cz -= nz * push;
            B.cx += nx * push;
            B.cz += nz * push;
            const va = A.vx * nx + A.vz * nz, vb = B.vx * nx + B.vz * nz;
            if (va - vb <= 0) continue; // (ya se separan)
            A.vx += (vb - va) * nx;
            A.vz += (vb - va) * nz;
            B.vx += (va - vb) * nx;
            B.vz += (va - vb) * nz;
            if (this.onBoing && (A.swell > 0.5 || B.swell > 0.5)) this.onBoing(A.swell > B.swell ? A : B);
        }
        for (const s of list) {
            const c = s.cow, sp = Math.hypot(s.vx, s.vz), v = s.landed ? sp : 0;
            const want = Math.atan2(s.vx, s.vz);
            s.ry += Math.atan2(Math.sin(want - s.ry), Math.cos(want - s.ry)) * Math.min(1, dt * 6);
            c.g.position.set(s.cx, 0, s.cz);
            c.g.rotation.y = s.ry;
            c.g.scale.setScalar((s.g || 0.0001) * 1.15);
            animateSheep(c, dt, time, v, s.swell);
            // La bola de lana, en el mundo (el blanco)
            s.rad = Math.max(0.45, c.r * 1.15);
            s.x = s.cx;
            s.z = s.cz;
            s.y = (c.lift + 0.66) * 1.15;
            s.ur = s.uh = Math.max(0.4, c.r * 1.15);
            if (s.flash > 0) c.wool.scale.multiplyScalar(1 + s.flash * 0.25);
        }
    }

    // Gallinas: corretean por el corral (como las vacas, de un sitio a otro) y, cuando se cargan
    // (swell), lanzan el huevo al aire en parábola, como un plato de tiro: el blanco es el huevo
    // en el aire (s.x, s.y, s.z), no ellas. Si cae sin que le den, se casca (onSplat) y la gallina
    // vuelve a cargarse
    spawnHens(count) {
        if (!this.herd) {
            this.herd = new THREE.Group();
            this.root.add(this.herd);
        }
        const ink = outline(this.theme.outline), [a, b] = CROPS.egg.swell;
        if (!this.eggMat) this.eggMat = toon(0xfff6e6);
        for (let i = 0; i < count; i++) {
            const { x, z } = this.freeSpot(this.targets, count > 16 ? 1.6 : 2.2);
            const hen = buildChicken(ink), egg = new THREE.Group();
            egg.add(new THREE.Mesh(box(0.42, 0.54, 0.42), this.eggMat), new THREE.Mesh(box(0.42 + OUTLINE * 2, 0.54 + OUTLINE * 2, 0.42 + OUTLINE * 2), ink));
            egg.visible = false;
            this.herd.add(hen.g, egg);
            this.targets.push({ kind: 'hen', cow: hen, eggMesh: egg, egg: null, x, y: 0.5, z, cx: x, cz: z, ry: Math.random() * 6, goal: null, speed: 0, pace: 1.2 + Math.random() * 2,
                swell: Math.random() * 0.5, rate: 1 / (a + Math.random() * (b - a)), alive: true, grow: -0.5 - i * 0.1, landed: false, flash: 0, dying: 0 });
        }
    }

    // ¿Cae en el agua de la laguna (m: con m de orilla)? Sigue la forma del campo, a pond.edge de
    // la valla (con la orilla algo ondulada)
    inPond(x, z, m = 0) {
        return !!this.pond && inside(this.poly, x, z) && edgeDist(this.poly, x, z) + Math.sin(x * 1.3 + z * 0.7) * 0.35 > this.pond.edge - m;
    }

    // Un sitio de la laguna (lejos de la orilla)
    pondSpot(margin = 1.2) {
        const xs = this.poly.map((p) => p.x), zs = this.poly.map((p) => p.z);
        for (let k = 0; k < 60; k++) {
            const x = Math.min(...xs) + Math.random() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + Math.random() * (Math.max(...zs) - Math.min(...zs));
            if (this.inPond(x, z, -margin)) return { x, z };
        }
        return { x: this.cx, z: this.cz };
    }

    // Peces: en la laguna del centro; cada uno espera bajo el agua (swell) y salta fuera en arco
    // (con su salpicón al salir y al volver a entrar), de su tamaño: los pequeños altos y deprisa,
    // los grandes bajos y despacio. En el aire es el blanco; si no, vuelve al agua y salta más tarde
    spawnFish(count) {
        if (!this.herd) {
            this.herd = new THREE.Group();
            this.root.add(this.herd);
        }
        const ink = outline(this.theme.outline), [a, b] = CROPS.fish.swell;
        for (let i = 0; i < count; i++) {
            const size = Math.random() < 0.45 ? 's' : Math.random() < 0.65 ? 'm' : 'l';
            const fish = buildFish(ink, size), at = this.pondSpot(2);
            fish.g.visible = false;
            this.herd.add(fish.g);
            this.targets.push({ kind: 'fish', cow: fish, size, ur: { s: 0.34, m: 0.48, l: 0.7 }[size], jump: null, x: at.x, y: -1, z: at.z, cx: at.x, cz: at.z,
                swell: Math.random() * 0.6, rate: 1 / (a + Math.random() * (b - a)), alive: true, grow: -0.5 - i * 0.05, landed: false, flash: 0, dying: 0 });
        }
    }

    // Salta el pez s: desde un sitio de la laguna, hacia arriba y de lado (sin salirse de ella)
    leap(s) {
        const J = CROPS.fish.jump[s.size], r = (a) => a[0] + Math.random() * (a[1] - a[0]), P = this.pond;
        const { x, z } = this.pondSpot(2);
        s.cx = x; // (su sitio en la laguna: ahí va a por él un alienígena)
        s.cz = z;
        // (de lado, hacia dentro de la laguna)
        const ang = Math.atan2(P.x - x, P.z - z) + (Math.random() - 0.5) * 2, side = r(J.side);
        s.jump = { x, y: 0, z, vx: Math.sin(ang) * side, vy: r(J.up), vz: Math.cos(ang) * side };
        s.swell = 0;
        if (this.onFishSplash) this.onFishSplash(x, z, s.size);
    }

    drawFish(dt, time) {
        const grav = this.fishGrav ?? CROPS.fish.jump.grav; // (fishGrav: las pruebas lo paran en el aire)
        for (const s of this.targets) {
            const c = s.cow, J = s.jump;
            if (s.alive && s.landed && !J && !s.gone && (s.swell += dt * s.rate) >= 1) this.leap(s);
            if (J) {
                J.vy -= grav * dt;
                J.x += J.vx * dt;
                J.y += J.vy * dt;
                J.z += J.vz * dt;
                // De vuelta al agua: su salpicón y a esperar
                if (J.y <= 0 && J.vy < 0) {
                    s.jump = null;
                    if (this.onFishSplash) this.onFishSplash(J.x, J.z, s.size);
                }
            }
            const show = !!s.jump && (s.alive || s.dying > 0);
            c.g.visible = show;
            if (show) {
                const j = s.jump, h = Math.hypot(j.vx, j.vz);
                c.g.position.set(j.x, j.y, j.z);
                // (mirando hacia donde va: sube de morro y cae de morro)
                c.g.rotation.set(-Math.atan2(j.vy, h), Math.atan2(j.vx, j.vz), 0, 'YXZ');
                c.g.scale.setScalar({ s: 0.55, m: 0.85, l: 1.3 }[s.size] * 1.3 * (1 + s.flash * 0.3));
                animateFish(c, dt, 1);
                s.x = j.x;
                s.y = j.y;
                s.z = j.z;
            } else {
                s.x = s.cx; // (bajo el agua, en su sitio)
                s.z = s.cz;
                s.y = -1;
            }
            if (!s.alive && s.dying <= 0) s.jump = null;
        }
    }

    // Lanza el huevo de la gallina s (hacia arriba y un poco de lado, alejándose del borde)
    toss(s) {
        const T = CROPS.egg.toss, r = (a) => a[0] + Math.random() * (a[1] - a[0]);
        let ang = Math.random() * Math.PI * 2;
        if (edgeDist(this.poly, s.cx, s.cz) < 4) ang = Math.atan2(this.cx - s.cx, this.cz - s.cz) + (Math.random() - 0.5);
        const side = r(T.side);
        s.egg = { x: s.cx, y: 0.6, z: s.cz, vx: Math.sin(ang) * side, vy: r(T.up), vz: Math.cos(ang) * side, spin: (Math.random() - 0.5) * 14 };
        s.swell = 0;
        s.cow.flap = 0.5;
        if (this.onToss) this.onToss(s);
    }

    drawHens(dt, time) {
        const grav = this.eggGrav ?? CROPS.egg.toss.grav; // (eggGrav: las pruebas lo paran en el aire)
        for (const s of this.targets) {
            const c = s.cow, E = s.eggMesh;
            c.g.visible = !s.gone;
            if (!s.goal || Math.hypot(s.goal.x - s.cx, s.goal.z - s.cz) < 0.4) {
                s.goal = this.cowGoal();
                s.speed = s.pace * (Math.random() < 0.35 ? 1.7 : Math.random() < 0.3 ? 0 : 1); // (a veces se para a picotear)
                s.wait = s.speed ? 0 : 0.8 + Math.random() * 1.5;
            }
            let v = s.landed ? s.speed : 0;
            if (s.wait > 0) {
                s.wait -= dt;
                v = 0;
                if (s.wait <= 0) s.speed = s.pace;
            }
            const dx = s.goal.x - s.cx, dz = s.goal.z - s.cz, d = Math.hypot(dx, dz) || 1;
            s.cx += (dx / d) * v * dt;
            s.cz += (dz / d) * v * dt;
            const want = Math.atan2(dx, dz);
            s.ry += Math.atan2(Math.sin(want - s.ry), Math.cos(want - s.ry)) * Math.min(1, dt * 7);
            if (s.alive && s.landed && !s.egg && !s.gone && (s.swell += dt * s.rate) >= 1) this.toss(s);
            // El huevo en el aire: parábola girando; al tocar el suelo, se casca
            const e = s.egg;
            if (e) {
                if (!s.alive) s.egg = null;
                else {
                    e.vy -= grav * dt;
                    e.x += e.vx * dt;
                    e.y += e.vy * dt;
                    e.z += e.vz * dt;
                    if (e.y <= 0.15) {
                        s.egg = null;
                        if (this.onSplat) this.onSplat(s, e.x, e.z);
                    }
                }
            }
            E.visible = !!s.egg;
            if (s.egg) {
                E.position.set(s.egg.x, s.egg.y, s.egg.z);
                E.rotation.set(time * s.egg.spin, 0, time * s.egg.spin * 0.6);
                E.scale.setScalar(1 + s.flash * 0.3);
                s.x = s.egg.x;
                s.y = s.egg.y;
                s.z = s.egg.z;
            } else {
                s.x = s.cx;
                s.y = 0.5;
                s.z = s.cz;
            }
            c.g.position.set(s.cx, 0, s.cz);
            c.g.rotation.y = s.ry;
            c.g.scale.setScalar((s.g || 0.0001) * 1.3);
            animateChicken(c, dt, time, v, s.egg ? 0 : s.swell);
        }
    }

    // ¿Se le puede dar? (las vacas, solo con la ubre llena; las ovejas, con la bola de lana hecha)
    hittable(s) {
        if (s.range) return this.rangeT.hittable(s);
        if (s.bee || s.sun) return this.beeSun.hittable(s, this.eye);
        return s.alive && s.landed && (s.kind === 'hen' ? !!s.egg : s.kind === 'fish' ? !!s.jump && s.jump.y > 0.25 : (s.kind !== 'cow' && s.kind !== 'sheep' && s.kind !== 'pig') || s.swell >= 1);
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
        if (this.herd) for (const c of [...this.herd.children]) this.herd.remove(c);
        this.targets.length = 0;
        this.plants.length = 0;
        if (this.rangeT) this.rangeT.hide();
        if (this.beeSun) this.beeSun.clear();
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
            if (!this.hittable(s)) continue;
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
        this.eye = eye; // (los girasoles: ¿miran al tirador?)
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
        if (this.crop === 'milk') this.drawCows(dt, time);
        else if (this.crop === 'wool') this.drawSheep(dt, time);
        else if (this.crop === 'truffle') this.drawPigs(dt, time);
        else if (this.crop === 'fish') this.drawFish(dt, time);
        else if (this.crop === 'egg') this.drawHens(dt, time);
        else if (this.crop === 'range') this.rangeT.update(dt, time);
        else if (this.crop === 'honey' || this.crop === 'sunflower') this.beeSun.update(dt, time);
        else if (this.crop === 'wheat') this.drawWheat(time);
        else if (this.crop === 'tomato') this.drawTomatoes(dt, time);
        else if (this.crop) this.drawPlants(dt, time);
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
            const pop = !s.alive ? 1 + Math.max(0, 0.14 - s.dying) * 2.5 : 1;
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
            const pop = !s.alive ? 1 + Math.max(0, 0.14 - s.dying) * 3 : 1;
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

    // Calabazas y maíz: sus matas (hojas y tallos) y sus blancos
    drawPlants(dt, time) {
        const C = CROPS[this.crop];
        this.plants.forEach((p, pi) => {
            p.grow += dt;
            const k = Math.min(1, Math.max(0, p.grow / 0.5));
            p.g = k <= 0 ? 0.0001 : easeOutBack(k);
            p.sway = Math.sin(time * 1.4 - p.x * 0.4 + p.ph) * (p.tall ? 0.05 : 0.03);
            const h = p.h * p.g;
            p.leaves.forEach((l, k2) => {
                if (p.tall) {
                    // Hojas largas que salen de la caña hacia fuera y cuelgan
                    const y = l.y * p.g;
                    _d.position.set(p.x + Math.sin(l.a) * 0.3 + p.sway * y, y, p.z + Math.cos(l.a) * 0.3);
                    _d.rotation.set(Math.cos(l.a) * 0.9, 0, -Math.sin(l.a) * 0.9 + p.sway);
                    _d.scale.set(0.16 * p.g, l.w * p.g, 0.06);
                } else if (p.flat) {
                    // Hojas anchas tumbadas alrededor de la calabaza
                    _d.position.set(p.x + Math.sin(l.a) * l.r * p.g, l.y, p.z + Math.cos(l.a) * l.r * p.g);
                    _d.rotation.set(p.sway, l.a, 0);
                    _d.scale.set(l.w * p.g, 0.06, l.w * 0.8 * p.g);
                }
                _d.updateMatrix();
                this.tLeaves.setMatrixAt(pi * LEAVES + k2, _d.matrix);
            });
            // Caña y penacho de arriba (maíz); nada en las demás
            _d.position.set(p.x + p.sway * h * 0.5, h / 2, p.z);
            _d.rotation.set(0, 0, p.sway);
            _d.scale.set(p.tall ? 0.14 : 0.0001, Math.max(0.0001, h), p.tall ? 0.14 : 0.0001);
            _d.updateMatrix();
            this.tStems.setMatrixAt(pi * 2, _d.matrix);
            _d.position.set(p.x + p.sway * h, h + 0.15, p.z);
            _d.scale.set(p.tall ? 0.2 : 0.0001, p.tall ? 0.35 * p.g : 0.0001, p.tall ? 0.2 : 0.0001);
            _d.updateMatrix();
            this.tStems.setMatrixAt(pi * 2 + 1, _d.matrix);
        });
        this.targets.forEach((s, i) => {
            const gone = !s.alive && s.dying <= 0;
            const pop = !s.alive ? 1 + Math.max(0, 0.14 - s.dying) * 3 : 1;
            const e = gone ? 0.0001 : (s.g || 0.0001) * pop;
            let w = s.size, hh = s.size, d = s.size, x = s.x, y = s.y, z = s.z;
            if (s.kind === 'pumpkin') {
                // Achatada y ancha; con cada tiro se encoge un poco y se oscurece (resquebrajada)
                const hurt = 1 - (C.hp - s.hp) * 0.08;
                w = d = s.size * 1.25 * hurt;
                hh = s.size * 0.8 * hurt;
                y = hh / 2;
            } else if (s.kind === 'corn') {
                const sw = s.plant.sway * s.y;
                x += sw;
                w = d = s.size * 0.5;
                hh = s.size * 1.15;
            }
            _d.position.set(x, y, z);
            _d.rotation.set(0, s.ry, s.kind === 'corn' ? 0.15 : 0);
            _d.scale.set(w * e, hh * e, d * e);
            _d.updateMatrix();
            this.tFruit.setMatrixAt(i, _d.matrix);
            _d.scale.set(gone ? 0.0001 : w * e + OUTLINE * 2, gone ? 0.0001 : hh * e + OUTLINE * 2, gone ? 0.0001 : d * e + OUTLINE * 2);
            _d.updateMatrix();
            this.tFruitHull.setMatrixAt(i, _d.matrix);
            const dark = s.kind === 'pumpkin' ? (C.hp - s.hp) * 0.08 : 0;
            _c.setHex(s.tone < 0.5 ? C.fruit : C.fruitDark).offsetHSL(0, 0, -dark).lerp(_w, s.flash);
            this.tFruit.setColorAt(i, _c);
            // Rabito (calabaza) o farfolla (maíz)
            _d.position.set(x, s.kind === 'corn' ? y - hh * 0.35 * e : y + hh * 0.5 * e, z);
            _d.scale.set(w * (s.kind === 'pumpkin' ? 0.18 : 0.75) * e, (s.kind === 'pumpkin' ? 0.22 : 0.12) * e, d * (s.kind === 'pumpkin' ? 0.18 : 0.75) * e);
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

    // Al cambiar de tamaño se monta otro campo: este se libera (las geometrías de caja son
    // compartidas y se quedan)
    dispose() {
        this.clearSheaves();
        const mats = new Set();
        this.root.traverse((o) => {
            if (o.isInstancedMesh) o.dispose();
            if (o.material) mats.add(o.material);
        });
        for (const m of mats) m.dispose();
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
    if (s.hb) return [s.x - s.hb[0], s.y - s.hb[1], s.z - s.hb[2], s.x + s.hb[0], s.y + s.hb[1], s.z + s.hb[2]]; // (las dianas del campo de pruebas)
    if (s.kind === 'hen') return [s.x - 0.42, s.y - 0.48, s.z - 0.42, s.x + 0.42, s.y + 0.48, s.z + 0.42]; // (el huevo, algo más grande que él)
    if (s.kind === 'fish') return [s.x - s.ur, s.y - s.ur * 0.8, s.z - s.ur, s.x + s.ur, s.y + s.ur * 0.8, s.z + s.ur]; // (el pez, según su tamaño)
    if (s.kind === 'cow' || s.kind === 'sheep' || s.kind === 'pig') return [s.x - s.ur, s.y - s.uh, s.z - s.ur, s.x + s.ur, s.y + s.uh, s.z + s.ur]; // (la ubre, la bola de lana o la trufa)
    if (!s.plant) return [s.x - 0.36, 0, s.z - 0.36, s.x + 0.36, 1.55, s.z + 0.36];
    if (s.kind === 'pumpkin') {
        const r = s.size * 0.66;
        return [s.x - r, 0, s.z - r, s.x + r, s.size * 0.85, s.z + r];
    }
    if (s.kind === 'corn') return [s.x - 0.2, s.y - 0.3, s.z - 0.2, s.x + 0.2, s.y + 0.3, s.z + 0.2];
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
