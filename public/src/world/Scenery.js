import * as THREE from 'three';
import { box, toon } from '../render/materials.js';
import { PLACES, gateWorld, floorPlace } from '../content/farm.js';
import { G, REGIONS, GN, CELL, cellIndex, cellX, cellZ, MOUNT, SLOPE, RIVER_PATHS, BRIDGES, toXZ, hash, regionAt, groundAt, VW, VH } from './valley.js';

// Todo lo de fuera de las parcelas (en coordenadas del mundo, world: true), sacado del valle
// (world/valley.js), celda a celda:
//  - el suelo: cada celda, una columna (hierba arriba y, donde el vecino está más bajo, la tierra
//    del escalón). En la zona de cada parcela no hay hierba (está su suelo), solo la tierra
//  - la montaña por franjas: verde abajo, luego tierra, luego roca gris y nieve solo en la cumbre
//  - caminos de tierra por las fronteras entre parcelas (del lado bajo) y desde las salidas de la
//    granja y la casa; puentes sobre el río; farolas que se encienden de noche
//  - el lago, la cascada que lo llena y el río que sale de él, con su arena en la orilla
//  - setos donde una parcela da al agua o al monte, y bosque por las laderas y las zonas sin uso

const N = GN * GN;
const _lc = new THREE.Color();
// ¿Esta celda queda bajo el suelo de una parcela? (la parcela, estirada, llena su zona)
const FLOOR = new Uint8Array(N);
for (let k = 0; k < N; k++) FLOOR[k] = G.inside[k] && !G.water[k] && G.reg[k] >= 0 && floorPlace(cellX(k), cellZ(k)) ? 1 : 0;

// Las franjas de la montaña: verde, tierra, roca y (solo en la cumbre) nieve
function mountainBand(h, k) {
    const n = h + (hash(k, 3, 7) - 0.5) * 5;
    return n > 47 ? 3 : n > 30 ? 2 : n > 18 ? 1 : 0;
}
const BAND_TOP = [[0x5f9a3e, 0x588f3a], [0x9a6a3e, 0x8f6238], [0x8a8a96, 0x7f7f8c], [0xf4f6fa, 0xe8ecf4]];
const BAND_SIDE = [0x7a5a3a, 0x7a4f2a, 0x6a6a76, 0xc8ccd6];

// ---------- Caminos: por las fronteras entre parcelas, del lado bajo ----------
const pathTiles = new Map(); // "x,z" (casilla) -> altura
const addPath = (x, z) => {
    const key = `${x},${z}`;
    if (pathTiles.has(key) || regionAt(x + 0.5, z + 0.5) < 0) return;
    pathTiles.set(key, groundAt(x + 0.5, z + 0.5));
};
(function buildPaths() {
    for (let k = 0; k < N; k++) {
        if (!G.inside[k] || G.reg[k] < 0 || G.water[k]) continue;
        const i = k % GN, x0 = cellX(k) - 1, z0 = cellZ(k) - 1;
        for (const [j, ax] of [[i < GN - 1 ? k + 1 : -1, 'x'], [k + GN < N ? k + GN : -1, 'z']]) {
            if (j < 0 || G.reg[j] < 0 || G.water[j] || G.reg[j] === G.reg[k]) continue;
            // De qué lado va: nunca sobre el suelo de una parcela si se puede; si no, el más bajo
            let mine;
            if (FLOOR[k] !== FLOOR[j]) mine = !FLOOR[k];
            else mine = G.h[k] < G.h[j] - 0.01 || (Math.abs(G.h[k] - G.h[j]) < 0.01 && G.reg[k] > G.reg[j]);
            if (ax === 'x') {
                const tx = mine ? x0 + 1 : x0 + 2;
                addPath(tx, z0); addPath(tx, z0 + 1);
            } else {
                const tz = mine ? z0 + 1 : z0 + 2;
                addPath(x0, tz); addPath(x0 + 1, tz);
            }
        }
    }
    // Las esquinas: donde dos casillas de camino solo se tocan en diagonal, una más que las una
    for (const key of [...pathTiles.keys()]) {
        const [x, z] = key.split(',').map(Number);
        for (const [dx, dz] of [[1, 1], [1, -1]]) {
            if (pathTiles.has(`${x + dx},${z + dz}`) && !pathTiles.has(`${x + dx},${z}`) && !pathTiles.has(`${x},${z + dz}`)) {
                const a = groundAt(x + dx + 0.5, z + 0.5), b = groundAt(x + 0.5, z + dz + 0.5);
                if (a <= b) addPath(x + dx, z); else addPath(x, z + dz);
            }
        }
    }
    // Desde las salidas de la granja y la casa (sus caminos de dentro) hasta la red de caminos
    for (const P of PLACES) P.gates.forEach((_, gi) => {
        const g = gateWorld(P.id, gi), wide = Math.abs(g.ox ? g.z % 1 : g.x % 1) < 0.01; // (los de 2 de ancho salen por una raya)
        let x = g.x + g.ox * 0.5, z = g.z + g.oz * 0.5;
        for (let s = 0; s < 40; s++, x += g.ox, z += g.oz) {
            const tx = Math.floor(x), tz = Math.floor(z), r = regionAt(tx + 0.5, tz + 0.5);
            if (r < 0 || (r !== P.ri && s > 0)) break;
            const hit = [[0, 0], [g.oz, g.ox], [-g.oz, -g.ox]].some(([a, b]) => pathTiles.has(`${tx + a},${tz + b}`));
            addPath(tx, tz);
            if (wide) addPath(tx - Math.abs(g.oz), tz - Math.abs(g.ox));
            if (hit && s > 0) break;
        }
    });
})();
const onPath = (x, z, m = 1) => {
    const r = Math.ceil(m);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (pathTiles.has(`${Math.floor(x) + dx},${Math.floor(z) + dz}`)) return true;
    return false;
};
// ¿Pisa un camino (o está a menos de m)? Un punto del mundo { x, z }
export const onPathWorld = (w, m = 0) => onPath(w.x, w.z, m);

