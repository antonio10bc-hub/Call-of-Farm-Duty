import * as THREE from 'three';
import { MERCHANTS, VILLAGE, EXCLUSIVE, TOWN } from '../content/merchants.js';
import { PIECES } from './townPieces.js';
import { bakeGroup } from './materials.js';

// El pueblo de los mercaderes, diseñado entero de antemano (render/merchants.js: Village lo usa):
// la ronda, los tres barrios (chalets dentro de la ronda; adosados y pisos fuera, en los sectores
// residenciales), los arcos de bienvenida y el sitio de cada pieza de cada objeto de la tienda.
// Nada se pisa: cada pieza se mide (su huella en el suelo, un rectángulo girado) y solo se pone
// donde cabe, lejos de calles, ronda, plaza, la nave madre y lo ya puesto. audit() lo comprueba.
//
// Los sectores: entre cada dos calles, por fuera de la ronda, un tema que da composición:
//   res   adosados y pisos, garajes y mercancías
//   farm  huertos, frutales, calabazas, pacas, espantapájaros, molinos y cobertizos
//   wild  (junto a la nave madre) camping, cristales, setas y plantas alienígenas
// Dentro de la ronda, en todos: chalets, parques infantiles, terrazas, heladerías, pozos, figuras,
// aves y pajareros, y árboles por todas partes.

const RAD = Math.PI / 180;
const rnd = (n) => { const v = Math.sin(n * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
const lerp = (a, b, k) => a + (b - a) * k;
const near = (p, q) => Math.abs(Math.atan2(Math.sin(p - q), Math.cos(p - q)));
const STONE = 0x9a948a, WOOD2 = 0x7a4f2a, DARK = 0x5a3a22, METAL = 0x9aa8b8, CREAM = 0xfff3d6;
const WINDOWS = [0xffe08a, 0xffe18b, 0xffe28c];

// ---------- Huellas: rectángulos girados en el suelo (x, z, medio ancho hx y hondo hz, giro ry) ----------
// (el eje x de la pieza, girado ry, va a (cos, -sin); el z, a (sin, cos), como en three.js)
const axes = (A) => [[Math.cos(A.ry), -Math.sin(A.ry)], [Math.sin(A.ry), Math.cos(A.ry)]];
export function obbHit(A, B, gap = 0) {
    const dx = B.x - A.x, dz = B.z - A.z;
    if (dx * dx + dz * dz > (A.r + B.r + gap) ** 2) return false;
    // (lo redondo, como un círculo: el punto del otro más cercano a su centro)
    if (A.round || B.round) {
        const [C, O] = A.round ? [A, B] : [B, A], rc = Math.max(C.hx, C.hz);
        if (O.round) return Math.hypot(dx, dz) < rc + Math.max(O.hx, O.hz) + gap;
        const [[ux, uz], [vx, vz]] = axes(O), qx = C.x - O.x, qz = C.z - O.z;
        const a = Math.max(-O.hx, Math.min(O.hx, qx * ux + qz * uz)), b = Math.max(-O.hz, Math.min(O.hz, qx * vx + qz * vz));
        return Math.hypot(qx - (ux * a + vx * b), qz - (uz * a + vz * b)) < rc + gap;
    }
    const aa = axes(A), bb = axes(B);
    for (const [ux, uz] of [...aa, ...bb]) {
        const pa = A.hx * Math.abs(aa[0][0] * ux + aa[0][1] * uz) + A.hz * Math.abs(aa[1][0] * ux + aa[1][1] * uz);
        const pb = B.hx * Math.abs(bb[0][0] * ux + bb[0][1] * uz) + B.hz * Math.abs(bb[1][0] * ux + bb[1][1] * uz);
        if (Math.abs(dx * ux + dz * uz) > pa + pb + gap) return false; // (un eje que los separa: no se tocan)
    }
    return true;
}
// (los puntos de su borde y el centro: para mirar zonas prohibidas)
function obbPoints(A) {
    const [[ux, uz], [vx, vz]] = axes(A), out = [];
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) out.push({ x: A.x + ux * A.hx * a + vx * A.hz * b, z: A.z + uz * A.hx * a + vz * A.hz * b });
    return out;
}
// Una rejilla para buscar rápido lo que hay cerca
class Grid {
    constructor(cell = 3) { this.cell = cell; this.map = new Map(); this.all = []; }
    keys(A, pad = 0) {
        const r = A.r + pad, c = this.cell, out = [];
        for (let i = Math.floor((A.x - r) / c); i <= Math.floor((A.x + r) / c); i++) for (let j = Math.floor((A.z - r) / c); j <= Math.floor((A.z + r) / c); j++) out.push(i * 100003 + j);
        return out;
    }
    add(A) { this.all.push(A); for (const k of this.keys(A)) { if (!this.map.has(k)) this.map.set(k, []); this.map.get(k).push(A); } }
    hits(A, gap = 0, skip = null) {
        const seen = new Set();
        for (const k of this.keys(A, gap)) for (const B of this.map.get(k) || []) {
            if (seen.has(B) || B === skip) continue;
            seen.add(B);
            if (obbHit(A, B, gap)) return B;
        }
        return null;
    }
    within(x, z, d, id) {
        const A = { x, z, r: d };
        for (const k of this.keys(A)) for (const B of this.map.get(k) || []) if (B.id === id && Math.hypot(B.x - x, B.z - z) < d) return true;
        return false;
    }
}

// Mide una pieza (su huella en el suelo: lo que toca tierra, sin copas ni toldos de arriba)
function measure(m, build) {
    const g = new THREE.Group();
    build(g);
    // (los charcos de luz del suelo no ocupan sitio)
    const halos = [];
    g.traverse((o) => o.userData.halo && halos.push(o));
    for (const o of halos) o.removeFromParent();
    g.updateMatrixWorld(true);
    const box = new THREE.Box3(), b = new THREE.Box3(), all = new THREE.Box3().setFromObject(g);
    g.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        b.setFromObject(o);
        if (b.min.y < 1.0) box.union(b);
    });
    if (box.isEmpty()) box.copy(all);
    g.traverse((o) => o.geometry && o.geometry.dispose());
    return { cx: (box.min.x + box.max.x) / 2, cz: (box.min.z + box.max.z) / 2, hx: (box.max.x - box.min.x) / 2, hz: (box.max.z - box.min.z) / 2, h: all.max.y, wx: (all.max.x - all.min.x) / 2, wz: (all.max.z - all.min.z) / 2 };
}
// La huella de algo medido, puesto en x, z con giro ry
function footAt(M, x, z, ry, id, round = false) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const F = { x: x + M.cx * c + M.cz * s, z: z - M.cx * s + M.cz * c, hx: M.hx, hz: M.hz, ry, id, round };
    F.r = Math.hypot(F.hx, F.hz);
    return F;
}

