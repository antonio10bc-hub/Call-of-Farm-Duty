// El valle (propuesta «Lago glaciar»): arriba en pantalla (hacia -x -z, al fondo) las montañas
// grandes; una cascada baja de los picos a un lago al pie; de él sale el río, que cruza la
// colina y la llanura en diagonal hacia abajo a la derecha. Todo el valle se reparte en
// parcelas de forma irregular (como las comarcas de una provincia), sin huecos: cada una es la
// zona más cercana a sus semillas, con el río y el monte como frontera, y es plana a su altura.
//
// Se trabaja en dos sistemas:
//   u, v   el de la pantalla (u: de izquierda a derecha; v: del fondo, arriba, hacia delante)
//   x, z   el del mundo (la cámara mira en diagonal, girada 45°)
// y en celdas de 2×2 casillas alineadas con las parcelas (que empiezan en casillas pares).

export const STEP = 0.6;
export const quant = (h) => Math.round(h / STEP) * STEP;
const K = 1.3; // escala del valle (las medidas de abajo, en la del boceto: 150 de lado)
const HK = 1.1; // y de las alturas
export const VW = 150 * K, VH = 150 * K;
const S2 = Math.SQRT1_2;
export const toUV = (x, z) => [(x - z) * S2 + VW / 2, (x + z) * S2 + VH / 2];
export const toXZ = (u, v) => {
    const a = u - VW / 2, b = v - VH / 2;
    return [(a + b) * S2, (b - a) * S2];
};

const sm = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};
function hash(i, j, s) {
    let h = (i * 374761393 + j * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export { hash };
function vn(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const fbm = (x, y, s, o = 3) => {
    let t = 0, a = 0.5, f = 1;
    for (let k = 0; k < o; k++) { t += a * vn(x * f, y * f, s + k * 17); a *= 0.5; f *= 2; }
    return t / 0.875;
};

// ---------- El relieve (en las medidas del boceto) ----------
// La cordillera: una banda alta de borde irregular; los picos, conos con arista
function range(u, v, v0, v1, A, s) {
    const t = sm(v1, v0, v + (fbm(u * 0.04, 3.1, s) - 0.5) * 22);
    return 1.3 * A * Math.pow(t, 1.6) * (0.62 + 0.55 * fbm(u * 0.06, v * 0.06, s + 5));
}
function peaks(u, v, list) {
    let m = 0;
    for (const [pu, pv, h, r] of list) {
        const d = Math.hypot(u - pu, (v - pv) * 1.25);
        if (d < r) m = Math.max(m, 1.25 * h * Math.pow(1 - d / r, 1.35));
    }
    return m;
}
const PEAKS = [[30, 4, 36, 28], [76, -6, 42, 32], [122, 2, 38, 28], [-4, 20, 30, 24], [156, 18, 30, 24]];
// La altura natural en (u, v) del valle (sin río ni parcelas)
function relief(U, V) {
    const u = U / K, v = V / K;
    const h = range(u, v, 2, 28, 34, 7) + peaks(u, v, PEAKS) + 9 * sm(78, 26, v)
        + (fbm(u * 0.07, v * 0.07, 7) - 0.5) * 1.6 * sm(90, 30, v) + 0.6 * fbm(u * 0.1, v * 0.1, 3);
    // (lo muy alto, algo comprimido: montañas grandes, pero sin tapar el cielo)
    const m = Math.max(0, h) * HK;
    return m > 30 ? 30 + (m - 30) * 0.5 : m;
}

// ---------- Agua: el lago al pie de la montaña, la cascada que lo llena y el río que sale ----------
const LAKE = { u: 74 * K, v: 40 * K, ru: 20 * K, rv: 9 * K, rot: 0.08 };
LAKE.level = quant(relief(LAKE.u, LAKE.v) * 0.75);
const RIVERS = [
    { pts: [[78, -2, 1.5], [76, 14, 2], [75, 30, 2.5]], toLake: true },
    { pts: [[90, 46, 4], [106, 62, 5], [98, 82, 6], [114, 100, 7], [132, 112, 8], [122, 132, 8.5], [136, 158, 9]], fromLake: true },
].map((r) => ({ ...r, pts: r.pts.map(([u, v, w]) => [u * K, v * K, w * K]) }));
// Puentes (en el boceto): donde los caminos cruzan el río
const BRIDGES = [[101, 76], [127, 124]].map(([u, v]) => [u * K, v * K]);

function catmull(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.7);
        for (let k = 0; k < n; k++) {
            const t = k / n, t2 = t * t, t3 = t2 * t;
            const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
            out.push({ u: f(p0[0], p1[0], p2[0], p3[0]), v: f(p0[1], p1[1], p2[1], p3[1]), w: p1[2] + (p2[2] - p1[2]) * t });
        }
    }
    const l = pts[pts.length - 1];
    out.push({ u: l[0], v: l[1], w: l[2] });
    return out;
}
// Cada río, en muestras con su anchura y su nivel (siempre cuesta abajo; los que llegan al lago o
// salen de él, a su nivel)
export const RIVER_PATHS = RIVERS.map((r) => {
    const s = catmull(r.pts);
    let prev = Infinity;
    for (const p of s) {
        let y = relief(p.u, p.v) * (1 - 0.35 * sm(0, 30 * K, p.v));
        if (r.fromLake) y = Math.min(y, LAKE.level);
        if (r.toLake) y = Math.max(y, LAKE.level);
        p.y = Math.min(prev, y);
        prev = p.y;
        [p.x, p.z] = toXZ(p.u, p.v);
    }
    return s;
});
const SAMPLES = RIVER_PATHS.flat();
const lakeE = (u, v) => {
    const c = Math.cos(LAKE.rot), s = Math.sin(LAKE.rot), a = u - LAKE.u, b = v - LAKE.v;
    return Math.hypot((a * c + b * s) / LAKE.ru, (-a * s + b * c) / LAKE.rv);
};

// ---------- Las parcelas: semillas (en el boceto) de cada una ----------
// place: la parcela del juego que ocupa cada zona. Las tres de la izquierda (la orilla alta, la
// cañada y la de abajo) van partidas: una se compra ya y las demás quedan para lo que venga
export const REGIONS = [
    { place: 'farm', seeds: [[70, 96]] },
    { place: 'house', seeds: [[60, 62]] },
    { place: 'merchant', seeds: [[118, 38]] },
    { place: 'nw', seeds: [[42, 48]] },        // la orilla alta (la más alta): prado de vacas
    { place: 'nw2', seeds: [[12, 36]] },       // ... y su otra mitad, hacia el monte
    { place: 'west', seeds: [[34, 80]] },      // la cañada: calabazas
    { place: 'west2', seeds: [[10, 100]] },    // ... y su otra mitad
    { place: 'east', seeds: [[56, 126]] },     // la de abajo, en tres: maíz en la de en medio
    { place: 'east2', seeds: [[92, 138]] },
    { place: 'sw', seeds: [[18, 138]] },
    { place: 'south', seeds: [[94, 64]] },     // el desagüe del lago
    { place: 'se', seeds: [[140, 80]] },       // la margen este, al otro lado del río
].map((r) => ({ ...r, seeds: r.seeds.map(([u, v]) => [u * K, v * K]) }));

// ---------- La rejilla: celdas de 2×2 casillas ----------
export const CELL = 2;
export const GX0 = -168, GZ0 = -168, GN = 168; // celdas por lado (de -168 a 168)
const N = GN * GN;
export const cellIndex = (x, z) => {
    const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL);
    return i < 0 || j < 0 || i >= GN || j >= GN ? -1 : j * GN + i;
};
export const cellX = (k) => GX0 + (k % GN) * CELL + 1; // centro de la celda
export const cellZ = (k) => GZ0 + Math.floor(k / GN) * CELL + 1;