// Puentes: de orilla a orilla, de través al río, con un trozo de camino a cada lado
const bridges = BRIDGES.map(([u, v]) => {
    let best = null, bd = Infinity;
    for (const path of RIVER_PATHS) path.forEach((p, i) => {
        const d = (p.u - u) ** 2 + (p.v - v) ** 2;
        if (d < bd) { bd = d; best = { p, a: path[Math.max(0, i - 3)], b: path[Math.min(path.length - 1, i + 3)] }; }
    });
    const { p, a, b } = best, L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L, half = p.w / 2 + 2.5;
    const y = Math.max(groundAt(p.x + nx * half, p.z + nz * half), groundAt(p.x - nx * half, p.z - nz * half), p.y) + 0.2;
    // El camino sigue por cada lado hasta dar con otro
    for (const s of [-1, 1]) {
        for (let t = half; t < half + 16; t += 0.7) {
            const x = Math.floor(p.x + nx * t * s), z = Math.floor(p.z + nz * t * s);
            if (regionAt(x + 0.5, z + 0.5) < 0) continue;
            const hit = pathTiles.has(`${x},${z}`);
            addPath(x, z);
            if (hit) break;
        }
    }
    return { x: p.x, z: p.z, y, len: half * 2 + 1, ry: Math.atan2(nx, nz) };
});