// ---------- Las casas de los barrios ----------
const WALLS = [0xf3e6c4, 0xe8c8a0, 0xc8dce8, 0xe0b8c8, 0xd8e0b0, 0xf0d0a0, 0xfff3d6], ROOFS = [0xc8402e, 0x3a6ab8, 0x5a8a3a, 0x8a4a8a, 0xd88a2a, 0x4a4a52];
const HOUSES = {
    // Chalet: casa sola de una o dos plantas, con tejado a dos aguas, a cuatro, plano o de cabaña,
    // porche, chimenea y su ventana
    chalet(m, h, k) {
        const form = Math.floor(rnd(k * 3.1) * 4), sc = 0.95 + rnd(k * 5.7) * 0.25, n = k;
        const W = (form === 3 ? 2.6 : 3.1) * sc, D = 2.6 * sc, H = (rnd(k * 8.1) < 0.4 ? 2.6 : 1.6) * sc;
        const wall = WALLS[Math.floor(rnd(n * 7.3) * WALLS.length)], roof = ROOFS[Math.floor(rnd(n * 9.1) * ROOFS.length)];
        m.part(h, W + 0.4, 0.2, D + 0.4, STONE, 0, 0.1, 0);
        m.part(h, W, H, D, wall, 0, 0.2 + H / 2, 0);
        const top = 0.2 + H;
        if (form === 0) for (let i = 0; i < 3; i++) m.part(h, W + 0.4 - i * (W / 3), 0.36, D + 0.3, roof, 0, top + 0.18 + i * 0.36, 0);
        else if (form === 1) for (let i = 0; i < 3; i++) m.part(h, W + 0.4 - i * 0.7, 0.34, D + 0.4 - i * 0.7, roof, 0, top + 0.17 + i * 0.34, 0);
        else if (form === 2) { m.part(h, W + 0.2, 0.2, D + 0.2, 0x8a8a86, 0, top + 0.1, 0); m.part(h, W * 0.4, 0.6, D * 0.5, wall, -W * 0.2, top + 0.5, 0); m.part(h, W * 0.45, 0.14, D * 0.55, roof, -W * 0.2, top + 0.85, 0); }
        else for (let i = 0; i < 4; i++) m.part(h, W + 0.3 - i * (W / 4), 0.5, D + 0.3, WOOD2, 0, top + 0.25 + i * 0.5, 0);
        if (form !== 2) m.part(h, 0.4, 0.9, 0.4, 0x8a5a3a, -W / 3, top + 0.7, -D / 4);
        // Porche: tejadillo y dos postes junto a la puerta
        m.part(h, 0.7, 1.1, 0.08, DARK, -W / 5, 0.75, D / 2 + 0.02);
        m.part(h, 1.4, 0.12, 0.8, roof, -W / 5, 1.6, D / 2 + 0.4);
        for (const x of [-0.6, 0.6]) m.part(h, 0.08, 1.4, 0.08, CREAM, -W / 5 + x, 0.9, D / 2 + 0.75, false);
        const win = WINDOWS[n % 3];
        m.lit(h, 0.6, 0.5, 0.06, win, W / 2 - 0.6, 0.2 + Math.min(H, 1.6) * 0.6, D / 2 + 0.02);
        if (H > 2) m.lit(h, 0.6, 0.5, 0.06, win, -W / 5, 0.2 + H * 0.78, D / 2 + 0.02);
        return { W, D, H, top: top + (form === 2 ? 0.9 : form === 3 ? 2 : 1.1), door: -W / 5, win: [[W / 2 - 0.6, 0.2 + Math.min(H, 1.6) * 0.6]] };
    },
    // Adosados: una hilera de 3 o 4 casas estrechas de 2 o 3 plantas, cada una de su color, con su
    // puerta y sus ventanas; tejado a dos aguas corrido
    row(m, h, k) {
        const units = 2 + (rnd(k * 2.7) < 0.6 ? 1 : 0), uw = 1.75, D = 2.7, floors = 2 + (rnd(k * 6.3) < 0.5 ? 1 : 0), H = floors * 1.2;
        const W = units * uw, roof = ROOFS[Math.floor(rnd(k * 9.1) * ROOFS.length)], win = WINDOWS[k % 3], wins = [];
        m.part(h, W + 0.3, 0.2, D + 0.3, STONE, 0, 0.1, 0);
        for (let u = 0; u < units; u++) {
            const x = -W / 2 + uw * (u + 0.5), wall = WALLS[Math.floor(rnd(k * 7.3 + u) * WALLS.length)];
            m.part(h, uw - 0.04, H, D, wall, x, 0.2 + H / 2, 0);
            m.part(h, 0.6, 1.0, 0.08, DARK, x - 0.4, 0.7, D / 2 + 0.02);
            m.part(h, 0.9, 0.3, 0.6, STONE, x - 0.4, 0.15, D / 2 + 0.3); // (escalón)
            for (let f = 0; f < floors; f++) {
                if (f === 0) { m.lit(h, 0.5, 0.5, 0.06, win, x + 0.4, 0.95, D / 2 + 0.02); wins.push([x + 0.4, 0.95]); }
                else for (const dx of [-0.45, 0.45]) m.lit(h, 0.46, 0.56, 0.06, win, x + dx, 0.2 + f * 1.2 + 0.6, D / 2 + 0.02);
            }
            m.part(h, 0.3, 0.6, 0.3, 0x8a5a3a, x + 0.6, 0.2 + H + 0.9, -0.5);
        }
        for (let i = 0; i < 3; i++) m.part(h, W + 0.3, 0.36, D + 0.3 - i * (D / 3), roof, 0, 0.2 + H + 0.18 + i * 0.36, 0);
        return { W, D, H, top: 0.2 + H + 1.1, door: -W / 2 + uw * 0.5 - 0.4, win: wins, units, uw };
    },
    // Bloque de pisos: 4 a 6 plantas con balcones, portal y depósito de agua y antena en la azotea;
    // alguno, torre más alta
    block(m, h, k) {
        const tower = rnd(k * 4.9) < 0.25, floors = tower ? 8 + Math.floor(rnd(k) * 3) : 4 + Math.floor(rnd(k * 3.3) * 3);
        const W = tower ? 3.2 : 4.4, D = tower ? 3.2 : 3.3, fh = 1.15, H = floors * fh;
        const wall = [0xe8d8c0, 0xd8c8b8, 0xc8d8e0, 0xe8c8b0, 0xd0d8c0][Math.floor(rnd(k * 7.7) * 5)], trim = [0x8a6a5a, 0x5a6a8a, 0x6a8a5a, 0xa85a4a][Math.floor(rnd(k * 2.2) * 4)], win = WINDOWS[k % 3];
        m.part(h, W + 0.4, 0.25, D + 0.4, STONE, 0, 0.12, 0);
        m.part(h, W, H, D, wall, 0, 0.25 + H / 2, 0);
        for (let f = 1; f < floors; f++) m.part(h, W + 0.12, 0.1, D + 0.12, trim, 0, 0.25 + f * fh, 0, false);
        const cols = tower ? 2 : 3, wins = [];
        for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
            const x = -W / 2 + (W / cols) * (c + 0.5), y = 0.25 + f * fh + fh * 0.55;
            if (f === 0 && c === Math.floor(cols / 2)) continue; // (el portal)
            m.lit(h, 0.6, 0.6, 0.06, win, x, y, D / 2 + 0.02);
            if (f > 0 && (f + c) % 2 === 0) { m.part(h, 0.9, 0.08, 0.5, trim, x, y - 0.36, D / 2 + 0.25); m.part(h, 0.9, 0.3, 0.05, trim, x, y - 0.2, D / 2 + 0.48, false); }
            if (f === 0) wins.push([x, y]);
        }
        m.part(h, 1.0, 1.2, 0.08, DARK, 0, 0.85, D / 2 + 0.02);
        m.part(h, 1.6, 0.14, 0.8, trim, 0, 1.6, D / 2 + 0.4);
        m.part(h, W + 0.2, 0.3, D + 0.2, trim, 0, 0.25 + H + 0.15, 0);
        m.part(h, 0.9, 0.8, 0.9, 0x8a8a86, -W / 4, 0.25 + H + 0.7, -D / 5);
        m.part(h, 0.08, 1.2, 0.08, METAL, W / 4, 0.25 + H + 0.9, 0, false);
        m.lit(h, 0.18, 0.18, 0.18, 0xff3e5e, W / 4, 0.25 + H + 1.55, 0);
        return { W, D, H, top: 0.25 + H + 0.3, door: 0, win: wins, flat: true };
    },
};