// Tipo de cada celda
export const OUT = -3, MOUNT = -1, SLOPE = -4; // fuera del valle; montaña; ladera de monte (sin dueño)
export const G = {
    inside: new Uint8Array(N),
    nat: new Float32Array(N),   // altura natural (con el valle del río tallado)
    h: new Float32Array(N),     // altura final (las parcelas, planas a la suya)
    water: new Uint8Array(N),
    reg: new Int16Array(N).fill(OUT), // zona (índice en REGIONS) o un tipo de arriba
    u: new Float32Array(N),
    v: new Float32Array(N),
};

(function generate() {
    const { inside, nat, h, water, reg, u: U, v: V } = G;
    for (let k = 0; k < N; k++) {
        const [u, v] = toUV(cellX(k), cellZ(k));
        U[k] = u; V[k] = v;
        inside[k] = u > -16 && u < VW + 16 && v > -34 && v < VH + 14 ? 1 : 0;
        if (inside[k]) nat[k] = relief(u, v);
    }
    // Tallado: el agua, sus orillas y el valle del río (más suave cuanto más ancho)
    for (let k = 0; k < N; k++) {
        if (!inside[k]) continue;
        let bd = 1e9, bp = null;
        for (const p of SAMPLES) {
            const d = (U[k] - p.u) ** 2 + (V[k] - p.v) ** 2;
            if (d < bd) { bd = d; bp = p; }
        }
        const d = Math.sqrt(bd), w = bp.w, y = bp.y;
        let n = nat[k];
        if (d < w / 2) { water[k] = 1; h[k] = quant(y) - 0.3; }
        else if (n > y) n = y + (n - y) * sm(w / 2, w / 2 + 5 + w * 1.2, d);
        const e = lakeE(U[k], V[k]);
        if (e < 1) { water[k] = 1; h[k] = LAKE.level - 0.3; }
        else if (n > LAKE.level) n = LAKE.level + (n - LAKE.level) * sm(0, 7, (e - 1) * Math.min(LAKE.ru, LAKE.rv));
        nat[k] = n;
    }
    // La montaña: lo que pasa del umbral no se reparte
    for (let k = 0; k < N; k++) if (inside[k] && !water[k]) reg[k] = nat[k] > 11.5 ? MOUNT : SLOPE;
    // Trozos del valle (el agua y el monte los separan): cada celda, de una semilla de su trozo
    const comp = new Int32Array(N).fill(-1), size = [];
    const nb = (k) => {
        const i = k % GN, o = [];
        if (i > 0) o.push(k - 1);
        if (i < GN - 1) o.push(k + 1);
        if (k >= GN) o.push(k - GN);
        if (k < N - GN) o.push(k + GN);
        return o;
    };
    for (let k = 0; k < N; k++) {
        if (reg[k] !== SLOPE || comp[k] >= 0) continue;
        const q = [k], c = size.length;
        comp[k] = c;
        let n = 0;
        while (q.length) {
            const a = q.pop();
            n++;
            for (const b of nb(a)) if (reg[b] === SLOPE && comp[b] < 0) { comp[b] = c; q.push(b); }
        }
        size.push(n);
    }
    const seeds = [];
    REGIONS.forEach((r, ri) => r.seeds.forEach(([u, v]) => {
        const [x, z] = toXZ(u, v);
        seeds.push({ ri, u, v, comp: comp[cellIndex(x, z)] });
    }));
    for (let k = 0; k < N; k++) {
        if (reg[k] !== SLOPE) continue;
        // (bordes ondulados: se deforma un poco el punto antes de buscar su semilla)
        const u = U[k] + (fbm(U[k] * 0.035, V[k] * 0.035, 11) - 0.5) * 26 + (fbm(U[k] * 0.1, V[k] * 0.1, 31) - 0.5) * 10;
        const v = V[k] + (fbm(U[k] * 0.035, V[k] * 0.035, 23) - 0.5) * 26 + (fbm(U[k] * 0.1, V[k] * 0.1, 37) - 0.5) * 10;
        const big = size[comp[k]] > 60;
        let bd = 1e9, br = SLOPE;
        for (const s of seeds) {
            if (big && s.comp !== comp[k]) continue;
            const d = (u - s.u) ** 2 + (v - s.v) ** 2;
            if (d < bd) { bd = d; br = s.ri; }
        }
        reg[k] = br;
    }
    // Cada parcela, plana a la altura media de su terreno (en escalones). Lo que sube mucho por
    // encima no se cultiva: queda como ladera de monte (con su relieve), sin muro contra la montaña
    const sum = REGIONS.map(() => [0, 0]);
    for (let k = 0; k < N; k++) if (reg[k] >= 0) { sum[reg[k]][0] += nat[k]; sum[reg[k]][1]++; }
    REGIONS.forEach((r, ri) => (r.h = sum[ri][1] ? Math.max(0, quant(sum[ri][0] / sum[ri][1])) : 0));
    for (let k = 0; k < N; k++) if (reg[k] >= 0 && nat[k] > REGIONS[reg[k]].h + 2.6) reg[k] = SLOPE;
    for (let k = 0; k < N; k++) {
        if (!inside[k] || water[k]) continue;
        h[k] = reg[k] >= 0 ? REGIONS[reg[k]].h : Math.max(0, quant(nat[k]));
    }
    // La montaña, en bloques de 4×4 (dos por dos celdas a la misma altura): menos cubos
    for (let j = 0; j < GN; j += 2) for (let i = 0; i < GN; i += 2) {
        const ks = [j * GN + i, j * GN + i + 1, (j + 1) * GN + i, (j + 1) * GN + i + 1];
        if (!ks.every((k) => inside[k] && reg[k] === MOUNT && !water[k])) continue;
        const m = quant(ks.reduce((s, k) => s + nat[k], 0) / 4);
        for (const k of ks) { h[k] = m; G.block = G.block || new Uint8Array(N); G.block[k] = k === ks[0] ? 2 : 1; }
    }
    G.block = G.block || new Uint8Array(N);
})();

// ---------- Consultas ----------
// La zona en un punto del mundo (índice en REGIONS, o un tipo: MOUNT, SLOPE, OUT; -2 agua)
export function regionAt(x, z) {
    const k = cellIndex(x, z);
    if (k < 0 || !G.inside[k]) return OUT;
    return G.water[k] ? -2 : G.reg[k];
}
// La altura del suelo en un punto del mundo (la de su celda)
export function groundAt(x, z) {
    const k = cellIndex(x, z);
    return k < 0 || !G.inside[k] ? 0 : G.h[k];
}
export const isWater = (x, z) => {
    const k = cellIndex(x, z);
    return k >= 0 && G.water[k] === 1;
};
export { LAKE, BRIDGES, sm };