export function buildScenery(farm) {
    const W = (list) => list.map((p) => ({ ...p, world: true }));
    const theme = farm.theme;
    const colored = (list, delay, hull = true) => {
        const m = hull ? farm.addHulled(0xffffff, W(list), delay) : farm.addAnimated(new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), Math.max(1, list.length)), W(list), delay).mesh;
        list.forEach((p, i) => m.setColorAt(i, new THREE.Color(p.c)));
        return m;
    };

    // ---------- El suelo: una columna por celda ----------
    const caps = [], soil = [], water = [], hedge = [], rocks = [];
    const lowest = (x, z, e) => Math.min(...[[e, 0], [-e, 0], [0, e], [0, -e]].map(([dx, dz]) => {
        const k = cellIndex(x + dx, z + dz);
        return k < 0 || !G.inside[k] ? -1 : G.h[k];
    }));
    for (let k = 0; k < N; k++) {
        if (!G.inside[k] || G.block[k] === 1) continue; // (las de un bloque de montaña van en su primera)
        const big = G.block[k] === 2, s = big ? 4 : CELL;
        const x = cellX(k) + (big ? 1 : 0), z = cellZ(k) + (big ? 1 : 0), top = G.h[k], ri = G.reg[k];
        const chk = ((x >> 1) + (z >> 1)) & 1;
        const low = lowest(x, z, s / 2 + 1);
        if (G.water[k]) {
            water.push({ x, y: top - 0.04, z, sx: s, sy: 0.12, sz: s, c: chk ? 0x4aa8e0 : 0x3f98d4 });
            // (la cascada y los saltos del río: agua también por el lado)
            if (low < top - 0.39) soil.push({ x, y: (top - 0.1 + low) / 2, z, sx: s, sy: top - 0.1 - low, sz: s, c: 0x6fc0ec });
            continue;
        }
        let c, side = (Math.floor(x) + Math.floor(z)) % 3 ? 0x8a5a34 : 0x7a4f2a;
        if (ri === MOUNT || ri === SLOPE) {
            const b = mountainBand(top, k);
            c = BAND_TOP[b][chk];
            side = BAND_SIDE[b];
            // La orilla del agua, de arena
            if (b === 0 && [[s, 0], [-s, 0], [0, s], [0, -s]].some(([dx, dz]) => regionAt(x + dx, z + dz) === -2)) c = 0xd9c48a;
            if ((b === 1 || b === 2) && hash(k, 5, 1) < 0.06) rocks.push({ x: x + (hash(k, 1, 2) - 0.5) * s * 0.5, y: top + 0.3, z: z + (hash(k, 2, 2) - 0.5) * s * 0.5, sx: 1.4, sy: 0.6, sz: 1.1, ry: hash(k, 3, 3) * 3, c: b === 1 ? 0x8a7a6a : 0x9a9aa6 });
        } else {
            c = theme.grass[Math.floor(hash(k, 9, 4) * 3)];
        }
        // La tierra del escalón (bajo el suelo de una parcela, justo hasta él)
        const capTop = FLOOR[k] ? top - 0.3 : top - 0.4;
        if (low < capTop - 0.01) soil.push({ x, y: (capTop + low - 0.2) / 2, z, sx: s, sy: capTop - low + 0.2, sz: s, c: side });
        if (FLOOR[k]) {
            // Seto donde la parcela da al agua o al monte (a la mitad de la celda de ese lado)
            for (const [dx, dz] of [[s, 0], [-s, 0], [0, s], [0, -s]]) {
                const r = regionAt(x + dx, z + dz);
                if (r >= 0 || r === -3 || onPath(x + dx * 0.25, z + dz * 0.25, 0)) continue;
                if (hash(k, dx + 3, dz + 5) < 0.75) hedge.push({ x: x + dx * 0.25, y: top + 0.35, z: z + dz * 0.25, sx: 0.95, sy: 0.7, sz: 0.95, ry: hash(k, dx, dz) * 0.6 });
            }
            continue;
        }
        caps.push({ x, y: top - 0.2, z, sx: s, sy: 0.4, sz: s, c });
    }
    colored(caps, 0.4, false);
    colored(soil, 0.4, false);
    colored(water, 0.6, false);
    const hm = farm.addHulled(0xffffff, W(hedge), 0.7);
    hedge.forEach((_, i) => hm.setColorAt(i, new THREE.Color(theme.leaves[i % 3])));
    colored(rocks, 0.8);

    // ---------- Vallas de los corrales de animales ----------
    // Las cuatro zonas de animales (vacas, ovejas, gallinas y cerdos), cada una con su valla de
    // madera alrededor: postes y dos travesaños por el borde de su zona (entre celdas), a la altura
    // de su suelo. Por las fronteras van los caminos: la valla va por dentro del corral, pegada al
    // camino (sin cortarlo), y no se mete en el agua
    const PENS = new Set(['nw', 'nw2', 'west', 'house'].map((id) => REGIONS.findIndex((r) => r.place === id)).filter((i) => i >= 0));
    const pen = (k) => PENS.has(G.reg[k]) && !onPath(cellX(k) - 0.5, cellZ(k) - 0.5, 0.5); // (dentro del corral y sin camino)
    const fRails = [], fPosts = [], seen = new Set();
    const post = (x, z, y) => {
        const key = `${x},${z}`;
        if (seen.has(key)) return;
        seen.add(key);
        fPosts.push({ x, y: y + 0.5, z, sx: 0.16, sy: 1.0, sz: 0.16 });
    };
    for (let k = 0; k < N; k++) {
        if (!G.inside[k] || G.water[k]) continue;
        const i = k % GN, pk = pen(k);
        for (const [j, right] of [[i < GN - 1 ? k + 1 : -1, true], [k + GN < N ? k + GN : -1, false]]) {
            if (j < 0 || !G.inside[j] || G.water[j]) continue;
            const pj = pen(j);
            // Valla donde acaba un corral: entre el corral y lo de fuera (otra zona o el camino), o
            // entre dos corrales
            if (!(pk !== pj || (pk && pj && G.reg[k] !== G.reg[j]))) continue;
            const xm = right ? cellX(k) + CELL / 2 : cellX(k), zm = right ? cellZ(k) : cellZ(k) + CELL / 2;
            const y = pk && pj ? Math.max(G.h[k], G.h[j]) : pk ? G.h[k] : G.h[j];
            for (const h of [0.38, 0.78]) fRails.push(right ? { x: xm, y: y + h, z: zm, sx: 0.08, sy: 0.1, sz: CELL } : { x: xm, y: y + h, z: zm, sx: CELL, sy: 0.1, sz: 0.08 });
            if (right) {
                post(xm, zm - CELL / 2, y);
                post(xm, zm + CELL / 2, y);
            } else {
                post(xm - CELL / 2, zm, y);
                post(xm + CELL / 2, zm, y);
            }
        }
    }
    if (fRails.length) farm.addHulled(0x9a6a3a, W(fRails), 0.75);
    if (fPosts.length) farm.addHulled(0x7a4f2a, W(fPosts), 0.75);

    // ---------- Caminos y puentes ----------
    const road = [], deck = [], rails = [];
    for (const [key, y] of pathTiles) {
        const [x, z] = key.split(',').map(Number);
        road.push({ x: x + 0.5, y: y - 0.09, z: z + 0.5, sx: 1, sy: 0.3, sz: 1, c: theme.path[(x + z) & 1] });
    }
    for (const b of bridges) {
        const cx = Math.cos(b.ry), sx = Math.sin(b.ry);
        deck.push({ x: b.x, y: b.y, z: b.z, sx: 2.4, sy: 0.25, sz: b.len, ry: b.ry });
        for (const s of [-1, 1]) rails.push({ x: b.x + cx * 1.15 * s, y: b.y + 0.45, z: b.z - sx * 1.15 * s, sx: 0.14, sy: 0.5, sz: b.len - 1, ry: b.ry });
        for (let t = -b.len / 2 + 1; t <= b.len / 2 - 1; t += 2.5) for (const s of [-1, 1]) rails.push({ x: b.x + sx * t + cx * 1.15 * s, y: b.y - 0.6, z: b.z + cx * t - sx * 1.15 * s, sx: 0.25, sy: 1.6, sz: 0.25, ry: b.ry });
    }
    colored(road, 0.6, false);
    farm.addHulled(0x9a6a3a, W(deck), 0.7);
    farm.addHulled(0x7a4f2a, W(rails), 0.75);

    // Destellos que bajan con el río
    farm.riverGlints = [];
    const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let k = 0; k < 40; k++) {
        const m = new THREE.Mesh(box(0.5, 0.04, 0.16), gm);
        m.userData.t = Math.random();
        farm.root.add(m);
        farm.riverGlints.push(m);
    }

    // ---------- Farolas a un lado de los caminos (una cada tanto) ----------
    farm.lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const posts = [], heads = [], lamps = [];
    for (const key of pathTiles.keys()) {
        const [x, z] = key.split(',').map(Number);
        if (hash(x, z, 77) > 0.06 || lamps.some(([a, b]) => Math.hypot(a - x, b - z) < 14)) continue;
        const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !pathTiles.has(`${x + dx},${z + dz}`) && regionAt(x + dx + 0.5, z + dz + 0.5) >= 0);
        if (!side) continue;
        const lx = x + side[0] + 0.5, lz = z + side[1] + 0.5, g = groundAt(lx, lz);
        lamps.push([x, z]);
        posts.push({ x: lx, y: g + 1.1, z: lz, sx: 0.14, sy: 2.2, sz: 0.14 });
        heads.push({ x: lx, y: g + 2.35, z: lz, sx: 0.36, sy: 0.36, sz: 0.36 });
    }
    farm.addHulled(0x4a4a52, W(posts), 0.8);
    const lampMesh = farm.addAnimated(new THREE.InstancedMesh(box(1, 1, 1), farm.lampMat, Math.max(1, heads.length)), W(heads), 0.8).mesh;
    // Al anochecer se encienden en cadena: primero las de cerca de la granja y luego hacia fuera
    const F = PLACES.find((P) => P.id === 'farm'), dist = heads.map((h) => Math.hypot(h.x - F.c[0], h.z - F.c[1])), dMax = Math.max(1, ...dist);
    farm.lamps = { mesh: lampMesh, at: dist.map((d) => 0.25 + (d / dMax) * 0.3), on: heads.map(() => null) };

    // ---------- Señales en los cruces: un poste con una tablilla por cada parcela cercana, del
    // color de lo que hay en ella y apuntando hacia ella ----------
    const COLOR = { farm: 0xc8402e, house: 0x3a7ac8, merchant: 0x8a5ad8, wheatP: 0xf6cf4a, tomatoP: 0xe8352a, west: 0xf08a1e, east: 0xffe03a, nw: 0xf6f3ea, nw2: 0xb8a8e0 };
    const sposts = [], sboards = [], crosses = [];
    for (const key of pathTiles.keys()) {
        const [x, z] = key.split(',').map(Number);
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => pathTiles.has(`${x + dx},${z + dz}`)).length;
        if (n < 3 || crosses.some(([a, b]) => Math.hypot(a - x, b - z) < 16)) continue;
        const spot = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dz]) => [x + dx + 0.5, z + dz + 0.5]).find(([a, b]) => !pathTiles.has(`${Math.floor(a)},${Math.floor(b)}`) && regionAt(a, b) >= 0);
        if (!spot) continue;
        crosses.push([x, z]);
        const [sx, sz] = spot, g = groundAt(sx, sz);
        sposts.push({ x: sx, y: g + 1.0, z: sz, sx: 0.14, sy: 2.0, sz: 0.14 });
        // Las tres parcelas más cerca (sin contar la del propio cruce)
        const here = regionAt(sx, sz), dests = PLACES.filter((P) => P.c && P.ri !== here && COLOR[P.id] !== undefined).sort((a, b) => Math.hypot(a.c[0] - sx, a.c[1] - sz) - Math.hypot(b.c[0] - sx, b.c[1] - sz)).slice(0, 3);
        dests.forEach((P, i) => {
            const ang = Math.atan2(P.c[1] - sz, P.c[0] - sx), ca = Math.cos(ang), sa = Math.sin(ang), y = g + 1.7 - i * 0.32;
            sboards.push({ x: sx + ca * 0.55, y, z: sz + sa * 0.55, sx: 1.0, sy: 0.24, sz: 0.08, ry: -ang, c: 0xf3ead2 });
            sboards.push({ x: sx + ca * 1.02, y, z: sz + sa * 1.02, sx: 0.2, sy: 0.18, sz: 0.1, ry: -ang + Math.PI / 4, c: COLOR[P.id] }); // la punta, del color de la parcela
            sboards.push({ x: sx + ca * 0.45, y, z: sz + sa * 0.45, sx: 0.26, sy: 0.16, sz: 0.1, ry: -ang, c: COLOR[P.id] });
        });
    }
    farm.addHulled(0x7a4f2a, W(sposts), 0.8);
    colored(sboards, 0.85);

    // ---------- Bancos de nubes alrededor del valle: tapan su borde (en la vista del mapa) ----------
    const bank = [];
    // Cada nube, un cúmulo por pisos: una base ancha y plana con la panza en sombra, encima dos o
    // tres bolas blancas que se solapan y una más pequeña arriba (todo alineado: bloques limpios)
    const SHADE = 0xc4d2e6, MID = 0xe6eef8, TOP = 0xffffff;
    const edge = (u, v, k) => {
        const [x, z] = toXZ(u, v), r = (j) => hash(k, j, 9);
        const w = 9 + r(1) * 6, d = 7 + r(2) * 4, y = 0.5 + r(3) * 2.5, cx = x + (r(4) - 0.5) * 4, cz = z + (r(5) - 0.5) * 4;
        bank.push({ x: cx, y, z: cz, sx: w, sy: 1.2, sz: d, c: SHADE });
        const n = 2 + (r(6) < 0.5 ? 1 : 0);
        for (let j = 0; j < n; j++) {
            const s = (w * (0.42 + r(10 + j) * 0.18)), ox = (j - (n - 1) / 2) * w * 0.3, oz = (r(20 + j) - 0.5) * d * 0.3;
            bank.push({ x: cx + ox, y: y + 0.6 + s * 0.3, z: cz + oz, sx: s, sy: s * 0.6, sz: Math.min(d * 0.85, s), c: MID });
        }
        const t = w * 0.32;
        bank.push({ x: cx + (r(30) - 0.5) * w * 0.3, y: y + 0.6 + w * 0.3 + t * 0.35, z: cz, sx: t, sy: t * 0.7, sz: t * 0.9, c: TOP });
    };
    // (dos filas fuera del borde del valle: no tapan las parcelas)
    let k = 0;
    for (const [o, step] of [[-17, 9], [-31, 12]]) {
        for (let t = -30; t < VH + 24; t += step) { edge(o, t, k++); edge(VW - o, t, k++); }
        for (let t = -20; t < VW + 20; t += step) edge(t, VH - o, k++);
    }
    colored(bank, 1.0);

    // ---------- Bosque: por las laderas, el monte bajo, el bosque del mercader y las parcelas sin uso ----------
    const spots = [], lampNear = (x, z) => posts.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6);
    for (let k = 0; k < N && spots.length < 520; k++) {
        if (!G.inside[k] || G.water[k] || FLOOR[k]) continue;
        const ri = G.reg[k], top = G.h[k];
        let p;
        if (ri === MOUNT || ri === SLOPE) p = mountainBand(top, k) === 0 ? 0.32 : mountainBand(top, k) === 1 ? 0.05 : 0;
        else if (ri >= 0) p = 0.2; // (rincones de una zona a los que no llega su parcela)
        else continue;
        if (hash(k, 11, 13) >= p) continue;
        const x = cellX(k) + (hash(k, 1, 9) - 0.5), z = cellZ(k) + (hash(k, 2, 9) - 0.5), s = 0.8 + hash(k, 3, 9) * 0.6, r = 0.8 * s;
        if (onPath(x, z, 1) || lampNear(x, z) || regionAt(x, z) === -2) continue;
        // (sin pisar un escalón ni el suelo de una parcela: todo el árbol en la misma celda)
        if ([[r, r], [-r, r], [r, -r], [-r, -r]].some(([dx, dz]) => cellIndex(x + dx, z + dz) !== k && (groundAt(x + dx, z + dz) !== top || FLOOR[cellIndex(x + dx, z + dz)]))) continue;
        if (spots.some(([a, b, , sb]) => Math.hypot(a - x, b - z) < (s + sb) * 0.95)) continue;
        spots.push([x, z, top, s]);
    }
    return spots;
}

