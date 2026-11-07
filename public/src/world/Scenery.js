import * as THREE from 'three';
import { box, toon } from '../render/materials.js';
import { PLACES, ROADS, gateWorld, inParcelShape } from '../content/farm.js';
import { RIVER, OUT, waterDist, groundRaw, quant } from './terrain.js';

// El mundo alrededor de las parcelas (todo en coordenadas del mundo, world: true):
//  - cada parcela sobre su base: una loma de tierra a su altura, de borde irregular (no se ve el
//    cuadrado), con un talud escalonado si está alta y un seto por el borde (con hueco en sus puertas)
//  - caminos de tierra curvos entre las puertas, que suben y bajan a saltitos, con puentes de
//    madera donde cruzan el agua, farolas que se encienden de noche y postes con su señal
//  - un río que baja de las montañas por el valle, entre las parcelas, hasta un lago
//  - colinas escalonadas, una cordillera con nieve al fondo y bosque por los huecos
// blocked(x, z): si ahí no cabe un árbol (agua, parcela, camino, colina o montaña)

const HILLS = []; // (las colinas ya son el relieve: world/terrain.js)
const PEAKS = [
    [-140, -70, 56, 34], [-110, -126, 64, 42], [-60, -150, 60, 38], [-6, -156, 54, 32], [50, -150, 50, 28],
    [-164, -10, 46, 26], [-160, -120, 44, 30], [104, -136, 44, 24], [-176, 46, 40, 20], [-100, -180, 50, 30],
];
// ¿Agua? (río, lago o el río que sale del lago); m: margen
const wet = (x, z, m = 0) => waterDist(x, z) < m + (m ? 0 : 0.0001);
const inPlace = (x, z, m = 0) => PLACES.some((P) => x >= P.at[0] - m && x < P.at[0] + 30 + m && z >= P.at[1] - m && z < P.at[1] + 30 + m);

const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
// La altura del terreno: la natural, que se funde con la de cada parcela al acercarse a ella
// (así una parcela en una colina queda arriba sin escalón raro) y llana junto al agua
export function terrainH(x, z) {
    let h = groundRaw(x, z);
    for (const P of PLACES) {
        const r = rimOf(P, x, z);
        if (r.inside || r.out <= r.reach) return P.h;
        const w = 1 - smooth(r.reach, r.reach + 12, r.out);
        if (w > 0) h += (P.h - h) * w;
    }
    return quant(Math.max(0, h) * smooth(0, 4, waterDist(x, z)));
}

// La rejilla del suelo: bloques de 4×4 casillas (alineados con las parcelas, que empiezan en
// casillas pares) y, cerca de una parcela, partidos en 2×2. Sin solapes: cada punto, una celda.
const GX0 = -116, GZ0 = -112, GNX = 63, GNZ = 61;
const nearPlace = (x, z) => PLACES.some((P) => x > P.at[0] - 14 && x < P.at[0] + 44 && z > P.at[1] - 14 && z < P.at[1] + 44);
// ¿Esta celda de 2×2 queda entera bajo el suelo de una parcela? (entonces no hace falta)
const underFloor = (x, z) => PLACES.some((P) => x >= P.at[0] && x < P.at[0] + 30 && z >= P.at[1] && z < P.at[1] + 30
    && [[0.5, 0.5], [1.5, 0.5], [0.5, 1.5], [1.5, 1.5]].every(([a, b]) => inParcelShape(P, x - P.at[0] + a, z - P.at[1] + b)));