// ---------- El plano ----------
// V: el pueblo (Village): sus cajas (part, lit, bake...), su geometría (geo, reach) y las casas de
// los mercaderes (houses, con su parcela lot). Deja en V lo que setTown necesita
export function layoutTown(V) {
    const geos = Object.values(V.geo), mother = geos.find((q) => q.def.mother), streets = geos.filter((q) => !q.def.mother);
    const deg = (a) => (a * 180) / Math.PI, P = (a, r) => ({ x: VILLAGE.cx + Math.cos(a) * r, z: VILLAGE.cz + Math.sin(a) * r });
    const polarOf = (x, z) => { const dx = x - VILLAGE.cx, dz = z - VILLAGE.cz; return { r: Math.hypot(dx, dz), a: Math.atan2(dz, dx), dx, dz }; };
    const face = (x, z) => Math.atan2(VILLAGE.cx - x, VILLAGE.cz - z);
    const fh = (q, t) => V.furrowHalf(q, Math.max(t, q.parkR));
    const R = VILLAGE.R;

    // --- La ronda: asfalto con su raya y aceras; donde el claro se acaba antes, hacia dentro
    const RING = 31.5, wobR = (a) => Math.min(RING + Math.sin(a * 3 + RING) * 1.3 + Math.sin(a * 5 - RING * 0.7) * 0.6, V.reach(deg(a)) - 3.4);
    V.ringAt = wobR;
    const onStreet = (a, r, mg) => streets.some((q) => near(a, q.a) * r < (q.half || 2) + mg);
    const ring = (V.ringG = new THREE.Group());
    ring.visible = false;
    V.root.add(ring);
    const nR = Math.round((Math.PI * 2 * RING) / 0.8);
    for (let i = 0; i < nR; i++) {
        const a = (i / nR) * Math.PI * 2, r = wobR(a), p = P(a, r), th = i % 2 ? 0.12 : 0.126;
        V.part(ring, 2.6, th, 0.96, i % 2 ? 0x54545a : 0x4e4e54, p.x, th / 2, p.z, false).rotation.y = -a;
        if (i % 3 === 0 && !onStreet(a, r, 0.5)) V.part(ring, 0.1, 0.13, 0.5, 0xf3e6c4, p.x, 0.066, p.z, false).rotation.y = -a;
        for (const sd of [-1, 1]) { const q = P(a, r + sd * 1.65); if (!onStreet(a, r + sd * 1.65, 0.3)) V.part(ring, 0.7, 0.18, 0.98, 0xc8c0b0, q.x, 0.09, q.z, false).rotation.y = -a; }
    }
    V.bake([ring], []);
    V.cars = [[0xc8402e, 0.5, 1], [0x3a8ad8, 2.6, -1], [0xffd23f, 4.4, 1], [0x7dff4a, 1.4, -1]].map(([col, a, dir]) => {
        const c = new THREE.Group();
        V.part(c, 1.0, 0.44, 1.8, col, 0, 0.42, 0);
        V.part(c, 0.84, 0.36, 1.0, 0x9fdcff, 0, 0.8, -0.12);
        V.part(c, 0.9, 0.08, 1.04, col, 0, 1.0, -0.12);
        for (const x of [-0.5, 0.5]) for (const z of [-0.58, 0.58]) V.part(c, 0.14, 0.34, 0.34, 0x2e2a28, x, 0.17, z, false);
        V.part(c, 0.05, 0.5, 0.05, METAL, 0.3, 1.25, -0.5, false);
        V.lit(c, 0.14, 0.14, 0.14, 0x7dff4a, 0.3, 1.52, -0.5);
        for (const x of [-0.3, 0.3]) V.lit(c, 0.2, 0.14, 0.04, 0xfff0a0, x, 0.48, 0.92);
        c.visible = false;
        V.root.add(c);
        V.bake([c], []);
        return { g: c, a, dir, v: 0.12 + Math.random() * 0.05 };
    });

    // --- Las zonas prohibidas (por modo: plaza, street, town, house) y lo ya puesto
    const grid = new Grid(3), foot = (V.foot = []);
    const zoneOK = (x, z, mode) => {
        const { r, a, dx, dz } = polarOf(x, z);
        if (r > V.reach(deg(a)) - 2.2) return false;
        if (mode === 'plaza') return r < R - 0.5;
        if (r < R + 1.6) return mode === 'street' && r > R - 0.6;
        if (r > 10.9 && r < 12.9) return false; // (la calle de alrededor de la plaza)
        if (Math.abs(r - wobR(a)) < 2.05) return false; // (la ronda y sus aceras)
        for (const q of streets) {
            const c = Math.cos(q.a), s = Math.sin(q.a), t = dx * c + dz * s, side = Math.abs(-dx * s + dz * c);
            if (t < R - 1 || t > q.endR + 1) continue;
            const w = fh(q, t);
            // (el surco y sus montones de tierra a los lados; detrás, la franja de farolas y bancos)
            if (side < w + (t > R + 1.2 ? 1.4 : 0.5)) return false;
            if (mode !== 'street' && side < w + 2.45) return false;
        }
        { const c = Math.cos(mother.a), s = Math.sin(mother.a), t = dx * c + dz * s; if (t > R - 1 && t < mother.padR && Math.abs(-dx * s + dz * c) < 3.6) return false; }
        if (Math.hypot(x - mother.pad.x, z - mother.pad.z) < VILLAGE.impact + 0.8) return false;
        return true;
    };
    const fits = (F, mode, gap = 0.35, sep = 0) => {
        for (const p of obbPoints(F)) if (!zoneOK(p.x, p.z, mode)) return false;
        if (grid.hits(F, gap)) return false;
        if (sep && grid.within(F.x, F.z, sep, F.id)) return false;
        return true;
    };
    const block = (F) => { grid.add(F); foot.push(F); return F; };
    // (lo fijo: las parcelas de las casas de los mercaderes, sus puestos en la plaza y la hoguera)
    for (const q of streets) { const H = V.houses[q.def.id]; block(footAt({ cx: 0, cz: 0.3, hx: 1.8, hz: 1.8 }, H.lot.x, H.lot.z, H.lot.ry, 'merchant-house')); }
    for (const q of geos) block(footAt({ cx: 0, cz: 0, hx: 1.3, hz: 0.9 }, q.stall.x, q.stall.z, face(q.stall.x, q.stall.z), 'stall'));
    const fire = P(VILLAGE.fire.angle * RAD, VILLAGE.fire.r);
    block(footAt({ cx: 0, cz: 0, hx: 0.7, hz: 0.7 }, fire.x, fire.z, 0, 'fire', true));

    // --- Los sitios de los objetos (regiones): cada pieza, medida y puesta solo si cabe
    V.regions = {};
    const reg = (id, lv) => {
        const list = (V.regions[id] = V.regions[id] || []);
        let e = list.find((q) => q.lv === lv);
        if (!e) {
            e = { lv, g: new THREE.Group(), anims: [], keep: [], shapes: [], on: false };
            e.g.visible = false;
            V.root.add(e.g);
            list.push(e);
        }
        return e;
    };
    const sizes = new Map();
    const sizeOf = (name, v, args) => {
        const key = `${name}|${v}|${args.join(',')}`;
        if (!sizes.has(key)) sizes.set(key, measure(V, (g) => PIECES[name].build(V, g, v, () => {}, ...args)));
        return sizes.get(key);
    };
    let seq = 0;
    // Pone la pieza name (variante v) del objeto id, del nivel lv, en x, z, girada ry (si cabe:
    // mode, gap y sep, la distancia mínima a otra igual). Devuelve su huella o null
    const put = (id, lv, name, v, x, z, ry, { mode = 'town', gap = 0.35, sep = 0, args = [], check = true } = {}) => {
        const M = sizeOf(name, v, args), F = footAt(M, x, z, ry, id, !!PIECES[name].round);
        if (check && !fits(F, mode, gap, sep)) return null;
        block(F);
        const e = reg(id, lv), g = new THREE.Group(), ph = rnd(++seq) * 10;
        g.position.set(x, 0, z);
        g.rotation.y = ry;
        PIECES[name].build(V, g, v, (o, fn) => { e.anims.push({ o, fn, ph }); e.keep.push(o); }, ...args);
        e.g.add(g);
        e.shapes.push({ x: F.x, z: F.z, hx: Math.max(M.hx, M.wx * 0.8), hz: Math.max(M.hz, M.wz * 0.8), ry, h: M.h, round: !!PIECES[name].round });
        return F;
    };
    // (una pieza pegada a otra cosa, sin mirar si cabe: lo de las casas)
    const attach = (id, lv, name, v, base, lx, ly, lz, lry = 0) => {
        const e = reg(id, lv), g = new THREE.Group(), c = new THREE.Group(), ph = rnd(++seq) * 10;
        g.position.set(base.x, 0, base.z);
        g.rotation.y = base.ry;
        c.position.set(lx, ly, lz);
        c.rotation.y = lry;
        g.add(c);
        PIECES[name].build(V, c, v, (o, fn) => { e.anims.push({ o, fn, ph }); e.keep.push(o); });
        e.g.add(g);
        const cs = Math.cos(base.ry), sn = Math.sin(base.ry);
        e.shapes.push({ x: base.x + lx * cs + lz * sn, z: base.z - lx * sn + lz * cs, hx: 0.6, hz: 0.6, ry: base.ry, h: ly + 1 });
    };

    // --- La plaza: la fuente en el centro; en los huecos entre los puestos, una cosa en cada uno; un
    // corro de parterres alrededor de la fuente (repartidos por igual) y guirnaldas de poste a poste
    const angs = MERCHANTS.map((d) => d.angle * RAD).sort((p, q) => p - q);
    const gaps = angs.map((a, i) => { const b = i + 1 < angs.length ? angs[i + 1] : angs[0] + Math.PI * 2; return { a0: a, a1: b, mid: (a + b) / 2, half: (b - a) / 2 }; });
    const fireGap = gaps.find((g) => near(g.mid, VILLAGE.fire.angle * RAD) < g.half);
    put('fountain', 0, 'fountain', 0, VILLAGE.cx, VILLAGE.cz, 0, { mode: 'plaza' });
    const spots = gaps.filter((g) => g !== fireGap);
    ['statue', 'trophy', 'cone', 'signpost', 'telescope', 'tree', 'discoball'].forEach((id, i) => {
        const g0 = spots[i % spots.length];
        for (const r of [6.0, 6.3, 5.7, 6.6]) { const p = P(g0.mid, r); if (put(id, 0, id, 0, p.x, p.z, face(p.x, p.z), { mode: 'plaza', gap: 0.3 })) break; }
    });
    const NB = 10;
    for (let i = 0; i < NB; i++) { const a = (i / NB) * Math.PI * 2 + 0.31, p = P(a, 3.95); put('flowers', 0, 'flowers', i % 5, p.x, p.z, face(p.x, p.z), { mode: 'plaza', gap: 0.05, check: false }); }
    // Las guirnaldas: postes por el borde de la plaza (fuera de los puestos) y bombillas que se
    // encienden a ratos, de poste a poste
    {
        const e = reg('lights', 0), g = new THREE.Group();
        e.g.add(g);
        const bulbs = [new THREE.Group(), new THREE.Group()];
        for (const b of bulbs) g.add(b);
        for (const g0 of gaps) {
            const pad = 1.9 / 8.9, a0 = g0.a0 + pad, a1 = g0.a1 - pad, n = Math.max(1, Math.round(((a1 - a0) * 8.9) / 3.0)), pts = [];
            for (let i = 0; i <= n; i++) {
                const p = P(a0 + ((a1 - a0) * i) / n, 8.9), F = footAt({ cx: 0, cz: 0, hx: 0.2, hz: 0.2 }, p.x, p.z, 0, 'lights');
                if (!fits(F, 'plaza', 0.2)) { pts.push(null); continue; }
                block(F);
                const pole = new THREE.Group();
                pole.position.set(p.x, 0, p.z);
                PIECES.lightPole.build(V, pole, 0);
                g.add(pole);
                pts.push(p);
                e.shapes.push({ x: p.x, z: p.z, hx: 0.3, hz: 0.3, ry: 0, h: 3 });
            }
            for (let i = 0; i < n; i++) {
                const A = pts[i], B = pts[i + 1];
                if (!A || !B) continue;
                for (let j = 1; j < 7; j++) { const t = j / 7; V.lit(bulbs[j % 2], 0.2, 0.22, 0.2, [0xffe03a, 0xff6a5a, 0x7dff4a, 0x6ac8ff][(i + j) % 4], lerp(A.x, B.x, t), 2.85 - Math.sin(t * Math.PI) * 0.5, lerp(A.z, B.z, t)); }
            }
        }
        e.anims.push({ o: bulbs[0], fn: (o, t) => (o.visible = Math.sin(t * 2.4) > -0.5), ph: 0 }, { o: bulbs[1], fn: (o, t) => (o.visible = Math.sin(t * 2.4 + 2) > -0.5), ph: 0 });
        e.keep.push(...bulbs);
    }
    // Los setos: un anillo por fuera de la calle de la plaza, entre las calles (de varias formas)
    // (y, a lo largo de la ronda por dentro y por fuera, tramos de seto donde quepan: se ponen
    // después de las casas)
    const hedgeRing = () => {
        for (const side of [-1, 1]) for (let a = 0, k = 0; a < Math.PI * 2; k++) {
            const r = wobR(a) + side * 2.7, p = P(a, r);
            if (put('hedges', TOWN.ring, 'hedges', k % 4, p.x, p.z, face(p.x, p.z), { gap: 0.1 })) a += 1.85 / r; else a += 0.9 / r;
        }
    };
    // (y, desde el principio, tramos de seto por el borde de la plaza, entre las calles que entran)
    for (const g0 of gaps) {
        for (let a = g0.a0, k = 0; a < g0.a1; k++) {
            let ok = false;
            for (const r of [10.15, 9.85, 10.45]) { const p = P(a, r); if (put('hedges', 0, 'hedges', k % 4, p.x, p.z, face(p.x, p.z), { mode: 'street', gap: 0.1 })) { ok = true; break; } }
            a += (ok ? 1.9 : 0.35) / 10.15;
        }
    }

    // --- Los sectores de fuera de la ronda: los dos junto a la nave madre, salvajes; los demás,
    // residenciales y de campo, alternos
    // (por fuera, según el sitio que hay: los dos más amplios, residenciales; los dos siguientes, de
    // campo; el resto, salvajes. Por dentro: junto a la nave madre, parque; los demás, chalets y
    // adosados alternos)
    const sectors = gaps.map((g0) => {
        let area = 0;
        for (let k = 0; k <= 8; k++) { const a = lerp(g0.a0, g0.a1, k / 8); area += Math.max(0, V.reach(deg(a)) - 2.5 - (wobR(a) + 2.2)); }
        return { ...g0, area: (area / 9) * g0.half * 2 };
    });
    [...sectors].sort((p, q) => q.area - p.area).forEach((S, i) => (S.kind = i < 3 ? 'res' : i < 5 ? 'farm' : 'wild'));
    sectors.forEach((S) => (S.inner = near(S.a0, mother.a) < 0.01 || near(S.a1, mother.a) < 0.01 ? 'park' : 'chalet'));
    const sectorOf = (a) => sectors.find((S) => near(a, S.mid) <= S.half + 1e-6) || sectors[0];
    const zoneOf = (x, z) => { const { r, a } = polarOf(x, z); return r < wobR(a) - 2 ? 'in' : sectorOf(a).kind; };

    // --- Candidatos repartidos (como un muestreo de puntos sin amontonar): para cada cosa, una
    // tanda de puntos al azar fijo en su zona
    const cand = (seed, n, want) => {
        const out = [];
        for (let t = 0; t < n; t++) {
            const a = rnd(seed * 7.3 + t * 2.9) * Math.PI * 2, r = 15 + Math.sqrt(rnd(seed * 3.1 + t * 4.3)) * Math.max(0, V.reach(deg(a)) - 16), p = P(a, r);
            if (want(p.x, p.z)) out.push(p);
        }
        return out;
    };
    // La calle más cercana a un punto: hacia dónde (ux, uz) y a qué distancia de su acera
    const nearestRoad = (x, z) => {
        const { r, a, dx, dz } = polarOf(x, z), sg = Math.sign(wobR(a) - r) || 1;
        let best = { ux: Math.cos(a) * sg, uz: Math.sin(a) * sg, d: Math.abs(wobR(a) - r) - 1.65 };
        if (r < 14) best = { ux: -Math.cos(a), uz: -Math.sin(a), d: r - 12.9 };
        for (const q of streets) {
            const c = Math.cos(q.a), sn = Math.sin(q.a), t = dx * c + dz * sn, side = -dx * sn + dz * c;
            if (t < R || t > q.endR) continue;
            const d = Math.abs(side) - fh(q, t) - 0.6;
            if (d < best.d) best = { ux: sn * Math.sign(side), uz: -c * Math.sign(side), d };
        }
        return best;
    };
    const toRoad = (p) => { const R0 = nearestRoad(p.x, p.z); return Math.atan2(R0.ux, R0.uz); };

    // --- Los regalos de la nave madre, alrededor de su plataforma
    {
        let i = 0;
        for (let dd = VILLAGE.impact + 3; dd < VILLAGE.impact + 11 && i < EXCLUSIVE.length; dd += 1.2) {
            for (let k = 0; k < 28 && i < EXCLUSIVE.length; k++) {
                const b = ((k * 11) % 28) / 28 * Math.PI * 2, x = mother.pad.x + Math.cos(b) * dd, z = mother.pad.z + Math.sin(b) * dd;
                if (put(EXCLUSIVE[i].id, 0, EXCLUSIVE[i].id, 0, x, z, face(x, z), { gap: 0.8 })) i++;
            }
        }
    }

    // (los puestos de la calle del mercado: la del primero, con la calle ya asfaltada)
    {
        const mk = streets.find((q) => q.def.id === 'm0'), c = Math.cos(mk.a), s = Math.sin(mk.a);
        for (let t = mk.parkR + 4, i = 0; t < mk.endR - 2.5; t += 3.0, i++) for (const sd of [-1, 1]) {
            const off = (fh(mk, t) + 3.4) * sd, x = VILLAGE.cx + c * t - s * off, z = VILLAGE.cz + s * t + c * off;
            put('stand', TOWN.first, 'stand', i % 4, x, z, Math.atan2(s * sd, -c * sd), { mode: 'house', gap: 0.3 });
        }
    }
    const homes = [], lanes = [];
    // --- Las casas de los barrios: chalets dentro de la ronda (nivel 7), adosados en hilera junto a
    // la ronda por fuera (8) y pisos más allá (9), en los sectores residenciales; cada una de cara a
    // su calle, con su camino
    // (las medidas de cada casa: se dibuja una vez de prueba, y se recuerda)
    const dims = new Map();
    const dimsOf = (kind, k) => {
        const key = `${kind}|${k}`;
        if (!dims.has(key)) { const tmp = new THREE.Group(); dims.set(key, HOUSES[kind](V, tmp, k)); tmp.traverse((o) => o.geometry && o.geometry.dispose()); }
        return dims.get(key);
    };
    const house = (kind, lv, p, k, face = null) => {
        // (de cara a su calle: la que se le da, face (hacia dónde mira y a qué distancia está su
        // acera), o la más cercana)
        const R0 = face || nearestRoad(p.x, p.z), ry = Math.atan2(R0.ux, R0.uz), info = dimsOf(kind, k);
        const M = { cx: 0, cz: 0, hx: info.W / 2 + 0.3, hz: info.D / 2 + 0.3 };
        const F = footAt(M, p.x, p.z, ry, 'house');
        if (!fits(F, 'house', kind === 'chalet' ? 0.9 : 0.7)) return null;
        // (su camino hasta la calle, si no está pegada)
        const len = R0.d - info.D / 2 - 0.3;
        let L0 = null;
        if (len > 0.4) {
            const dx = R0.ux, dz = R0.uz, from = info.D / 2 + 0.3, mid = from + len / 2;
            L0 = footAt({ cx: 0, cz: 0, hx: 0.4, hz: len / 2 - 0.2 }, p.x + dx * mid, p.z + dz * mid, ry, 'lane');
            if (len > 7 || grid.hits(L0, 0.1)) return null;
        }
        block(F);
        if (L0) { block(L0); lanes.push({ x: p.x, z: p.z, ux: R0.ux, uz: R0.uz, from: info.D / 2 + 0.3, len, lv }); }
        const h = { kind, lv, k, x: p.x, z: p.z, ry, F, d: polarOf(p.x, p.z).r };
        homes.push(h);
        return h;
    };
    let hk = 0;
    const build = (kind, lv, max, seed, want) => { let n = 0; for (const p of cand(seed, 5000, want)) { if (n >= max) break; if (house(kind, lv, p, hk)) { n++; hk++; } } };
    const LV = { chalet: TOWN.houses[0], row: TOWN.houses[1], block: TOWN.houses[2] };
    // (el tipo de casa en un punto: dentro de la ronda, el del sector; fuera, pisos en los residenciales)
    const kindAt = (x, z) => {
        const S = sectorOf(polarOf(x, z).a), { r, a } = polarOf(x, z);
        if (zoneOf(x, z) === 'in') return S.inner === 'park' ? null : S.inner;
        return S.kind === 'res' ? (r < wobR(a) + 9 ? 'row' : 'block') : null;
    };
    // Las casas de cara a las calles: a los dos lados de cada una, una tras otra, con su fachada a la
    // acera (dejando la franja de farolas y bancos)
    for (const q of streets) {
        if (q.def.id === 'm0') continue; // (la calle del mercado: sus puestos)
        const c = Math.cos(q.a), sn = Math.sin(q.a);
        for (const sd of [-1, 1]) {
            for (let t = q.parkR + 3.2; t < q.endR - 1.5;) {
                const probe = { x: VILLAGE.cx + c * t - sn * (fh(q, t) + 4) * sd, z: VILLAGE.cz + sn * t + c * (fh(q, t) + 4) * sd };
                const kind = kindAt(probe.x, probe.z);
                if (!kind) { t += 1.5; continue; }
                const info = dimsOf(kind, hk), off = (Math.max(fh(q, t), fh(q, t + info.W)) + 2.6 + info.D / 2) * sd, m = t + info.W / 2;
                const p = { x: VILLAGE.cx + c * m - sn * off, z: VILLAGE.cz + sn * m + c * off };
                if (kindAt(p.x, p.z) === kind && house(kind, LV[kind], p, hk, { ux: sn * sd, uz: -c * sd, d: info.D / 2 + 1.9 })) { hk++; t += info.W + 1.0; }
                else t += 1.2;
            }
        }
    }
    // Y de cara a la ronda: por dentro (mirando afuera) y por fuera (mirando adentro)
    for (const side of [-1, 1]) {
        for (let a = 0; a < Math.PI * 2;) {
            const r0 = wobR(a), probe = P(a, r0 + side * 5), kind = kindAt(probe.x, probe.z);
            if (!kind) { a += 1.2 / r0; continue; }
            const info = dimsOf(kind, hk), r = r0 + side * (2.7 + info.D / 2), am = a + info.W / 2 / r, p = P(am, wobR(am) + side * (2.7 + info.D / 2));
            if (kindAt(p.x, p.z) === kind && house(kind, LV[kind], p, hk, { ux: -Math.cos(am) * side, uz: -Math.sin(am) * side, d: info.D / 2 + 1.0 })) { hk++; a += (info.W + 1.0) / r; }
            else a += 1.0 / r0;
        }
    }
    // (los barrios, por sectores: dentro de la ronda, chalets o adosados según el sector; fuera, en
    // los residenciales, los pisos)
    const innerOf = (x, z) => zoneOf(x, z) === 'in' && sectorOf(polarOf(x, z).a).inner;
    // (y alguna más por dentro de las manzanas, donde quepa)
    build('chalet', TOWN.houses[0], 4, 4242, (x, z) => innerOf(x, z) === 'chalet');
    build('row', TOWN.houses[1], 4, 5252, (x, z) => kindAt(x, z) === 'row');
    build('block', TOWN.houses[2], 10, 6363, (x, z) => kindAt(x, z) === 'block');

    // --- Por las calles: banderas a la entrada; a los dos lados farolas, maceteros, bancos,
    // mobiliario, buzones y jardineras; una parada de autobús y, al final, una valla
    const busyLot = (x, z) => streets.some((q) => { const L0 = V.houses[q.def.id].lot; return Math.hypot(L0.x - x, L0.z - z) < 3.9; });
    streets.forEach((q, si) => {
        const c = Math.cos(q.a), s = Math.sin(q.a);
        const at = (t, sd, extra = 0) => { const off = (fh(q, t) + 1.9 + extra) * sd; return { x: VILLAGE.cx + c * t - s * off, z: VILLAGE.cz + s * t + c * off }; };
        const look = (sd) => Math.atan2(s * sd, -c * sd);
        for (const sd of [-1, 1]) { const p = at(R + 0.3, sd, -1.3); put('banner', 0, 'flag', si % 4, p.x, p.z, look(sd), { mode: 'street', gap: 0.1 }); }
        { const p = at(q.endR - 2.6, -1, 0.6); put('billboard', 0, 'billboard', si % 4, p.x, p.z, look(-1), { mode: 'street', gap: 0.2 }); }
        let bus = false;
        for (let j = 0, t = q.parkR + 3.0; t < q.endR - 1.4; j++, t += 2.2) {
            for (const sd of [-1, 1]) {
                const p = at(t, sd);
                if (busyLot(p.x, p.z)) continue;
                const o = { mode: 'street', gap: 0.2 };
                if (sd > 0 && !bus && j > 0) { const b = at(t, sd, 0.4); if (put('busstop', 0, 'busstop', si % 2, b.x, b.z, look(sd), o)) { bus = true; continue; } }
                // (cada lado con su ritmo: una farola cada tres huecos y, entre medias, lo demás)
                const SEQ = sd > 0 ? ['lamp', 'planter', 'bench', 'lamp', 'flowerbox', 'hydrant'] : ['mailbox', 'lamp', 'flowerbox', 'bench', 'lamp', 'planter'];
                const what = SEQ[(j + si) % 6], ID = { lamp: 'lamps', planter: 'planters', bench: 'bench', flowerbox: 'windowbox', hydrant: 'hydrant', mailbox: 'mailbox' }[what];
                put(ID, 0, what, (j + si) % PIECES[what].n, p.x, p.z, look(sd), o);
            }
        }
    });
    // (las farolas de la ronda, por fuera, con la ronda)
    for (let a = 0; a < Math.PI * 2; a += 8 / RING) {
        const r = wobR(a) + 2.4, p = P(a, r);
        if (onStreet(a, r, 2)) continue;
        const F = footAt(sizeOf('lamp', 0, []), p.x, p.z, face(p.x, p.z), 'lamps');
        if (grid.hits(F, 0.2)) continue;
        put('lamps', TOWN.ring, 'lamp', 0, p.x, p.z, face(p.x, p.z), { check: false });
    }

    hedgeRing();
    // --- Lo grande del pueblo: gasolinera junto a la ronda, molinos,
    // parques, heladerías, terrazas, parcelas del campo, camping...
    const fill = (id, name, n, zones, { variants = PIECES[name].n, sep = 0, gap = 0.4, turn = null, extra = () => true, seed = 0 } = {}) => {
        const s0 = (id.split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) % 997) + seed, out = [];
        for (const p of cand(s0, 4000, (x, z) => zones.includes(zoneOf(x, z)) && extra(x, z))) {
            if (out.length >= n) break;
            const ry = turn ? turn(p) : rnd(s0 + out.length * 1.7 + p.x) * Math.PI * 2;
            const F = put(id, 0, name, (out.length + s0) % variants, p.x, p.z, ry, { gap, sep });
            if (F) out.push({ ...p, ry, F });
        }
        return out;
    };
    const ringNear = (d) => (x, z) => { const { r, a } = polarOf(x, z); return Math.abs(r - wobR(a)) < d; };
    // En grupos: n grupos de hasta per piezas alrededor de su centro (un camping, un campo de
    // cristales, un corro de setas, una arboleda, las figuras de un jardín...); cada pieza prueba
    // unos sitios cerca del centro; un grupo vale con dos o más. Si faltan, sueltas (min)
    const group = (id, name, n, per, rad, zones, { sep = 12, gap = 0.3, face = false, min = 0 } = {}) => {
        const s0 = id.split('').reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) % 997;
        let made = 0, v = s0, total = 0;
        for (const p of cand(s0 + 77, 3000, (x, z) => zones.includes(zoneOf(x, z)) && zoneOK(x, z, 'town'))) {
            if (made >= n) break;
            if (grid.within(p.x, p.z, sep, id)) continue;
            const mine = [];
            for (let i = 0; i < per; i++) {
                for (let k = 0; k < 4; k++) {
                    const a = (i / per) * Math.PI * 2 + rnd(s0 + made * 3 + k) * 1.2, d = rad * (0.55 + rnd(i * 5 + k + made * 7) * 0.6), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
                    const ry = face ? Math.atan2(p.x - x, p.z - z) : rnd(v + k) * 6.3;
                    const M = sizeOf(name, v % PIECES[name].n, []), F = footAt(M, x, z, ry, id, !!PIECES[name].round);
                    if (!fits(F, 'town', gap)) continue;
                    mine.push({ x, z, ry, v: v % PIECES[name].n });
                    grid.add(F); // (apartado mientras se decide el grupo)
                    F.tmp = true;
                    break;
                }
                v++;
            }
            // (se quitan los apartados y, si el grupo vale, se ponen de verdad)
            for (const list of grid.map.values()) for (let q = list.length - 1; q >= 0; q--) if (list[q].tmp) list.splice(q, 1);
            grid.all = grid.all.filter((F) => !F.tmp);
            if (mine.length < Math.min(2, per)) continue;
            for (const m0 of mine) if (put(id, 0, name, m0.v, m0.x, m0.z, m0.ry, { gap: 0.05 })) total++;
            made++;
        }
        if (total < min) fill(id, name, min - total, zones, { gap, seed: 31 });
    };
    fill('gas', 'gas', 1, ['res', 'farm'], { turn: toRoad, extra: ringNear(8) });
    fill('mill', 'mill', 3, ['farm', 'wild'], { sep: 10 });
    fill('swings', 'swings', 4, ['in'], { sep: 9 });
    fill('kiosk', 'kiosk', 3, ['in'], { sep: 9, turn: toRoad, extra: (x, z) => nearestRoad(x, z).d < 4 });
    group('parasols', 'parasols', 2, 3, 1.9, ['in'], { sep: 10 , min: 3 });
    const plots = [...fill('orchards', 'orchards', 4, ['farm'], { sep: 5, gap: 0.8 }), ...fill('gardens', 'gardens', 5, ['farm', 'in', 'wild', 'res'], { sep: 5, gap: 0.8 }), ...fill('pumpkins', 'pumpkins', 4, ['farm', 'wild'], { sep: 5, gap: 0.8 })];
    group('tents', 'tents', 2, 3, 3.0, ['wild', 'farm'], { sep: 16, face: true , min: 2 });
    fill('sheds', 'sheds', 5, ['farm', 'res'], { sep: 6, turn: toRoad });
    fill('dish', 'dish', 2, ['farm', 'wild'], { sep: 10 });
    group('stand', 'stand', 1, 3, 2.6, ['in', 'res', 'farm'], { sep: 12, face: true, min: 2 }); // (un mercadillo suelto: se ve antes que la calle del mercado)
    fill('well', 'well', 3, ['in', 'farm'], { sep: 10 });

    // --- Lo pequeño, repartido: árboles por todas partes, plantas, figuras, aves, pajareros,
    // pacas, espantapájaros, cristales, setas, mercancías
    group('woods', 'woods', 7, 5, 3.4, ['wild', 'farm', 'res', 'in'], { sep: 9 , min: 24 });
    fill('woods', 'woods', 18, ['in', 'res', 'farm', 'wild'], { sep: 3.2, gap: 0.3, seed: 5 });
    group('haystacks', 'haystacks', 3, 3, 2.2, ['farm'], { sep: 10 , min: 4 });
    fill('scarecrow', 'scarecrow', 6, ['farm'], { sep: 5, extra: (x, z) => grid.within(x, z, 4.5, 'gardens') || grid.within(x, z, 4.5, 'pumpkins') });
    group('crystal', 'crystal', 2, 5, 2.6, ['wild', 'in', 'res'], { sep: 14 , min: 4 });
    group('mushrooms', 'mushrooms', 2, 6, 2.4, ['wild', 'farm', 'in', 'res'], { sep: 14 , min: 4 });
    group('shrubs', 'shrubs', 4, 3, 1.8, ['in', 'wild', 'res'], { sep: 8 , min: 6 });
    fill('crates', 'crates', 6, ['res', 'farm'], { sep: 4, extra: (x, z) => grid.within(x, z, 5, 'sheds') || grid.within(x, z, 6, 'house') });
    group('gnome', 'gnome', 3, 4, 1.6, ['in', 'res'], { sep: 9, gap: 0.2, face: true , min: 6 });
    group('flamingo', 'flamingo', 3, 3, 1.4, ['in', 'farm', 'wild'], { sep: 9, gap: 0.2 , min: 5 });
    group('birdbath', 'birdbath', 3, 3, 1.6, ['in', 'farm', 'wild'], { sep: 9, gap: 0.25 , min: 4 });
    for (const p of plots) put('fences', 0, 'fences', 0, p.x, p.z, p.ry, { check: false, args: [p.F.hx * 2 + 0.5, p.F.hz * 2 + 0.5] });

    // --- Los barrios dibujados: un grupo por nivel y, dentro, por tandas de distancia (al subir de
    // nivel salen en ola desde el centro); en cada casa, buzón, jardineras y (algunas) parabólica
    V.homeG = {};
    V.homeBands = {};
    for (const lv of TOWN.houses) {
        const g = (V.homeG[lv] = new THREE.Group()), mine = homes.filter((h) => h.lv === lv);
        g.visible = false;
        V.root.add(g);
        const d0 = Math.min(...mine.map((h) => h.d), 99), d1 = Math.max(...mine.map((h) => h.d), 100) + 0.01;
        V.homeBands[lv] = Array.from({ length: 6 }, () => { const b = { g: new THREE.Group(), shapes: [] }; g.add(b.g); return b; });
        for (const h of mine) h.band = V.homeBands[lv][Math.min(5, Math.floor(((h.d - d0) / (d1 - d0)) * 6))];
    }
    V.doors = [];
    for (const h of homes) {
        const g = new THREE.Group();
        g.position.set(h.x, 0, h.z);
        g.rotation.y = h.ry;
        const info = HOUSES[h.kind](V, g, h.k);
        h.band.g.add(g);
        h.band.shapes.push({ x: h.x, z: h.z, hx: info.W / 2 + 0.2, hz: info.D / 2 + 0.2, ry: h.ry, h: info.top + 0.6 });
        const cs = Math.cos(h.ry), sn = Math.sin(h.ry), fz = info.D / 2 + 0.6;
        V.doors.push({ x: h.x + info.door * cs + fz * sn, z: h.z - info.door * sn + fz * cs, lv: h.lv, nx: sn, nz: cs });
        // (lo de cada casa: buzón junto al camino, jardinera bajo sus ventanas y, en algunas, la parabólica)
        attach('mailbox', h.lv, 'mailbox', h.k % 3, h, info.W / 2 - 0.3, 0, info.D / 2 + 0.7);
        for (const [wx, wy] of info.win.slice(0, 4)) attach('windowbox', h.lv, 'windowbox', h.k % 3, h, wx, wy - 0.4, info.D / 2 + 0.14);
        if (h.k % 3 === 0 || h.kind === 'block') attach('dish', h.lv, 'roofDish', 0, h, -info.W / 4, info.top - (info.flat ? 0 : 0.4), info.flat ? 0 : -info.D / 5);
    }
    for (const L0 of lanes) {
        const h = homes.find((q) => q.x === L0.x && q.z === L0.z);
        V.part(h.band.g, 0.8, 0.1, L0.len, 0xd8c8a0, L0.x + L0.ux * (L0.from + L0.len / 2), 0.05, L0.z + L0.uz * (L0.from + L0.len / 2), false).rotation.y = Math.atan2(L0.ux, L0.uz);
    }
    for (const list of Object.values(V.homeBands)) for (const b of list) V.bake([b.g], []);
    // (lo de las casas de los mercaderes también: buzón, jardineras y parabólica, con su casa)
    for (const q of streets) {
        const H = V.houses[q.def.id], lv = TOWN.firstIds.includes(q.def.id) ? TOWN.first : TOWN.all;
        attach('mailbox', lv, 'mailbox', 0, H.lot, 2.0, 0, 1.6);
        for (const x of [-0.9, 0.9]) attach('windowbox', lv, 'windowbox', 0, H.lot, x, 1.06, 1.36);
        attach('dish', lv, 'roofDish', 0, H.lot, -0.2, 2.8, 0.7);
    }

    // --- Los arcos de bienvenida (nivel 10), a la entrada de cada calle (al llegar al pueblo)
    V.archG = new THREE.Group();
    V.archG.visible = false;
    V.root.add(V.archG);
    V.archShapes = [];
    for (const q of streets) {
        // (por fuera de la ronda, donde la calle ya es estrecha: dentro, junto a la plaza, es tan
        // ancha que el arco se ve como una viga larguísima)
        const out = wobR(q.a) + 3.6, t = out < q.endR - 1 ? out : q.parkR + 1.6, p = P(q.a, t), a = new THREE.Group(), w = (fh(q, t) + 0.7) * 2;
        a.position.set(p.x, 0, p.z);
        a.rotation.y = Math.atan2(-Math.cos(q.a), -Math.sin(q.a));
        V.archPiece(a, w);
        V.archG.add(a);
        V.archShapes.push({ x: p.x, z: p.z, hx: w / 2 + 0.6, hz: 0.6, ry: a.rotation.y, h: 3.6 });
    }
    V.bake([V.archG], []);
    V.ringShape = { donut: true, r: RING, w: 2.3, h: 2.5 };

    // Cada sitio, junto (lo que se mueve, aparte)
    for (const list of Object.values(V.regions)) for (const e of list) {
        V.bake([e.g], e.keep);
        // (y lo que se mueve, junto por dentro: cada subgrupo por su lado, sin tocar lo animado)
        const moving = new Set(e.anims.map((a) => a.o)), groups = [];
        for (const k of e.keep) if (!k.isMesh) k.traverse((o) => { if (!o.isMesh) groups.push(o); });
        for (const g of groups) bakeGroup(g, (o) => !o.isMesh || moving.has(o));
    }
    V.homes = homes;
    V.sectors = sectors;

}

// Comprueba que nada se pisa: devuelve los pares de huellas que se solapan (vacío: todo bien)
export function auditTown(V) {
    const out = [], g = new Grid(3);
    for (const F of V.foot) {
        const B = g.hits(F, -0.05);
        if (B && !(F.id === 'fences' || B.id === 'fences')) out.push(`${F.id} ~ ${B.id} @ ${F.x.toFixed(1)},${F.z.toFixed(1)}`);
        g.add(F);
    }
    return out;
}