// Los destellos bajan con el río; las farolas se encienden de noche
export function updateScenery(farm, dt) {
    if (farm.lamps) {
        const L = farm.lamps, k = farm.nightK || 0;
        let any = false;
        L.at.forEach((t, i) => {
            const on = k > t;
            if (on === L.on[i]) return;
            L.on[i] = on;
            L.mesh.setColorAt(i, _lc.setHex(on ? 0xffe9a0 : 0x8a7a5a));
            any = true;
        });
        if (any) L.mesh.instanceColor.needsUpdate = true;
    }
    if (!farm.riverGlints) return;
    const path = RIVER_PATHS[RIVER_PATHS.length - 1];
    for (const m of farm.riverGlints) {
        m.userData.t = (m.userData.t + dt * 0.006) % 1;
        const f = m.userData.t * (path.length - 1), i = Math.floor(f), k = f - i, a = path[i], b = path[Math.min(path.length - 1, i + 1)];
        const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, off = Math.sin(m.id * 1.7) * a.w * 0.3;
        const x = a.x + dx * k - (dz / L) * off, z = a.z + dz * k + (dx / L) * off;
        m.position.set(x, groundAt(x, z) + 0.1, z);
        m.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        m.visible = regionAt(x, z) === -2 && Math.sin(m.userData.t * 300 + m.id) > -0.2;
    }
}
export { toXZ, REGIONS };