const inSquare = (x, z) => PLACES.find((P) => x >= P.at[0] && x < P.at[0] + 30 && z >= P.at[1] && z < P.at[1] + 30);
let cellMap = null;
function groundCells() {
    if (cellMap) return cellMap.list;
    const list = [], map = new Map();
    for (let j = 0; j < GNZ; j++) for (let i = 0; i < GNX; i++) {
        const x0 = GX0 + i * 4, z0 = GZ0 + j * 4;
        if (nearPlace(x0 + 2, z0 + 2)) {
            for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
                const x = x0 + a, z = z0 + b, P = inSquare(x + 1, z + 1);
                if (P && underFloor(x, z)) continue;
                const c = { x: x + 1, z: z + 1, s: 2, h: P ? P.h : terrainH(x + 1, z + 1), inSq: !!P };
                list.push(c);
                map.set(`${x >> 1},${z >> 1}`, c);
            }
        } else {
            const c = { x: x0 + 2, z: z0 + 2, s: 4, h: terrainH(x0 + 2, z0 + 2), inSq: false };
            list.push(c);
            for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2]]) map.set(`${(x0 + a) >> 1},${(z0 + b) >> 1}`, c);
        }
    }
    cellMap = { list, map };
    return list;
}
// La altura del suelo en un punto (la de su celda; bajo una parcela, la de la parcela)
export function cellH(x, z) {
    groundCells();
    const c = cellMap.map.get(`${Math.floor(x) >> 1},${Math.floor(z) >> 1}`);
    if (c) return Math.max(0, c.h);
    const P = inSquare(x, z);
    return P ? P.h : 0;
}

// Los caminos: cada uno, una curva desde una puerta hasta la otra; las casillas que pisa, con su
// altura (de la de una parcela a la de la otra, a saltitos)
const roadCells = new Map(); // "x,z" -> { x, z, y, bridge }
const roadCurves = [];
function buildRoads() {
    for (const R of ROADS) {
        const A = gateWorld(...R[0]);
        const B = R[1] === 'soon' ? { x: R[2][0], z: R[2][1], y: A.y, ox: 0, oz: 0, soon: true } : gateWorld(...R[1]);
        const len = Math.hypot(B.x - A.x, B.z - A.z);
        const p0 = [A.x, A.z], p1 = [A.x + A.ox * len * 0.25, A.z + A.oz * len * 0.25];
        const p2 = [B.x + B.ox * len * 0.25, B.z + B.oz * len * 0.25], p3 = [B.x, B.z];
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.4 / len) {
            const u = 1 - t, x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
            const z = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
            // Sube y baja con el terreno (junto a las puertas, a la altura de su parcela)
            pts.push({ x, z, y: t < 0.04 ? A.y : t > 0.96 ? B.y : terrainH(x, z) });
        }
        roadCurves.push({ A, B, pts, soon: !!B.soon });
        for (const p of pts) {
            for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
                const cx = Math.floor(p.x) + dx, cz = Math.floor(p.z) + dz;
                if (Math.hypot(cx + 0.5 - p.x, cz + 0.5 - p.z) > 1.35 || inPlace(cx + 0.5, cz + 0.5)) continue;
                const key = `${cx},${cz}`;
                if (!roadCells.has(key)) roadCells.set(key, { x: cx + 0.5, z: cz + 0.5, y: p.y, bridge: wet(cx + 0.5, cz + 0.5, 0.6) });
            }
        }
    }
}
buildRoads();
const onRoad = (x, z, m = 2) => {
    for (let dz = -m; dz <= m; dz++) for (let dx = -m; dx <= m; dx++) if (roadCells.has(`${Math.floor(x) + dx},${Math.floor(z) + dz}`)) return true;
    return false;
};

export function blocked(x, z) {
    if (wet(x, z, 2) || inPlace(x, z, 5) || onRoad(x, z, 2)) return true;
    if (HILLS.some(([hx, hz, R]) => Math.hypot(x - hx, z - hz) < R + 1)) return true;
    return PEAKS.some(([px, pz, W]) => Math.hypot(x - px, z - pz) < W * 0.55);
}

// El borde irregular de cada parcela: cuánto sobresale la base del cuadrado (de 2 a 4 casillas)
function rimOf(P, x, z) {
    const lx = x - P.at[0], lz = z - P.at[1];
    const ox = Math.max(-lx, lx - 30, 0), oz = Math.max(-lz, lz - 30, 0);
    const a = Math.atan2(lz - 15, lx - 15), seed = P.at[0] * 0.37 + P.at[1] * 0.11;
    const reach = 3 + Math.sin(a * 5 + seed) * 1.1 + Math.sin(a * 11 + seed * 3) * 0.6;
    return { out: Math.hypot(ox, oz), reach, inside: lx >= 0 && lx < 30 && lz >= 0 && lz < 30 };
}

