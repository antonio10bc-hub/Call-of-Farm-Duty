import * as THREE from 'three';
import { box, toon } from '../render/materials.js';
import { JUNK } from '../render/junk.js';
import { FARM, PLACES, gateWorld, worldToPlace } from '../content/farm.js';
import { G, REGIONS, GN, CELL, cellIndex, cellX, cellZ, MOUNT, SLOPE, RIVER_PATHS, BRIDGES, toXZ, hash, regionAt, groundAt } from './valley.js';

// Todo lo de fuera de las parcelas (en coordenadas del mundo, world: true), sacado del valle
// (world/valley.js), celda a celda:
//  - el suelo: cada celda, una columna (hierba arriba y, donde el vecino está más bajo, la tierra
//    del escalón). Bajo el cuadrado de cada parcela no hay hierba (está su suelo), solo la tierra
//  - la montaña por franjas: verde abajo, luego tierra, luego roca gris y nieve solo en la cumbre
//  - el margen de cada parcela (lo que su zona tiene fuera de su cuadrado), a su altura; si es de
//    una parcela sin comprar, en sombra como ella
//  - caminos de tierra por las fronteras entre parcelas (del lado bajo) y desde las salidas de la
//    granja y la casa; puentes sobre el río; farolas que se encienden de noche
//  - el lago, la cascada que lo llena y el río que sale de él, con su arena en la orilla
//  - setos donde una parcela da al agua o al monte, y bosque por las laderas y las zonas sin uso

const N = GN * GN;
const placeOfReg = (ri) => PLACES.find((P) => P.ri === ri);
// ¿Esta celda queda bajo el suelo de su parcela? (de su zona y dentro de su cuadrado)
function underFloor(k) {
    const ri = G.reg[k];
    if (ri < 0 || G.water[k]) return false;
    const P = placeOfReg(ri), x = cellX(k), z = cellZ(k);
    return !!P && x >= P.at[0] && x < P.at[0] + 30 && z >= P.at[1] && z < P.at[1] + 30;
}
const FLOOR = new Uint8Array(N);
for (let k = 0; k < N; k++) FLOOR[k] = underFloor(k) ? 1 : 0;

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
    for (let dz = -m; dz <= m; dz++) for (let dx = -m; dx <= m; dx++) if (pathTiles.has(`${Math.floor(x) + dx},${Math.floor(z) + dz}`)) return true;
    return false;
};

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
    const caps = [], margin = [], marginCells = [], soil = [], water = [], hedge = [], rocks = [];
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
        if (FLOOR[k]) continue;
        if (ri >= 0) {
            // Margen de una parcela: su hierba (en sombra si es de una sin comprar)
            const P = placeOfReg(ri), land = FARM.lands.find((l) => l.id === (P && P.id));
            const col = new THREE.Color(c);
            margin.push({ x, y: top - 0.2, z, sx: s, sy: 0.4, sz: s, c });
            if (land) {
                // (sin limpiar, de tierra sucia como su parcela: wild; limpia, de hierba: col)
                const l = worldToPlace(P, x, z), w = new THREE.Color(JUNK.ground[Math.floor(hash(k, 4, 8) * JUNK.ground.length)]);
                marginCells.push({ i: margin.length - 1, land: land.id, field: land.field, lx: l.x, lz: l.z, col: [col.r, col.g, col.b], wild: [w.r, w.g, w.b] });
            }
            // Seto donde la parcela da al agua o al monte (a la mitad de la celda de ese lado)
            for (const [dx, dz] of [[s, 0], [-s, 0], [0, s], [0, -s]]) {
                const r = regionAt(x + dx, z + dz);
                if (r >= 0 || r === -3 || onPath(x + dx * 0.25, z + dz * 0.25, 0)) continue;
                if (hash(k, dx + 3, dz + 5) < 0.75) hedge.push({ x: x + dx * 0.25, y: top + 0.35, z: z + dz * 0.25, sx: 0.95, sy: 0.7, sz: 0.95, ry: hash(k, dx, dz) * 0.6 });
            }
        } else caps.push({ x, y: top - 0.2, z, sx: s, sy: 0.4, sz: s, c });
    }
    colored(caps, 0.4, false);
    colored(soil, 0.4, false);
    colored(water, 0.6, false);
    farm.margin = { mesh: colored(margin, 0.4, false), cells: marginCells };
    const hm = farm.addHulled(0xffffff, W(hedge), 0.7);
    hedge.forEach((_, i) => hm.setColorAt(i, new THREE.Color(theme.leaves[i % 3])));
    colored(rocks, 0.8);

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
    farm.lampMat = new THREE.MeshBasicMaterial({ color: 0x8a7a5a });
    const posts = [], heads = [], lamps = [];
    for (const key of pathTiles.keys()) {
        const [x, z] = key.split(',').map(Number);
        if (hash(x, z, 77) > 0.06 || lamps.some(([a, b]) => Math.hypot(a - x, b - z) < 14)) continue;
        const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !pathTiles.has(`${x + dx},${z + dz}`) && regionAt(x + dx + 0.5, z + dz + 0.5) >= 0
            && !FLOOR[cellIndex(x + dx + 0.5, z + dz + 0.5)]);
        if (!side) continue;
        const lx = x + side[0] + 0.5, lz = z + side[1] + 0.5, g = groundAt(lx, lz);
        lamps.push([x, z]);
        posts.push({ x: lx, y: g + 1.1, z: lz, sx: 0.14, sy: 2.2, sz: 0.14 });
        heads.push({ x: lx, y: g + 2.35, z: lz, sx: 0.36, sy: 0.36, sz: 0.36 });
    }
    farm.addHulled(0x4a4a52, W(posts), 0.8);
    farm.addAnimated(new THREE.InstancedMesh(box(1, 1, 1), farm.lampMat, Math.max(1, heads.length)), W(heads), 0.8);

    // ---------- Bosque: por las laderas, el monte bajo, el bosque del mercader y las parcelas sin uso ----------
    const spots = [], lampNear = (x, z) => posts.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6);
    for (let k = 0; k < N && spots.length < 520; k++) {
        if (!G.inside[k] || G.water[k] || FLOOR[k]) continue;
        const ri = G.reg[k], top = G.h[k];
        let p;
        if (ri === MOUNT || ri === SLOPE) p = mountainBand(top, k) === 0 ? 0.32 : mountainBand(top, k) === 1 ? 0.05 : 0;
        else if (ri >= 0) {
            const P = placeOfReg(ri), l = P && FARM.lands.find((q) => q.id === P.id);
            p = P && P.id === 'merchant' ? 0.3 : l && l.soon ? 0.1 : 0.015;
        } else continue;
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
    if (farm.lampMat) farm.lampMat.color.setHex((farm.nightK || 0) > 0.35 ? 0xffe9a0 : 0x8a7a5a);
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