export function buildScenery(farm) {
    const W = (list) => list.map((p) => ({ ...p, world: true }));
    const theme = farm.theme;
    const colored = (list, delay, hull = true) => {
        const m = hull ? farm.addHulled(0xffffff, W(list), delay) : farm.addAnimated(new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), Math.max(1, list.length)), W(list), delay).mesh;
        list.forEach((p, i) => m.setColorAt(i, new THREE.Color(p.c)));
        return m;
    };
    const earth = [], hedge = [];
    // ---------- El seto de cada parcela (por su borde, con hueco en las puertas) ----------
    for (const P of PLACES) {
        const gates = P.gates.map((_, i) => gateWorld(P.id, i));
        for (let z = P.at[1] - 8; z < P.at[1] + 38; z += 2) for (let x = P.at[0] - 8; x < P.at[0] + 38; x += 2) {
            const cx = x + 1, cz = z + 1, r = rimOf(P, cx, cz);
            if (r.inside || r.out > r.reach + 0.5 || r.out <= r.reach - 1 || (x + z) % 2 !== 0) continue;
            if (onRoad(cx, cz, 1) || gates.some((g) => Math.hypot(g.x - cx, g.z - cz) < 4.5)) continue;
            hedge.push({ x: cx, y: cellH(cx, cz) + 0.35, z: cz, sx: 0.95, sy: 0.7, sz: 0.95, ry: ((x * 7 + z) % 3) * 0.2 });
        }
        // Bajo las parcelas altas, la tierra (un poco por dentro: sus caras no chocan con las del suelo)
        if (P.h > 0.1) earth.push({ x: P.at[0] + 15, y: (P.h - 0.6) / 2, z: P.at[1] + 15, sx: 29.8, sy: P.h + 0.01, sz: 29.8, c: 0x7a4f2a });
    }
    // ---------- Caminos (con terraplén donde van altos) y puentes ----------
    const road = [], deck = [], rails = [];
    for (const c of roadCells.values()) {
        if (c.bridge) {
            const y = Math.max(c.y, 0.25);
            deck.push({ x: c.x, y: y + 0.05, z: c.z, sx: 1, sy: 0.2, sz: 1 });
            // Barandilla en los lados que no siguen siendo camino
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                if (!roadCells.has(`${Math.floor(c.x) + dx},${Math.floor(c.z) + dz}`)) rails.push({ x: c.x + dx * 0.45, y: y + 0.45, z: c.z + dz * 0.45, sx: dx ? 0.12 : 1, sy: 0.5, sz: dz ? 0.12 : 1 });
            }
            continue;
        }
        road.push({ x: c.x, y: cellH(c.x, c.z) - 0.09, z: c.z, sx: 1, sy: 0.3, sz: 1, c: theme.path[(Math.floor(c.x) + Math.floor(c.z)) & 1] });
    }
    colored(earth, 0.5, false);
    colored(road, 0.6, false);
    const hm = farm.addHulled(0xffffff, W(hedge), 0.7);
    hedge.forEach((_, i) => hm.setColorAt(i, new THREE.Color(theme.leaves[i % 3])));
    farm.addHulled(0x9a6a3a, W(deck), 0.7);
    farm.addHulled(0x7a4f2a, W(rails), 0.75);

    // ---------- Agua: río, lago y su salida (dos tonos y orilla de arena) ----------
    const water = [], bank = [];
    for (let z = -120; z < 140; z += 2) for (let x = -70; x < 160; x += 2) {
        const cx = x + 1, cz = z + 1;
        if (inPlace(cx, cz, 3) || roadCells.has(`${x},${z}`) || roadCells.has(`${x + 1},${z + 1}`)) continue;
        if (wet(cx, cz, 0.4)) water.push({ x: cx, y: -0.27, z: cz, sx: 2, sy: 0.08, sz: 2, c: (Math.floor(cx * 0.25) + Math.floor(cz * 0.25)) & 1 ? 0x4aa8e0 : 0x3f98d4 });
        else if (wet(cx, cz, 2)) bank.push({ x: cx, y: -0.27, z: cz, sx: 2, sy: 0.06, sz: 2, c: 0xd9c48a });
    }
    colored(water, 0.6, false);
    colored(bank, 0.6, false);
    farm.riverGlints = [];
    const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let k = 0; k < 40; k++) {
        const m = new THREE.Mesh(box(0.5, 0.04, 0.16), gm);
        m.userData.t = Math.random();
        farm.root.add(m);
        farm.riverGlints.push(m);
    }

    // ---------- Farolas (cada tanto, a un lado del camino) y postes con señal ----------
    farm.lampMat = new THREE.MeshBasicMaterial({ color: 0x8a7a5a });
    const posts = [], heads = [], signs = [], boards = [];
    for (const R of roadCurves) {
        let acc = 0;
        for (let i = 1; i < R.pts.length; i++) {
            const a = R.pts[i - 1], b = R.pts[i], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
            acc += L;
            if (acc < 10) continue;
            acc = 0;
            const s = i % 2 ? 1 : -1, x = b.x - (dz / L) * 2 * s, z = b.z + (dx / L) * 2 * s;
            if (wet(x, z, 0.5) || inPlace(x, z, 1)) continue;
            const g = cellH(x, z);
            posts.push({ x, y: g + 1.1, z, sx: 0.14, sy: 2.2, sz: 0.14 });
            heads.push({ x, y: g + 2.35, z, sx: 0.36, sy: 0.36, sz: 0.36 });
        }
        // La señal a la salida (con la tabla hacia el camino) y, en los ramales PRONTO, la barrera
        const s0 = R.pts[Math.min(8, R.pts.length - 1)], s1 = R.pts[Math.min(11, R.pts.length - 1)];
        const ang = Math.atan2(s1.x - s0.x, s1.z - s0.z), nx = Math.cos(ang) * 1.8, nz = -Math.sin(ang) * 1.8;
        const sg = cellH(s0.x + nx, s0.z + nz);
        signs.push({ x: s0.x + nx, y: sg + 0.8, z: s0.z + nz, sx: 0.14, sy: 1.6, sz: 0.14 });
        boards.push({ x: s0.x + nx + Math.sin(ang) * 0.35, y: sg + 1.4, z: s0.z + nz + Math.cos(ang) * 0.35, sx: 0.1, sy: 0.4, sz: 1.1, ry: ang, c: R.soon ? 0xd8d0c8 : 0xf3ead2 });
        if (R.soon) {
            const e0 = R.pts[Math.max(0, R.pts.length - 4)], e = { x: e0.x, z: e0.z, y: cellH(e0.x, e0.z) };
            for (const k of [-1.4, 1.4]) signs.push({ x: e.x + Math.cos(ang) * k, y: e.y + 0.45, z: e.z - Math.sin(ang) * k, sx: 0.16, sy: 0.9, sz: 0.16 });
            boards.push({ x: e.x, y: e.y + 0.75, z: e.z, sx: 3, sy: 0.22, sz: 0.14, ry: ang + Math.PI / 2, c: 0xc8402e });
            boards.push({ x: e.x, y: e.y + 0.75, z: e.z, sx: 1, sy: 0.24, sz: 0.16, ry: ang + Math.PI / 2, c: 0xfff3d6 });
        }
    }
    farm.addHulled(0x4a4a52, W(posts), 0.8);
    farm.addAnimated(new THREE.InstancedMesh(box(1, 1, 1), farm.lampMat, Math.max(1, heads.length)), W(heads), 0.8);
    farm.addHulled(0x7a4f2a, W(signs), 0.8);
    colored(boards, 0.85);

    // ---------- El suelo de fuera (y los recortes de las parcelas): la rejilla única ----------
    // Cada celda, una columna: hierba arriba y, si algún vecino está más bajo, la tierra del escalón
    const land = [], soil = [];
    const GR = [0x7fc84e, 0x86cc52, 0x8fd45a, 0x98d862, 0xa2dc6a, 0xaede76];
    for (const c of groundCells()) {
        if (c.h < 0.3) continue;
        const top = c.h - (c.inSq ? 0.1 : 0); // (dentro del cuadrado, bajo el suelo de la parcela)
        land.push({ x: c.x, y: top - 0.2, z: c.z, sx: c.s, sy: 0.4, sz: c.s, c: GR[Math.min(GR.length - 1, Math.round(c.h / 1.5))] });
        const e = c.s / 2 + 1;
        const lower = [[e, 0], [-e, 0], [0, e], [0, -e]].some(([dx, dz]) => cellH(c.x + dx, c.z + dz) < c.h - 0.01);
        if (lower) soil.push({ x: c.x, y: (top - 0.4 - 0.45) / 2, z: c.z, sx: c.s, sy: top - 0.4 + 0.45, sz: c.s, c: (Math.floor(c.x) + Math.floor(c.z)) % 3 ? 0x8a5a34 : 0x7a4f2a });
    }
    colored(land, 0.4, false);
    colored(soil, 0.4, false);
    // ---------- La cordillera: pirámides escalonadas de roca, nevadas arriba ----------
    const rock = [];
    for (const [px, pz, Wd, H] of PEAKS) {
        const steps = 7, h = H / steps;
        for (let k = 0; k < steps; k++) {
            const w = Wd * (1 - k / steps);
            rock.push({ x: px + Math.sin(k * 1.7) * 1.5, y: k * h + h / 2, z: pz + Math.cos(k * 1.3) * 1.5, sx: w, sy: h, sz: w * 0.85, ry: 0.15 * k, c: k >= steps - 2 ? 0xf4f6fa : k % 2 ? 0x8a8a96 : 0x7a7a88 });
        }
    }
    colored(rock, 1);

    // ---------- Bosque por los huecos: más tupido en manchas (y a la orilla del agua) ----------
    const spots = [];
    const clump = (x, z) => Math.sin(x * 0.11 + 1.3) + Math.sin(z * 0.13 - 0.7) + Math.sin((x + z) * 0.07 + 2.1);
    for (let tries = 0; spots.length < 380 && tries < 30000; tries++) {
        const x = -120 + Math.random() * 260, z = -120 + Math.random() * 250;
        if (blocked(x, z)) continue;
        const near = wet(x, z, 5) ? 1.2 : 0;
        if (clump(x, z) + near < 0.9 && Math.random() > 0.08) continue;
        if (spots.some(([a, b]) => Math.abs(a - x) < 1.7 && Math.abs(b - z) < 1.7)) continue;
        spots.push([x, z, cellH(x, z)]);
    }
    return spots;
}

// Los destellos bajan con el río; las farolas se encienden de noche
export function updateScenery(farm, dt) {
    if (farm.lampMat) farm.lampMat.color.setHex((farm.nightK || 0) > 0.35 ? 0xffe9a0 : 0x8a7a5a);
    if (!farm.riverGlints) return;
    const path = [...RIVER, ...OUT];
    for (const m of farm.riverGlints) {
        m.userData.t = (m.userData.t + dt * 0.01) % 1;
        const f = m.userData.t * (path.length - 1), i = Math.floor(f), k = f - i, a = path[i], b = path[i + 1];
        const off = Math.sin(m.id * 1.7) * a[2] * 0.3;
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
        m.position.set(a[0] + dx * k - (dz / L) * off, -0.17, a[1] + dz * k + (dx / L) * off);
        m.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        m.visible = !roadCells.has(`${Math.floor(m.position.x)},${Math.floor(m.position.z)}`) && Math.sin(m.userData.t * 300 + m.id) > -0.2;
    }
}
