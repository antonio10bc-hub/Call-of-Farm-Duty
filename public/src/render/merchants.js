import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { box, mergeBoxes, bakeRigid } from './materials.js';
import { MERCHANTS, VILLAGE, TOWN, polar, pavedIn } from '../content/merchants.js';
import { CROPS } from '../content/crops.js';
import { layoutTown, auditTown } from './town.js';

// El pueblo de los mercaderes: el cráter grande del centro de su zona (donde montan sus puestos y
// se va llenando de lo que les compras), los siete surcos que llegan hasta él (cada uno lo dejó la
// nave de un mercader al estrellarse), los árboles tumbados a sus lados, la hoguera y el claro de
// la nave madre. Cada mercader (Visitor) llega en su ovni disfrazado de vehículo por su surco; la
// nave madre (Mother) baja en vertical sobre su claro.
// Las ventanas de las casas de la ampliación, en tres grupos que apagan la luz a horas distintas
const WINDOW_OFF = { 0xffe18b: 0.8, 0xffe28c: 0.93 };
const WOOD = 0x9a6a3a, WOOD2 = 0x7a4f2a, DARK = 0x5a3a22, STONE = 0x9a948a;
const DIRT = [0x8a5a34, 0x76492a, 0x9a6a3a], TRENCH = [0x5a3a22, 0x4a2e1a];
const METAL = 0x9aa8b8, METAL2 = 0x7a8898, HULL = 0x4a5868, GLASS = 0x9fdcff, CARD = 0xe8d8b0;
const RUBBER = 0xe0a860; // las gomas de las caretas
// La llegada, paso a paso (s): vuela hasta el principio del surco, lo recorre pegado al suelo, se
// posa, baja la rampa, sale él, va a su puesto y monta la mercancía
const T = { fly: 2.2, glide: 4.8, land: 5.2, ramp: 5.7, out: 7.6, open: 8.1 };
const ease = (k) => k * k * (3 - 2 * k);
const out = (k) => 1 - (1 - k) * (1 - k);
const back = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
const RAMP = { closed: -1.45, open: 0.78, len: 1.5 };
const HOVER = 0.62; // altura del ovni "conduciendo" por el surco
const RAD = Math.PI / 180;

// La geometría de cada mercader: su surco (de start a park, hacia el centro), dónde aparca, su
// puesto y lo ancho que es su ovni. reach(grados): hasta dónde llega la zona en esa dirección
export function villageGeometry(reach) {
    const R = VILLAGE.R;
    return Object.fromEntries(MERCHANTS.map((def) => {
        const a = def.angle * RAD, c = Math.cos(a), s = Math.sin(a);
        const stall = polar(VILLAGE.stall, def.angle);
        if (def.mother) {
            const r = Math.max(R + 8, Math.min(VILLAGE.pad, reach(def.angle) - 10));
            return [def.id, { def, a, dir: [-c, -s], pad: polar(r, def.angle), padR: r, stall, half: 6 }];
        }
        const sc = def.len / 4.9, half = 1.95 * sc + 0.3; // (medio ancho del ovni)
        const parkR = R + 1.1 + half, endR = Math.max(parkR + 9, reach(def.angle) - 2.5);
        return [def.id, { def, a, dir: [-c, -s], sc, half, parkR, endR, park: polar(parkR, def.angle), start: polar(endR, def.angle), stall }];
    }));
}

// La parcela de la casa de cada mercader (fases 2 y 3): junto a su calle, un poco más allá de
// donde aparca, a su derecha, de cara a la calle
export function houseLot(g) {
    const t = g.parkR + 5.5, c = Math.cos(g.a), s = Math.sin(g.a), off = furrowHalf(g, t) + 3.2;
    return { x: VILLAGE.cx + c * t - s * off, z: VILLAGE.cz + s * t + c * off, ry: Math.atan2(s, -c), r: 2.6 };
}

// Lo ancho del surco a una distancia r del centro: estrecho donde tocó tierra, ancho donde se paró
export const furrowHalf = (g, r) => lerp(g.half + 0.4, 0.8, Math.min(1, Math.max(0, (r - g.parkR) / Math.max(1, g.endR - g.parkR))));

// ---------- Piezas comunes ----------
// Un alienígena disfrazado de humano: gabardina, pantalón, zapatos y sombrero (con las antenas
// asomando); la cabeza de su color, enorme, con una careta plana de cara humana y su goma
export function buildAlien(m, SKIN, COAT, HAT) {
    const g = new THREE.Group(), COAT2 = new THREE.Color(COAT).multiplyScalar(0.78).getHex();
    for (const x of [-0.11, 0.11]) {
        m.part(g, 0.15, 0.42, 0.17, 0x3a3a4a, x, 0.26, 0);
        m.part(g, 0.18, 0.12, 0.26, 0x2a1a0e, x, 0.06, 0.04);
    }
    m.part(g, 0.5, 0.66, 0.32, COAT, 0, 0.8, 0);
    m.part(g, 0.52, 0.07, 0.34, COAT2, 0, 0.66, 0);
    m.part(g, 0.08, 0.5, 0.02, COAT2, 0, 0.82, 0.17, false);
    for (const y of [0.72, 0.9]) m.part(g, 0.05, 0.05, 0.02, 0xd9b04a, 0.07, y, 0.17, false);
    m.part(g, 0.16, 0.12, 0.3, SKIN, 0, 1.17, 0);
    g.arm = new THREE.Group();
    g.arm.position.set(0.32, 1.05, 0);
    m.part(g.arm, 0.13, 0.46, 0.14, COAT, 0, -0.23, 0);
    m.part(g.arm, 0.11, 0.12, 0.11, SKIN, 0, -0.5, 0, false);
    g.add(g.arm);
    m.part(g, 0.13, 0.46, 0.14, COAT, -0.32, 0.82, 0);
    m.part(g, 0.11, 0.12, 0.11, SKIN, -0.32, 0.55, 0, false);
    m.part(g, 0.5, 0.46, 0.44, SKIN, 0, 1.45, 0);
    const mask = new THREE.Group();
    mask.position.set(0, 1.43, 0.24);
    g.add(mask);
    g.mask = mask;
    for (const x of [-0.11, 0.11]) m.part(g, 0.12, 0.14, 0.02, 0x0a0a0c, x, 1.47, 0.225, false);
    m.part(mask, 0.36, 0.4, 0.03, 0xf3c8a0, 0, 0, 0);
    for (const x of [-0.08, 0.08]) {
        m.part(mask, 0.05, 0.05, 0.02, 0x2a1a0e, x, 0.06, 0.02, false);
        m.part(mask, 0.09, 0.02, 0.02, 0x6a3a22, x, 0.12, 0.02, false);
        m.part(mask, 0.06, 0.04, 0.02, 0xff9fb0, x * 1.4, -0.03, 0.02, false);
    }
    m.part(mask, 0.18, 0.04, 0.02, 0x6a3a22, 0, -0.06, 0.02, false);
    g.smile = m.part(mask, 0.12, 0.025, 0.02, 0xc8402e, 0, -0.12, 0.02, false);
    for (const s of [-1, 1]) m.part(g, 0.03, 0.04, 0.44, 0x2a2a2a, s * 0.26, 1.45, 0, false);
    m.part(g, 0.52, 0.04, 0.03, 0x2a2a2a, 0, 1.45, -0.23, false);
    m.part(g, 0.66, 0.05, 0.62, HAT, 0, 1.7, 0);
    m.part(g, 0.4, 0.22, 0.38, HAT, 0, 1.83, 0);
    m.part(g, 0.42, 0.05, 0.4, 0xc8402e, 0, 1.75, 0, false);
    for (const x of [-0.1, 0.1]) {
        m.part(g, 0.03, 0.26, 0.03, SKIN, x, 2.05, 0, false);
        m.part(g, 0.08, 0.08, 0.08, 0xffe03a, x, 2.2, 0, false);
    }
    // De fiesta (las visitas raras): gorro de cumpleaños y bufanda dorada
    g.party = new THREE.Group();
    g.add(g.party);
    [[0.32, 0xff5ab8], [0.24, 0x5af0ff], [0.16, 0xffe03a], [0.08, 0xff5ab8]].forEach(([w, c], i) => m.part(g.party, w, 0.14, w, c, 0, 2.0 + i * 0.14, 0));
    m.part(g.party, 0.12, 0.12, 0.12, 0xffffff, 0, 2.6, 0);
    m.part(g.party, 0.56, 0.1, 0.36, 0xffcc33, 0, 1.24, 0);
    g.party.visible = false;
    return g;
}

// La careta de cartón de cada vehículo, de perfil (el morro hacia -x), de unos 4.8 de largo:
// side: +1 o -1 (las hay a los dos lados del ovni, que llega en cualquier dirección)
function vehicleMask(m, b, kind, side) {
    const g = new THREE.Group();
    g.position.set(0, 0, 2.08 * side);
    if (side < 0) g.rotation.y = Math.PI;
    b.add(g);
    // (cada pieza un pelo por delante de la anterior: en la careta todo está en el mismo plano)
    let n = 0;
    const P = (w, h, x, y, c, z = 0, out = true) => m.part(g, w, h, 0.06, c, side < 0 ? -x : x, y, z + n++ * 0.004, out);
    const wheel = (x, r = 0.95, y = 0.42) => {
        P(r, r, x, y, 0x2a2624, 0.06);
        const w2 = P(r, r, x, y, 0x2a2624, 0.06);
        w2.rotation.z = Math.PI / 4;
        P(r * 0.4, r * 0.4, x, y, 0xb8b8c0, 0.1, false);
    };
    const win = (w, h, x, y) => P(w, h, x, y, 0x9fdcff, 0.04, false);
    switch (kind) {
        case 'car': {
            P(4.9, 0.95, 0, 0.82, CARD, -0.03); P(2.8, 0.85, 0.25, 1.62, CARD, -0.03);
            P(4.8, 0.85, 0, 0.82, 0xd8402e); P(2.6, 0.75, 0.25, 1.6, 0xd8402e);
            win(1.05, 0.5, -0.42, 1.62); win(1.05, 0.5, 0.88, 1.62);
            P(0.22, 0.2, -2.33, 0.95, 0xffe680, 0.04, false); P(0.16, 0.2, 2.35, 0.95, 0xff3e1a, 0.04, false);
            wheel(-1.5); wheel(1.5);
            break;
        }
        case 'bus': {
            P(4.95, 2.0, 0, 1.3, CARD, -0.03);
            P(4.85, 1.9, 0, 1.3, 0xf0c030); P(4.78, 0.18, 0, 0.62, 0x2a3a5a, 0.02, false);
            for (let k = 0; k < 5; k++) win(0.66, 0.6, -1.6 + k * 0.85, 1.72);
            win(0.5, 1.2, -2.15, 1.3); P(0.9, 0.3, -1.9, 2.08, 0x2a2624, 0.04, false); // la puerta y el cartel de la línea
            P(0.5, 0.16, -1.9, 2.1, 0xffe03a, 0.06, false);
            wheel(-1.6); wheel(1.6);
            break;
        }
        case 'mini': {
            P(4.7, 1.0, 0, 0.82, CARD, -0.03); P(2.9, 0.95, 0.15, 1.65, CARD, -0.03);
            P(4.6, 0.9, 0, 0.82, 0x6ac8ff); P(2.7, 0.85, 0.15, 1.62, 0xf6f3ea);
            win(1.1, 0.55, -0.45, 1.62); win(1.0, 0.55, 0.8, 1.62);
            P(0.36, 0.36, -2.2, 0.98, 0xffe680, 0.04, false); P(1.6, 0.12, 0, 1.0, 0xf6f3ea, 0.04, false);
            wheel(-1.55, 1.05); wheel(1.55, 1.05);
            break;
        }
        case 'icecream': {
            P(4.95, 1.95, 0, 1.25, CARD, -0.03);
            P(4.85, 1.85, 0, 1.25, 0xf6f3ea); P(4.78, 0.3, 0, 0.55, 0xff8ab8, 0.02, false);
            win(0.9, 0.6, -1.85, 1.55); P(2.0, 0.8, 0.6, 1.45, 0x3a2a2a, 0.03, false); P(2.1, 0.18, 0.6, 1.9, 0xff8ab8, 0.05, false); // la ventanilla de los helados
            for (let k = 0; k < 4; k++) P(0.5, 0.12, -0.1 + k * 0.5, 1.95, k % 2 ? 0xff8ab8 : 0xffffff, 0.06, false);
            P(0.5, 0.7, 1.4, 2.6, 0xd8a04a); P(0.7, 0.45, 1.4, 3.1, 0xffb8d8); // el cucurucho del techo
            wheel(-1.6); wheel(1.6);
            break;
        }
        case 'truck': {
            P(4.95, 2.15, 0.45, 1.35, CARD, -0.03);
            P(1.5, 1.6, -1.65, 1.05, 0xe8702a); win(0.8, 0.6, -1.8, 1.45);
            P(3.3, 2.0, 0.8, 1.3, 0x8a98b8); for (let k = 0; k < 4; k++) P(0.08, 1.8, -0.4 + k * 0.8, 1.3, 0x6a7898, 0.04, false);
            P(1.6, 0.5, 0.8, 1.5, 0xffd23f, 0.05, false); // el cartel (dice «MAÍZ», más o menos)
            wheel(-1.7); wheel(0.6); wheel(1.7);
            break;
        }
        case 'camper': {
            P(4.95, 1.9, 0.1, 1.25, CARD, -0.03); P(1.5, 0.6, -1.4, 2.3, CARD, -0.03);
            P(4.85, 1.8, 0.1, 1.25, 0xe8dcc0); P(1.4, 0.55, -1.4, 2.28, 0xe8dcc0);
            P(4.78, 0.22, 0.1, 0.95, 0x6a4a2a, 0.03, false);
            win(0.8, 0.55, -1.85, 1.5); win(0.9, 0.5, 0.4, 1.55); win(0.9, 0.5, 1.6, 1.55);
            P(0.5, 1.0, -0.6, 1.0, 0x8a6a4a, 0.045, false); // (la puerta, delante de la franja)
            wheel(-1.5); wheel(1.6);
            break;
        }
        case 'tractor': {
            P(3.6, 1.2, -0.4, 1.0, CARD, -0.03);
            P(2.4, 0.9, -0.9, 1.0, 0x4a9a3a); P(1.4, 1.5, 0.9, 1.6, 0x4a9a3a); win(0.9, 0.9, 0.9, 1.75);
            P(0.16, 0.9, -1.4, 1.85, 0x3a3a3a, 0.03); // el tubo de escape (por delante de la carrocería)
            wheel(-1.6, 0.9); wheel(1.3, 1.8, 0.9);
            break;
        }
        default: break;
    }
}

// Un ovni con su careta de vehículo: platillo, cúpula, luces, gomas y la rampa por el frente (-x)
function buildShip(m, kind) {
    const g = new THREE.Group(), b = new THREE.Group();
    g.add(b);
    g.body = b;
    m.part(b, 3.2, 0.28, 3.2, METAL2, 0, 0.5, 0);
    m.part(b, 3.8, 0.2, 3.8, METAL, 0, 0.72, 0);
    m.part(b, 2.7, 0.28, 2.7, METAL, 0, 0.95, 0);
    m.part(b, 1.8, 0.22, 1.8, HULL, 0, 0.28, 0);
    m.part(b, 1.5, 0.8, 1.5, GLASS, 0, 1.45, 0);
    m.part(b, 1.0, 0.18, 1.0, 0xc4ecff, 0, 1.92, 0, false);
    g.lights = [];
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.lights.push(m.part(b, 0.2, 0.15, 0.2, k % 2 ? 0xffe03a : 0xff3e5e, Math.sin(a) * 1.78, 0.72, Math.cos(a) * 1.78, false));
    }
    vehicleMask(m, b, kind, 1);
    vehicleMask(m, b, kind, -1);
    // Las gomas: de lado a lado, por delante y por detrás del platillo
    for (const x of [-1.6, 1.6]) m.part(b, 0.08, 0.08, 4.2, RUBBER, x, 0.86, 0, false);
    m.part(b, 0.08, 0.08, 4.2, RUBBER, 0, 1.55, 0, false);
    g.ramp = new THREE.Group();
    g.ramp.position.set(-1.75, 0.55, 0);
    b.add(g.ramp);
    m.part(g.ramp, RAMP.len, 0.08, 0.9, METAL2, -RAMP.len / 2, 0, 0);
    for (let k = 0; k < 4; k++) m.part(g.ramp, 0.06, 0.04, 0.8, HULL, -0.25 - k * 0.35, 0.05, 0, false);
    g.hatch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.8), new THREE.MeshBasicMaterial({ color: 0x7dff4a }));
    m.own(g.hatch.material);
    g.hatch.position.set(-1.62, 0.78, 0);
    b.add(g.hatch);
    return g;
}

// El puesto: mesa con la mercancía (de su cultivo favorito) y farolillo; con la confianza crece:
// 2 toldo de su color, 3 cartel, 4 banderines, 5 alfombra. Mira al centro del cráter (+z local)
function buildStall(m, def) {
    const g = new THREE.Group(), lv = [];
    for (const [dx, dz] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) m.part(g, 0.08, 0.7, 0.08, 0x6a6a72, dx, 0.35, 0.9 + dz, false);
    m.part(g, 1.3, 0.08, 0.8, 0xf3ead2, 0, 0.72, 0.9);
    const goods = new THREE.Group();
    goods.position.set(0, 0.76, 0.9);
    const c = CROPS[def.fav] ? CROPS[def.fav].loot || 0xffd23f : 0xffd23f;
    m.part(goods, 0.36, 0.3, 0.3, WOOD2, -0.35, 0.15, 0);
    for (const [x, z] of [[-0.42, -0.04], [-0.28, 0.06]]) m.part(goods, 0.14, 0.14, 0.14, c, x, 0.36, z, false);
    m.part(goods, 0.3, 0.3, 0.3, 0xe0c060, 0.15, 0.15, 0.05);
    for (const x of [0.4, 0.52]) m.part(goods, 0.1, 0.18, 0.1, 0x7dff4a, x, 0.09, -0.1);
    g.add(goods);
    g.goods = goods;
    m.part(g, 0.1, 1.9, 0.1, WOOD2, 0.95, 0.95, 0.5);
    g.lamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), new THREE.MeshBasicMaterial({ color: 0x8a7a5a }));
    m.own(g.lamp.material);
    g.lamp.position.set(0.95, 1.75, 0.75);
    g.add(g.lamp);
    const L = () => {
        const q = new THREE.Group();
        g.add(q);
        lv.push(q);
        return q;
    };
    const awn = L(), sign = L(), flags = L(), rug = L();
    const tint = def.coat;
    for (const [dx, dz] of [[-0.85, 0.3], [0.85, 0.3], [-0.85, 1.4], [0.85, 1.4]]) m.part(awn, 0.08, 2.0, 0.08, WOOD2, dx, 1.0, dz);
    for (let i = 0; i < 5; i++) m.part(awn, 0.36, 0.08, 1.3, i % 2 ? 0xfff3d6 : tint, -0.72 + i * 0.36, 2.04, 0.85);
    m.part(sign, 1.6, 0.42, 0.08, WOOD, 0, 2.4, 1.5);
    m.part(sign, 0.3, 0.3, 0.04, def.skin, -0.55, 2.4, 1.55, false);
    for (let i = 0; i < 3; i++) m.part(sign, 0.16, 0.2, 0.03, 0x2a1a0e, -0.15 + i * 0.25, 2.4, 1.56, false);
    for (let i = 0; i < 5; i++) m.part(flags, 0.18, 0.22, 0.04, [0xff5ab8, 0x5af0ff, 0xffe03a, 0x7dff4a, 0xff8a3a][i], -0.7 + i * 0.35, 1.82 - Math.sin((i / 4) * Math.PI) * 0.2, 1.42, false);
    m.part(rug, 1.8, 0.03, 1.1, def.skin, 0, 0.02, 1.9, false);
    m.part(rug, 1.4, 0.035, 0.7, 0xffcc33, 0, 0.025, 1.9, false);
    g.levels = lv;
    return g;
}

// ¡Trato hecho! Da dos saltos girando, se le cae la careta (se le ve la cara de alienígena), la
// caza al vuelo y se la vuelve a poner. Devuelve si sigue bailando
function dealDance(v, dt) {
    if (v.deal < 0) return false;
    v.deal += dt;
    const t = v.deal, m = v.man, M = m.mask;
    const hop = (a, b) => (t > a && t < b ? Math.sin(((t - a) / (b - a)) * Math.PI) : 0);
    m.position.y = hop(0, 0.45) * 0.55 + hop(0.5, 0.95) * 0.75;
    m.rotation.y = v.manRy + (t < 0.95 ? (t / 0.95) * Math.PI * 2 : 0);
    m.arm.rotation.z = 2.6 + Math.sin(t * 22) * 0.4;
    const k = t < 0.55 ? 0 : t < 1.25 ? (t - 0.55) / 0.7 : 0;
    M.position.set(0, 1.43 + Math.sin(k * Math.PI) * 0.7, 0.24 + Math.sin(k * Math.PI) * 0.25);
    M.rotation.set(k * Math.PI * 4, 0, Math.sin(k * Math.PI) * 0.6);
    if (t > 1.45) {
        v.deal = -1;
        m.position.y = 0;
        m.rotation.y = v.manRy;
        M.position.set(0, 1.43, 0.24);
        M.rotation.set(0, 0, 0);
    }
    return true;
}

// Lo común de los dos tipos de mercader: la sombra que anuncia su llegada (herald), el bocadillo
// de cuando charla con otro (bubble) y sus visitas a otros puestos (trip)
function addExtras(v, size) {
    const mat = v.own(new THREE.MeshBasicMaterial({ color: 0x1a120a, transparent: true, opacity: 0.3, depthWrite: false }));
    v.herald = new THREE.Mesh(new THREE.BoxGeometry(size, 0.02, size * 0.8), mat);
    v.herald.position.y = 0.06;
    v.herald.visible = false;
    v.root.add(v.herald);
    v.soon = 0;
    const b = new THREE.Group();
    b.position.set(0, 2.75, 0);
    v.part(b, 0.62, 0.36, 0.06, 0xffffff, 0, 0, 0);
    v.part(b, 0.12, 0.12, 0.06, 0xffffff, -0.14, -0.22, 0, false);
    for (const x of [-0.16, 0, 0.16]) v.part(b, 0.08, 0.08, 0.04, 0x2a1a0e, x, 0, 0.04, false);
    b.visible = false;
    v.man.add(b);
    v.bubble = b;
    v.trip = null;
}
// La sombra que anuncia la llegada: va y viene por su camino, cada vez más oscura
function updateHerald(v, time) {
    const on = v.soon > 0 && !v.present && v.step === 0;
    v.herald.visible = on;
    if (!on) return;
    const k = (time * 0.22) % 1, p = v.heraldAt(k);
    v.herald.position.set(p.x, 0.06, p.z);
    v.herald.rotation.y = -v.geo.a;
    v.herald.material.opacity = (0.12 + 0.3 * v.soon) * Math.sin(k * Math.PI);
    v.herald.scale.setScalar(v.def.mother ? 1 + k * 2 : 1);
}
// Visitas a otro puesto: va andando hasta él, charla un rato (con su bocadillo) y vuelve al suyo
function updateTrip(v, dt, time) {
    const T0 = v.trip, m = v.man;
    if (!T0) return false;
    T0.t += dt;
    const home = v.geo.stall, walk = Math.hypot(T0.to.x - home.x, T0.to.z - home.z) / 1.6, stay = 4.5;
    let k, face;
    if (T0.t < walk) { k = T0.t / walk; face = Math.atan2(T0.to.x - home.x, T0.to.z - home.z); }
    else if (T0.t < walk + stay) { k = 1; face = Math.atan2(T0.look.x - T0.to.x, T0.look.z - T0.to.z); }
    else if (T0.t < walk * 2 + stay) { k = 1 - (T0.t - walk - stay) / walk; face = Math.atan2(home.x - T0.to.x, home.z - T0.to.z); }
    else {
        v.trip = null;
        v.bubble.visible = false;
        m.position.set(home.x, 0, home.z);
        m.rotation.y = v.stall.rotation.y;
        return false;
    }
    const e = ease(k), moving = T0.t < walk || T0.t > walk + stay;
    m.position.set(lerp(home.x, T0.to.x, e), moving ? Math.abs(Math.sin(T0.t * 9)) * 0.06 : 0, lerp(home.z, T0.to.z, e));
    m.rotation.y = face;
    v.bubble.visible = !moving && Math.sin(time * 3) > -0.3;
    m.arm.rotation.z = !moving ? 0.6 + Math.sin(time * 6) * 0.4 : 0.1;
    return true;
}

// ---------- Un mercader: su ovni, él y su puesto ----------
export class Visitor extends VoxelModel {
    constructor(outline, geo) {
        super(outline);
        this.geo = geo;
        this.def = geo.def;
        const r = this.root, d = this.def;
        this.stall = buildStall(this, d);
        this.stall.position.set(geo.stall.x, 0, geo.stall.z);
        this.stall.rotation.y = Math.atan2(-Math.cos(geo.a), -Math.sin(geo.a));
        r.add(this.stall);
        this.ship = buildShip(this, d.vehicle);
        this.ship.scale.setScalar(geo.sc);
        this.ship.rotation.y = -geo.a;
        r.add(this.ship);
        this.man = buildAlien(this, d.skin, d.coat, d.hat);
        r.add(this.man);
        // (lo fijo de cada cosa, junto)
        this.bake([this.ship.body], [this.ship.ramp, this.ship.hatch, ...this.ship.lights]);
        this.bake([this.stall, ...this.stall.levels], [this.stall.goods, this.stall.lamp, ...this.stall.levels]);
        this.deal = -1;
        this.step = 0;
        this.want = 0;
        this.dust = new THREE.Vector3();
        addExtras(this, Math.max(2.4, 3.4 * geo.sc));
        this.setLevel(1);
        this.pose(0);
    }

    get present() {
        return this.want > 0;
    }

    get open() {
        return this.step >= T.open;
    }

    // Antes de llegar: su sombra recorre el surco (soon: 0..1, lo cerca que está)
    heraldAt(k) {
        const G = this.geo;
        return { x: lerp(G.start.x, G.park.x, k), z: lerp(G.start.z, G.park.z, k) };
    }

    get gliding() {
        return this.step > T.fly && this.step < T.land && this.step !== this.want;
    }

    setPresent(on, animate = true) {
        this.want = on ? T.open : 0;
        if (animate) return;
        this.step = this.want;
        this.pose(this.step);
    }

    setRare(on) {
        this.man.party.visible = !!on;
    }

    setLevel(lv) {
        this.stall.levels.forEach((g, i) => (g.visible = lv >= i + 2));
    }

    setMood(mood) {
        this.mood = mood;
        this.man.smile.scale.set(mood === 'serious' ? 0.6 : 1, mood === 'serious' ? 0.6 : mood === 'happy' ? 1.6 : 1, 1);
    }

    // Dónde está su puesto (para la cámara y su cartel)
    get spot() {
        return this.geo.stall;
    }

    pose(t) {
        const G = this.geo, [ix, iz] = G.dir, u = this.ship, sc = G.sc;
        u.visible = t > 0.02;
        const kf = seg(t, 0, T.fly), kg = seg(t, T.fly, T.glide), kl = seg(t, T.glide, T.land);
        // Vuela desde fuera (más allá del principio del surco, en alto) hasta el principio, bajando
        const from = { x: G.start.x - ix * 10, y: 18, z: G.start.z - iz * 10 };
        let x = lerp(from.x, G.start.x, out(kf)), z = lerp(from.z, G.start.z, out(kf)), y = lerp(from.y, HOVER * sc, ease(kf));
        if (kf >= 1) {
            x = lerp(G.start.x, G.park.x, out(kg));
            z = lerp(G.start.z, G.park.z, out(kg));
            y = HOVER * sc + Math.abs(Math.sin((x + z) * 2.3)) * 0.06 * (1 - kg) - 0.12 * ease(kl);
        }
        u.position.set(x, y, z);
        u.rotation.z = -0.25 * (1 - kf) * kf * 4;
        u.body.scale.set(1 + Math.sin(kl * Math.PI) * 0.06, 1 - Math.sin(kl * Math.PI) * 0.08, 1 + Math.sin(kl * Math.PI) * 0.06);
        const kr = seg(t, T.land, T.ramp);
        u.ramp.rotation.z = lerp(RAMP.closed, RAMP.open, ease(kr));
        u.hatch.visible = kr > 0.05;
        // Él: baja por la rampa y va a su puesto
        const ko = seg(t, T.ramp, T.out), m = this.man, S = G.stall;
        m.visible = t > T.ramp;
        const k1 = (1.75 + 0.1) * sc, k2 = (1.75 + RAMP.len * Math.cos(RAMP.open)) * sc;
        const top = { x: G.park.x + ix * k1, y: HOVER * sc - 0.12 + 0.55 * sc, z: G.park.z + iz * k1 }, foot = { x: G.park.x + ix * k2, y: 0, z: G.park.z + iz * k2 };
        let mx, my, mz, face;
        if (ko < 0.3) {
            const k = ko / 0.3;
            mx = lerp(top.x, foot.x, k); my = lerp(top.y, foot.y, k); mz = lerp(top.z, foot.z, k);
            face = Math.atan2(ix, iz);
        } else {
            const k = ease((ko - 0.3) / 0.7);
            mx = lerp(foot.x, S.x, k); mz = lerp(foot.z, S.z, k); my = 0;
            face = ko < 0.97 ? Math.atan2(S.x - foot.x, S.z - foot.z) : this.stall.rotation.y;
        }
        const walking = ko > 0 && ko < 1;
        m.position.set(mx, my + (walking ? Math.abs(Math.sin(ko * 30)) * 0.06 : 0), mz);
        m.rotation.y = ko >= 1 ? this.stall.rotation.y : face;
        const kg2 = seg(t, T.out, T.open), gd = this.stall.goods;
        gd.visible = kg2 > 0;
        gd.scale.setScalar(kg2 > 0 ? Math.max(0.0001, back(kg2)) : 0.0001);
        this.dust.set(x - ix * 1.4 * sc, 0.1, z - iz * 1.4 * sc);
    }

    celebrate() {
        if (!this.man.visible || this.deal >= 0) return false;
        this.manRy = this.man.rotation.y;
        this.deal = 0;
        return true;
    }

    update(dt, time, nightK = 0) {
        if (this.step !== this.want) {
            this.step = this.want > this.step ? Math.min(this.want, this.step + dt) : Math.max(this.want, this.step - dt * 1.4);
            this.pose(this.step);
        }
        const on = this.present ? Math.max(0, Math.min(1, (nightK - 0.25) / 0.5)) : 0;
        this.stall.lamp.material.color.setHex(on > 0.1 ? 0xffe9a0 : 0x8a7a5a);
        const u = this.ship;
        if (u.visible) {
            u.lights.forEach((l, i) => (l.visible = nightK > 0.5 ? Math.sin(time * 3) > -0.6 : Math.sin(time * 8 + i * 0.8) > -0.2));
            if (this.step === this.want && this.open) u.body.position.y = Math.sin(time * 1.6 + this.geo.a) * 0.04;
        }
        updateHerald(this, time);
        if (this.trip && (!this.open || this.deal >= 0)) this.trip.t = 1e9; // (se acaba: vuelve a su sitio)
        if (dealDance(this, dt)) {
            // (bailando)
        } else if (updateTrip(this, dt, time)) {
            // (de visita)
        } else if (this.man.visible && this.open) {
            // Respira y saluda de vez en cuando; contento, además baila; serio, ni saluda
            const m = this.man, ph = this.geo.a * 3, dance = this.mood === 'happy' && Math.sin(time * 0.5 + ph) > 0.6;
            m.position.y = dance ? Math.abs(Math.sin(time * 8)) * 0.14 : Math.abs(Math.sin(time * 2 + ph)) * 0.02;
            m.rotation.y = this.stall.rotation.y + (dance ? Math.sin(time * 4) * 0.5 : 0);
            m.rotation.z = dance ? Math.sin(time * 8) * 0.08 : 0;
            m.arm.rotation.z = dance ? 2.6 + Math.sin(time * 16) * 0.4 : this.mood !== 'serious' && Math.sin(time * 0.8 + ph) > 0.7 ? 2.4 + Math.sin(time * 10) * 0.35 : 0.1;
            m.mask.rotation.x = this.mood === 'serious' ? 0.15 : 0;
        }
        this.updateFx(dt);
    }
}

// ---------- La nave madre ----------
// Una ciudad flotante: arriba, una isla fina de roca morada con musgo turquesa, setas que brillan,
// cúpula verde y su cartel de disfraz («PUEBLO NORMAL»); debajo, colgando, un racimo de torres con
// ventanas de colores, anillos, aletas, pasarelas y la gran aguja central; brazos de atraque con
// navecitas y un anillo de energía que gira. Baja en vertical sobre su claro y flota con la aguja
// casi tocando el suelo; de ella baja (en un rayo de luz) la embajadora, que va a su puesto
const DOWN = { fall: 4.5, beam: 6.0, walk: 9.5, open: 10.0 };
export class Mother extends VoxelModel {
    constructor(outline, geo) {
        super(outline);
        this.geo = geo;
        this.def = geo.def;
        const r = this.root, d = this.def;
        this.stall = buildStall(this, d);
        this.stall.position.set(geo.stall.x, 0, geo.stall.z);
        this.stall.rotation.y = Math.atan2(-Math.cos(geo.a), -Math.sin(geo.a));
        r.add(this.stall);
        this.ship = new THREE.Group();
        this.ship.position.set(geo.pad.x, 0, geo.pad.z);
        r.add(this.ship);
        this.body = new THREE.Group();
        this.ship.add(this.body);
        this.buildCity(this.body);
        this.man = buildAlien(this, d.skin, d.coat, d.hat);
        r.add(this.man);
        this.beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.2), new THREE.MeshBasicMaterial({ color: 0xb8ffb0, transparent: true, opacity: 0.35, depthWrite: false }));
        this.own(this.beam.material);
        this.beam.visible = false;
        r.add(this.beam);
        this.bake([this.body], [this.ring, this.spin]);
        this.bake([this.stall, ...this.stall.levels], [this.stall.goods, this.stall.lamp, ...this.stall.levels]);
        this.deal = -1;
        this.step = 0;
        this.want = 0;
        this.dust = new THREE.Vector3(geo.pad.x, 0.1, geo.pad.z);
        addExtras(this, 7);
        // De noche, un haz de luz verde hacia el cielo
        this.skyBeam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 140, 2.2), this.own(new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.18, depthWrite: false })));
        this.skyBeam.position.set(0, 20 + 70, 0);
        this.skyBeam.visible = false;
        this.ship.add(this.skyBeam);
        this.setLevel(1);
        this.pose(0);
    }

    heraldAt() {
        return this.geo.pad;
    }

    buildCity(b) {
        const P = (...a) => this.part(b, ...a);
        const glow = (g, w, h, d, c, x, y, z) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.glowMat(c));
            m.position.set(x, y, z);
            g.add(m);
            return m;
        };
        const MET = [0x5a6a7a, 0x6a7a8a, 0x4a5868], TRIM = 0x8a5ad8, WIN = [0x7dff4a, 0x5af0ff, 0xff7ae0], Y0 = 15;
        [[12, 0x6a4a8a], [10, 0x5a3a7a], [7.5, 0x4a3a5a]].forEach(([w, c], k) => {
            const y = Y0 + 1.6 - k * 0.8;
            P(w, 0.8, w, c, 0, y, 0);
            P(w * 0.86, 0.76, w * 0.86, c, 0, y - 0.01, 0).rotation.y = Math.PI / 4;
        });
        P(12.2, 0.4, 12.2, 0x3ac8b0, 0, Y0 + 2.2, 0);
        P(10.4, 0.46, 10.4, 0x5ad8c8, 0, Y0 + 2.23, 0).rotation.y = Math.PI / 4; // (algo más alto: sin caras en el mismo plano)
        for (const [x, z, s, c] of [[-4, -3, 1, 0xff7ae0], [-4.4, 2.6, 0.8, 0x5af0ff], [4.2, 3, 0.9, 0xffe03a], [3.4, -4, 1.1, 0xff7ae0], [-1, 4.4, 0.7, 0x7dff4a]]) {
            const y = Y0 + 2.4;
            P(0.35 * s, 1.8 * s, 0.35 * s, 0xd8c8f0, x, y + 0.9 * s, z);
            P(1.8 * s, 0.5 * s, 1.8 * s, 0x8a5ad8, x, y + 1.9 * s, z);
            glow(b, 1.2 * s, 0.3 * s, 1.2 * s, c, x, y + 2.25 * s, z);
        }
        const glass = new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.6 });
        this.own(glass);
        [[4.6, 0.9], [3.8, 0.9], [2.6, 0.8], [1.4, 0.6]].reduce((y, [w, h]) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), glass);
            m.position.set(0, y + h / 2, 0);
            b.add(m);
            return y + h;
        }, Y0 + 2.4);
        P(0.5, 5, 0.5, 0x8a98a8, 1.8, Y0 + 5, -1.6);
        for (let j = 0; j < 3; j++) glow(b, 0.5 - j * 0.1, 0.5 - j * 0.1, 0.5 - j * 0.1, WIN[j], 1.8, Y0 + 6 + j * 0.9, -1.6);
        P(0.3, 2, 0.3, 0x7a4f2a, -2, Y0 + 3.2, 5.6);
        P(5, 1.3, 0.14, 0xc8955a, -2, Y0 + 4.4, 5.7);
        for (let j = 0; j < 6; j++) P(0.45, 0.65, 0.05, 0xc8402e, -3.9 + j * 0.78, Y0 + 4.4, 5.8, false);
        P(11, 1.4, 11, MET[0], 0, Y0, 0);
        P(9.6, 1.5, 9.6, MET[0], 0, Y0, 0).rotation.y = Math.PI / 4;
        for (let j = 0; j < 20; j++) {
            const a = (j / 20) * Math.PI * 2;
            glow(b, 0.4, 0.4, 0.4, j % 2 ? TRIM : 0x5af0ff, Math.cos(a) * 5.6, Y0, Math.sin(a) * 5.6);
        }
        const towers = [[-3.8, -2.2, 2.2, 7], [3.4, -3.0, 1.9, 9], [-2.6, 3.4, 2.0, 8], [3.6, 2.6, 1.7, 6], [0, -4.4, 1.5, 5], [-4.6, 1.0, 1.3, 10], [1.6, 4.4, 1.4, 7.5], [4.8, -0.4, 1.2, 11], [-1.4, -3.6, 1.1, 12], [2.2, 0.6, 1.0, 4]];
        towers.forEach(([x, z, w, len], i) => {
            const top = Y0 - 0.7, bot = top - len, c = MET[i % 3];
            P(w, len, w, c, x, top - len / 2, z);
            for (let y = 1; y < len - 1; y += 1.3) glow(b, w * 0.5, 0.28, 0.06, WIN[(i + Math.round(y)) % 3], x, top - y, z + w / 2 + 0.03);
            for (let y = 2; y < len - 1; y += 3) P(w + 0.5, 0.3, w + 0.5, TRIM, x, top - y, z);
            if (i % 2 === 0) P(0.2, len * 0.5, 1.4, MET[2], x + w / 2 + 0.1, top - len * 0.4, z);
            P(w + 0.6, 1.0, w + 0.6, MET[1], x, bot - 0.4, z);
            P(w * 0.6, 0.7, w * 0.6, c, x, bot - 1.2, z);
            glow(b, 0.3, 0.3, 0.3, WIN[i % 3], x, bot - 1.7, z);
            if (i % 3 === 1) for (let j = 0; j < 3; j++) P(0.1, 1.6 + j * 0.6, 0.1, 0x3a2a4a, x + (j - 1) * 0.4, bot - 2.4 - j * 0.3, z + 0.3, false);
        });
        for (const [ax, az, bx, bz, y] of [[-3.8, -2.2, 3.4, -3, Y0 - 4], [-2.6, 3.4, 3.6, 2.6, Y0 - 3], [-4.6, 1, -2.6, 3.4, Y0 - 6], [3.4, -3, 4.8, -0.4, Y0 - 7], [0, -4.4, -1.4, -3.6, Y0 - 3.5]]) {
            const L = Math.hypot(bx - ax, bz - az), t = P(L, 0.4, 0.4, 0x8a98a8, (ax + bx) / 2, y, (az + bz) / 2);
            t.rotation.y = -Math.atan2(bz - az, bx - ax);
        }
        let y = Y0 - 0.7;
        [[3.4, 3, MET[1]], [2.8, 2, TRIM], [3.0, 3, MET[0]], [2.2, 2.5, MET[2]], [3.2, 1.6, MET[1]], [1.8, 2.4, MET[0]], [1.1, 2, MET[2]], [0.6, 1.8, 0x8a98a8]].forEach(([w, h, c], k) => {
            P(w, h, w, c, 0, y - h / 2, 0);
            P(w * 0.9, h * 0.94, w * 0.9, c, 0, y - h / 2, 0).rotation.y = Math.PI / 4;
            if (k % 2 === 0) for (let j = 0; j < 4; j++) {
                const a = (j / 4) * Math.PI * 2 + k;
                glow(b, 0.3, 0.3, 0.3, WIN[(j + k) % 3], Math.cos(a) * w * 0.55, y - h / 2, Math.sin(a) * w * 0.55);
            }
            if (k === 3) for (const s of [-1, 1]) P(1.4, 1.8, 1.4, MET[0], s * 2.2, y - 1, 0);
            y -= h;
        });
        this.tip = y - 0.4; // (la punta de la aguja, desde el suelo de la nave)
        glow(b, 0.6, 0.6, 0.6, 0x7dff4a, 0, this.tip, 0);
        for (const [a, yy] of [[0.3, Y0 - 2], [2.4, Y0 - 5], [4.2, Y0 - 1], [5.4, Y0 - 7]]) {
            const x = Math.cos(a), z = Math.sin(a);
            P(4.5, 0.35, 0.35, 0x8a98a8, x * 7.4, yy, z * 7.4).rotation.y = -a;
            const s = new THREE.Group();
            s.position.set(x * 9.8, yy - 0.5, z * 9.8);
            s.rotation.y = -a;
            b.add(s);
            this.part(s, 2.2, 0.5, 1.3, 0xd8e0e8, 0, 0, 0);
            this.part(s, 1.1, 0.5, 0.8, 0x7dff9a, 0.2, 0.45, 0);
        }
        // El anillo de energía (gira; se agranda al despegar)
        this.ring = new THREE.Group();
        this.ring.position.y = Y0 - 6;
        this.ring.rotation.set(0.35, 0, 0.2);
        b.add(this.ring);
        this.spin = new THREE.Group();
        this.ring.add(this.spin);
        for (let j = 0; j < 48; j++) {
            const a = (j / 48) * Math.PI * 2;
            glow(this.spin, 0.8, 0.18, 0.18, j % 4 ? 0x7dff9a : 0xffffff, Math.cos(a) * 11, 0, Math.sin(a) * 11).rotation.y = -a + Math.PI / 2;
        }
    }

    glowMat(c) {
        this.glows = this.glows || new Map();
        let m = this.glows.get(c);
        if (!m) this.glows.set(c, (m = this.own(new THREE.MeshBasicMaterial({ color: c }))));
        return m;
    }

    get present() {
        return this.want > 0;
    }

    get open() {
        return this.step >= DOWN.open;
    }

    get gliding() {
        return false;
    }

    setPresent(on, animate = true) {
        this.want = on ? DOWN.open : 0;
        if (animate) return;
        this.step = this.want;
        this.pose(this.step);
    }

    setRare(on) {
        this.man.party.visible = !!on;
    }

    setLevel(lv) {
        this.stall.levels.forEach((g, i) => (g.visible = lv >= i + 2));
    }

    setMood(mood) {
        this.mood = mood;
        this.man.smile.scale.set(mood === 'serious' ? 0.6 : 1, mood === 'serious' ? 0.6 : mood === 'happy' ? 1.6 : 1, 1);
    }

    get spot() {
        return this.geo.stall;
    }

    // Baja del cielo en vertical (frenando) hasta flotar con la aguja casi en el suelo; la
    // embajadora baja en un rayo de luz y va andando a su puesto
    pose(t) {
        const G = this.geo, hover = -this.tip + 0.5, kf = seg(t, 0, DOWN.fall);
        this.ship.visible = t > 0.02;
        this.ship.position.y = lerp(hover + 70, hover, out(kf));
        const kb = seg(t, DOWN.fall, DOWN.beam), kw = seg(t, DOWN.beam, DOWN.walk), m = this.man, S = G.stall;
        this.beam.visible = kb > 0 && kb < 1;
        this.beam.scale.set(1, 0.6 + 0.4 * (1 - kb), 1);
        this.beam.position.set(G.pad.x, 0.6, G.pad.z);
        m.visible = kb > 0.4;
        if (kw <= 0) m.position.set(G.pad.x, lerp(1.2, 0, seg(kb, 0.4, 1)), G.pad.z);
        else {
            const k = ease(kw);
            m.position.set(lerp(G.pad.x, S.x, k), Math.abs(Math.sin(kw * 50)) * 0.06 * (kw < 1 ? 1 : 0), lerp(G.pad.z, S.z, k));
        }
        m.rotation.y = kw > 0 && kw < 1 ? Math.atan2(S.x - G.pad.x, S.z - G.pad.z) : this.stall.rotation.y;
        const kg = seg(t, DOWN.walk, DOWN.open), gd = this.stall.goods;
        gd.visible = kg > 0;
        gd.scale.setScalar(kg > 0 ? Math.max(0.0001, back(kg)) : 0.0001);
        this.lift = 1 - kf; // (subiendo o bajando: el anillo más grande y rápido)
    }

    celebrate() {
        return Visitor.prototype.celebrate.call(this);
    }

    update(dt, time, nightK = 0) {
        if (this.step !== this.want) {
            this.step = this.want > this.step ? Math.min(this.want, this.step + dt) : Math.max(this.want, this.step - dt * 1.4);
            this.pose(this.step);
        }
        if (this.ship.visible) {
            this.spin.rotation.y = time * (0.6 + this.lift * 3);
            this.spin.scale.setScalar(1 + this.lift * 0.3);
            this.body.position.y = Math.sin(time * 0.9) * 0.15;
        }
        this.stall.lamp.material.color.setHex(this.present && nightK > 0.35 ? 0xffe9a0 : 0x8a7a5a);
        this.skyBeam.visible = this.open && nightK > 0.45;
        if (this.skyBeam.visible) this.skyBeam.material.opacity = 0.12 + Math.sin(time * 2) * 0.05;
        updateHerald(this, time);
        if (this.trip && (!this.open || this.deal >= 0)) this.trip.t = 1e9;
        if (dealDance(this, dt)) {
            // (bailando)
        } else if (updateTrip(this, dt, time)) {
            // (de visita)
        } else if (this.man.visible && this.open) this.man.position.y = Math.abs(Math.sin(time * 2)) * 0.02;
        this.updateFx(dt);
    }
}

// ---------- El pueblo entero ----------
export class Village extends VoxelModel {
    // reach(grados): hasta dónde llega la zona en esa dirección (desde el centro)
    constructor(outline, reach) {
        super(outline);
        const r = this.root;
        this.geo = villageGeometry(reach);
        this.reach = reach;
        this.buildGround(r);
        this.buildFire(r);
        this.bake([r], [this.flames, this.fireGlow, ...Object.values(this.fallen || {})]);
        for (const f of Object.values(this.fallen || {})) this.bake([f], []);
        // El pueblo entero, con el sitio de todo (escondido hasta que toca)
        this.pops = [];
        this.buildLayout();
        // Los habitantes (se quedan a vivir con el pueblo crecido): alienígenas pequeños, también
        // disfrazados, que pasean por el cráter
        this.residents = [[0xffb07a, 0x5a8ac8, 0xd84a3a], [0x7ad8ff, 0xd8a03a, 0x3a3a4a], [0xff7ae0, 0x4a8a6a, 0xe8c050], [0x7dff4a, 0xc8402e, 0x2a3a5a], [0xc8a0ff, 0xf3e6c4, 0x5aa83a], [0xffe07a, 0x3a6ab8, 0xff7a2a], [0x5ae8c8, 0x8a4a8a, 0xffd23f], [0xff9a7a, 0x4a5a3a, 0x9fdcff], [0xb87dff, 0xe8c8a0, 0xc8402e]].map(([sk, co, ha], i) => {
            const a = buildAlien(this, sk, co, ha);
            bakeRigid(a); // (sus piezas juntas por grupo: el brazo se sigue moviendo)
            a.scale.setScalar(0.72);
            a.visible = false;
            r.add(a);
            return { g: a, x: VILLAGE.cx + 3 + i, z: VILLAGE.cz + 2, goal: null, wait: i, step: i };
        });
        this.visitT = 8;
        this.buildMarket();
        // Los mercaderes
        this.visitors = MERCHANTS.map((def) => {
            const v = def.mother ? new Mother(outline, this.geo[def.id]) : new Visitor(outline, this.geo[def.id]);
            v.root.traverse((o) => (o.userData.merchant = def.id));
            r.add(v.root);
            return v;
        });
        this.byId = Object.fromEntries(this.visitors.map((v) => [v.def.id, v]));
    }

    // El suelo de lo que dejaron los accidentes: el anillo del cráter (con huecos donde entran los
    // surcos y hacia la nave madre), cada surco con su tierra levantada a los lados y sus árboles
    // tumbados hacia fuera, quemaduras y piedras
    buildGround(r) {
        const R = VILLAGE.R, geos = Object.values(this.geo);
        const gap = (a) => geos.some((g) => {
            const d = Math.atan2(Math.sin(a - g.a), Math.cos(a - g.a));
            return Math.abs(d) < (g.def.mother ? 0.22 : Math.atan((g.half + 0.9) / (R + 0.6)));
        });
        const ring = 72;
        for (let k = 0; k < ring; k++) {
            const a = (k / ring) * Math.PI * 2;
            if (gap(a)) continue;
            const x = VILLAGE.cx + Math.cos(a) * (R + 0.6), z = VILLAGE.cz + Math.sin(a) * (R + 0.6), hh = 0.7 + ((k * 7) % 5) * 0.12;
            this.part(r, 1.2, hh, 1.0, DIRT[k % 3], x, hh / 2, z).rotation.y = -a;
            this.part(r, 0.9, 0.36, 0.8, DIRT[(k + 1) % 3], x + Math.cos(a) * 0.75, 0.18, z + Math.sin(a) * 0.75).rotation.y = -a;
            if (k % 4 === 0) this.part(r, 0.3, 0.2, 0.3, [0x4caf3c, 0x3d9a34][k % 2], x, hh + 0.1, z);
            if (k % 5 === 2) this.part(r, 0.32, 0.22, 0.26, STONE, x, hh + 0.08, z).rotation.y = k;
        }
        // Quemaduras por el fondo del cráter
        for (let k = 0; k < 9; k++) {
            const a = k * 2.4, d = 2 + (k % 4) * 1.7, s = 0.8 + (k % 3) * 0.3;
            this.part(r, s, 0.02, s * 0.8, 0x3a3028, VILLAGE.cx + Math.cos(a) * d, 0.012 + k * 0.004, VILLAGE.cz + Math.sin(a) * d, false); // (cada una a su altura: se solapan)
        }
        for (const g of geos) {
            if (g.def.mother) continue;
            const c = Math.cos(g.a), s = Math.sin(g.a), nx = -s, nz = c, P = (rr, side, w) => ({ x: VILLAGE.cx + c * rr + nx * side * w, z: VILLAGE.cz + s * rr + nz * side * w });
            let n = 0;
            // El fondo del surco: tierra oscura y removida
            for (let rr = R + 0.4; rr < g.endR; rr += 0.8, n++) {
                const w = furrowHalf(g, rr) * 2, p = P(rr, 0, 0);
                // (sin solaparse con el de al lado, y de altura alterna: sin caras en el mismo plano)
                const th = n % 2 ? 0.05 : 0.056;
                this.part(r, 0.8, th, w, TRENCH[n % 2], p.x, th / 2, p.z, false).rotation.y = -g.a;
                this.part(r, 0.76, 0.07, w * 0.35, 0x3a2414, p.x, 0.035 + (n % 2) * 0.004, p.z, false).rotation.y = -g.a; // (más corta: sin extremos pegados a los de la tierra)
            }
            // Tierra levantada a los dos lados (más alta donde se paró), con matas y piedras
            n = 0;
            for (let rr = R + 1.6; rr < g.endR + 0.4; rr += 0.8, n++) {
                const w = furrowHalf(g, rr), k = 1 - Math.min(1, Math.max(0, (rr - g.parkR) / (g.endR - g.parkR)));
                for (const side of [-1, 1]) {
                    const h = lerp(0.25, 0.9, k) * (0.75 + ((n * 37) % 10) / 20), p = P(rr, side, w + 0.35 + ((n * 13) % 5) * 0.05);
                    this.part(r, 0.7, h, 0.6 + k * 0.3, DIRT[n % 3], p.x, h / 2, p.z).rotation.y = -g.a + ((n * 11) % 7) * 0.08 - 0.24;
                    if (n % 4 === 0) this.part(r, 0.3, 0.2, 0.3, [0x4caf3c, 0x3d9a34][n % 2], p.x, h + 0.1, p.z);
                    if (n % 5 === 1) this.part(r, 0.32, 0.22, 0.26, STONE, p.x, h + 0.08, p.z).rotation.y = n;
                }
            }
            // (los árboles tumbados de los lados ya no: el pueblo está diseñado entero y ese sitio es
            // suyo; queda su grupo, vacío, por si acaso)
            (this.fallen = this.fallen || {})[g.def.id] = new THREE.Group();
        }
        // La zona de impacto de la nave madre: el suelo quemado y con grietas que salen del centro, un
        // anillo de tierra levantada, terrones y piedras sueltos y, alrededor, los árboles tumbados
        // hacia fuera por la onda (hasta VILLAGE.impact)
        const M = geos.find((g) => g.def.mother);
        if (M) {
            const at = (d, a) => ({ x: M.pad.x + Math.cos(a) * d, z: M.pad.z + Math.sin(a) * d });
            for (let k = 0; k < 14; k++) {
                const a = k * 2.39, d = 1 + (k % 5) * 1.5, s = 1.1 + (k % 3) * 0.5, p = at(d, a);
                this.part(r, s, 0.02, s * 0.8, k % 2 ? 0x3a3028 : 0x4a3a2a, p.x, 0.012 + k * 0.0035, p.z, false).rotation.y = a; // (cada una a su altura)
            }
            for (let k = 0; k < 9; k++) {
                const a = (k / 9) * Math.PI * 2 + 0.3;
                for (let d = 2.5; d < 7.5; d += 0.9) {
                    const p = at(d, a + Math.sin(d * 1.7 + k) * 0.08);
                    this.part(r, 0.9, 0.04, 0.22, 0x2a1e14, p.x, 0.09 + k * 0.003, p.z, false).rotation.y = -a; // (por encima de las quemaduras)
                }
            }
            const ring = 40;
            for (let k = 0; k < ring; k++) {
                const a = (k / ring) * Math.PI * 2, d = 8.4 + ((k * 7) % 4) * 0.25, p = at(d, a), hh = 0.5 + ((k * 5) % 4) * 0.15;
                // (con un hueco hacia el cráter: por ahí va la embajadora)
                if (Math.abs(Math.atan2(Math.sin(a - M.a - Math.PI), Math.cos(a - M.a - Math.PI))) < 0.32) continue;
                this.part(r, 1.3, hh, 1.0, DIRT[k % 3], p.x, hh / 2, p.z).rotation.y = -a;
                if (k % 3 === 0) this.part(r, 0.3, 0.2, 0.3, [0x4caf3c, 0x3d9a34][k % 2], p.x, hh + 0.1, p.z);
            }
            for (let k = 0; k < 26; k++) {
                const a = k * 1.93, d = 3 + ((k * 13) % 11) * 0.95, p = at(d, a), big = k % 4 === 0;
                this.part(r, big ? 0.6 : 0.36, big ? 0.36 : 0.22, big ? 0.5 : 0.3, k % 3 ? STONE : DIRT[k % 3], p.x, big ? 0.18 : 0.11, p.z).rotation.y = k;
            }
            for (let k = 0; k < 30; k++) {
                const a = (k / 30) * Math.PI * 2 + (k % 3) * 0.05, d = 9.8 + ((k * 7) % 5) * 0.85;
                if (d > VILLAGE.impact || Math.abs(Math.atan2(Math.sin(a - M.a - Math.PI), Math.cos(a - M.a - Math.PI))) < 0.4) continue;
                const p = at(d, a), pivot = new THREE.Group(), sc = 0.8 + (k % 4) * 0.12;
                pivot.position.set(p.x, 0, p.z);
                pivot.rotation.y = -a; // (su x local: hacia fuera)
                const tree = new THREE.Group();
                tree.rotation.z = -(0.7 + (k % 3) * 0.25); // tumbado hacia fuera
                tree.scale.setScalar(sc);
                this.part(tree, 0.3, 1.0, 0.3, 0x7a4f2a, 0, 0.5, 0);
                this.part(tree, 1.5, 0.9, 1.5, 0x3d9a34, 0, 1.35, 0).rotation.y = k * 0.7;
                this.part(tree, 1.05, 0.7, 1.05, 0x4caf3c, 0, 2.0, 0).rotation.y = k * 0.7 + 0.4;
                this.part(tree, 0.7, 0.18, 0.5, DIRT[k % 3], -0.35, 0.06, 0); // (la raíz levantada, del lado de la nave)
                pivot.add(tree);
                r.add(pivot);
            }
        }
    }

    // La hoguera: corro de piedras, troncos y llamas (con alguien en el pueblo, encendida)
    buildFire(r) {
        const F = polar(VILLAGE.fire.r, VILLAGE.fire.angle);
        this.fire = F;
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            this.part(r, 0.32, 0.22, 0.32, i % 2 ? STONE : 0x7a746a, F.x + Math.cos(a) * 0.62, 0.11, F.z + Math.sin(a) * 0.62);
        }
        for (const ry of [0.5, -0.6]) this.part(r, 1.0, 0.16, 0.16, DARK, F.x, 0.16 + ry * 0.02, F.z).rotation.y = ry; // (por encima de las piedras)
        this.flames = new THREE.Group();
        this.flames.position.set(F.x, 0.2, F.z);
        for (const [w, h, c, x, z] of [[0.56, 0.7, 0xff6a1a, 0, 0], [0.36, 0.95, 0xffb020, 0.1, 0.05], [0.2, 0.6, 0xfff0a0, -0.08, -0.03]]) {
            const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), this.own(new THREE.MeshBasicMaterial({ color: c })));
            f.position.set(x, h / 2, z);
            this.flames.add(f);
        }
        r.add(this.flames);
        this.fireGlow = new THREE.PointLight(0xff9a40, 0, 8, 1.6);
        this.fireGlow.position.set(F.x, 1.2, F.z);
        r.add(this.fireGlow);
    }

    // Una pieza que se enciende de noche (farolas, bombillas, cristales...): MeshBasic de su color,
    // que de día se ve apagada
    lit(g, w, h, d, color, x, y, z) {
        this.litMats = this.litMats || new Map();
        let L0 = this.litMats.get(color);
        if (!L0) {
            L0 = { on: new THREE.Color(color), off: new THREE.Color(color).multiplyScalar(0.62), mat: this.own(new THREE.MeshBasicMaterial({ color })) };
            L0.mat.color.copy(L0.off);
            this.litMats.set(color, L0);
        }
        const m = new THREE.Mesh(box(w, h, d), L0.mat);
        m.position.set(x, y, z);
        g.add(m);
        return m;
    }

    // Los farolillos del día de mercado: postes alrededor del cráter (entre los surcos) con
    // guirnaldas de bombillas y banderines de un poste al siguiente
    buildMarket() {
        const g = new THREE.Group(), R = VILLAGE.R + 1.9, geos = Object.values(this.geo), pts = [];
        for (let k = 0; k < 24; k++) {
            const a = (k / 24) * Math.PI * 2;
            if (geos.some((q) => Math.abs(Math.atan2(Math.sin(a - q.a), Math.cos(a - q.a))) < (q.def.mother ? 0.3 : 0.26))) continue;
            const x = VILLAGE.cx + Math.cos(a) * R, z = VILLAGE.cz + Math.sin(a) * R;
            this.part(g, 0.12, 2.6, 0.12, WOOD2, x, 1.3, z);
            this.lit(g, 0.3, 0.34, 0.3, [0xff5ab8, 0xffe03a, 0x5af0ff, 0x7dff4a][k % 4], x, 2.75, z);
            pts.push({ x, z, k });
        }
        for (let i = 0; i < pts.length; i++) {
            const A = pts[i], B = pts[(i + 1) % pts.length];
            if (Math.hypot(B.x - A.x, B.z - A.z) > 5) continue; // (no cruzan los surcos)
            for (let j = 1; j < 5; j++) {
                const k = j / 5;
                this.lit(g, 0.14, 0.18, 0.14, [0xffe03a, 0xff6a5a, 0x7dff4a, 0x6ac8ff][(i + j) % 4], lerp(A.x, B.x, k), 2.45 - Math.sin(k * Math.PI) * 0.45, lerp(A.z, B.z, k));
            }
        }
        g.visible = false;
        this.root.add(g);
        this.marketG = g;
    }

    setMarket(on) {
        if (on && !this.marketG.visible) this.marketPop = 1;
        this.marketG.visible = !!on;
    }

    // ---------- Las casas de los mercaderes y sus calles (content/merchants.js: TOWN, pavedIn) ----------
    // Cada casa, con su color y un toque alien (antena con su bola que brilla de noche), y su calle
    // asfaltada sobre el surco, con su raya y sus aceras. El suelo de la plaza y la ronda pequeña lo
    // pinta la granja (Farm.setTownLevel)
    buildTown() {
        const g = (this.townG = new THREE.Group());
        this.root.add(g);
        this.houses = {};
        for (const geo of Object.values(this.geo)) {
            if (geo.def.mother) continue;
            const d = geo.def, lot = houseLot(geo), h = new THREE.Group();
            h.position.set(lot.x, 0, lot.z);
            h.rotation.y = lot.ry;
            this.part(h, 3.2, 0.2, 2.8, STONE, 0, 0.1, 0);
            this.part(h, 2.8, 1.9, 2.4, d.coat, 0, 1.15, 0);
            for (let i = 0; i < 3; i++) this.part(h, 3.2 - i * 0.9, 0.36, 2.8 - i * 0.02, i % 2 ? d.hat : new THREE.Color(d.hat).multiplyScalar(0.85).getHex(), 0, 2.28 + i * 0.36, 0);
            this.part(h, 0.7, 1.2, 0.08, DARK, 0, 0.8, 1.22);
            for (const x of [-0.9, 0.9]) this.lit(h, 0.5, 0.5, 0.06, 0xffe08a, x, 1.4, 1.22);
            this.part(h, 0.08, 1.0, 0.08, METAL, 0.8, 3.4, -0.4);
            this.lit(h, 0.22, 0.22, 0.22, d.skin, 0.8, 3.95, -0.4);
            this.part(h, 0.35, 0.7, 0.35, 0x8a5a3a, -0.9, 2.9, -0.5);
            h.visible = false;
            g.add(h);
            this.bake([h], []);
            this.houses[d.id] = { id: d.id, g: h, pop: 0, lot };
            const road = new THREE.Group(), ca = Math.cos(geo.a), sa = Math.sin(geo.a);
            let n = 0;
            for (let rr = VILLAGE.R + 0.4; rr < geo.endR + 0.4; rr += 0.8, n++) {
                const w = furrowHalf(geo, rr) * 2 + 0.3, x = VILLAGE.cx + ca * rr, z = VILLAGE.cz + sa * rr, th = n % 2 ? 0.1 : 0.106;
                this.part(road, 0.8, th, w, n % 2 ? 0x54545a : 0x4e4e54, x, th / 2, z, false).rotation.y = -geo.a;
                if (n % 3 === 0) this.part(road, 0.4, th + 0.01, 0.1, 0xf3e6c4, x, th / 2 + 0.005, z, false).rotation.y = -geo.a; // (la raya del centro)
                for (const sd of [-1, 1]) this.part(road, 0.76, 0.18, 0.6, 0xc8c0b0, x - sa * sd * (w / 2 + 0.2), 0.09, z + ca * sd * (w / 2 + 0.2), false).rotation.y = -geo.a; // (aceras)
            }
            road.visible = false;
            g.add(road);
            this.bake([road], []);
            this.houses[d.id].road = road;
        }
    }

    // ---------- El pueblo entero, diseñado de antemano (render/town.js) ----------
    buildLayout() {
        this.buildTown();
        layoutTown(this);
    }

    furrowHalf(q, t) {
        return furrowHalf(q, t);
    }

    // (para las piezas: una estatua de mercader, un material que brilla y el del holograma)
    alien(skin, coat, hat) {
        const st = buildAlien(this, skin, coat, hat);
        st.remove(st.party);
        return st;
    }

    glow(color) {
        this.glowMats = this.glowMats || new Map();
        if (!this.glowMats.has(color)) this.glowMats.set(color, this.own(new THREE.MeshBasicMaterial({ color })));
        return this.glowMats.get(color);
    }

    holo() {
        return (this.holoMat = this.holoMat || this.own(new THREE.MeshBasicMaterial({ color: 0x5af0ff, transparent: true, opacity: 0.55, depthWrite: false })));
    }

    // Un arco de bienvenida (nivel 10), sobre la entrada de una calle (w: de lado a lado)
    archPiece(g, w = 6) {
        for (const x of [-w / 2, w / 2]) {
            this.part(g, 0.6, 4.6, 0.6, 0xe8c050, x, 2.3, 0);
            this.part(g, 0.9, 0.4, 0.9, 0xd8a830, x, 0.2, 0);
            this.lit(g, 0.3, 0.3, 0.3, 0x7dff4a, x, 4.8, 0);
        }
        this.part(g, w + 1.0, 0.6, 0.7, 0xe8c050, 0, 4.8, 0);
        this.part(g, w * 0.6, 0.9, 0.14, 0x8a5ad8, 0, 4.8, 0.42);
        this.lit(g, 0.4, 0.4, 0.4, 0xffd23f, 0, 5.5, 0);
    }

    // Lo que se ve del pueblo: lo construido en el nivel lv (casas y calles de los mercaderes, la
    // ronda, los barrios y los arcos) y lo comprado (owned), en su sitio, si su sitio ya está. Lo
    // nuevo sale con un bote; devuelve lo que acaba de aparecer (para enseñarlo)
    setTown(lv, owned, pop = true) {
        const shown = [], prev = this.level === undefined ? lv : this.level;
        this.cubesIn = this.cubesOut = 0;
        // (lo construido sale en ola desde el centro hacia fuera, cada sitio a su tiempo)
        const wave = (p) => 0.3 + (Math.hypot(p.x - VILLAGE.cx, p.z - VILLAGE.cz) / 55) * 1.8;
        // (lo de los objetos: un rayo de luz por pieza, con su forma; lo que construye el nivel: un
        // bloque de luz con la forma de lo que anuncia y, cuando se va, aparece lo nuevo)
        const show = (g, on, shapes = [], build = false) => {
            if (on && !g.visible) {
                shown.push(g);
                if (pop && build) {
                    let t0 = Infinity;
                    for (const S of shapes) t0 = Math.min(t0, this.cube(S, wave(S)));
                    this.pops.push({ g, k: 1, wait: shapes.length ? t0 : 0.3 });
                } else if (pop) {
                    const step = Math.max(1, Math.ceil(shapes.length / 90)); // (no más de unos 90 rayos por cosa)
                    for (let i = 0; i < shapes.length; i += step) this.beam(shapes[i], Math.random() * 0.45);
                    this.pops.push({ g, k: 1, wait: 0.2 });
                }
            }
            g.visible = on;
        };
        this.level = lv;
        const paved = pavedIn(lv);
        for (const [id, H] of Object.entries(this.houses)) {
            const on = paved.includes(id);
            if (on && !H.on) {
                shown.push(H.g);
                if (pop) {
                    // (su casa y su calle, cada una de su bloque de luz; los árboles tumbados se quitan
                    // cuando entra la calle)
                    H.pop = 1;
                    H.wait = this.cube({ x: H.lot.x, z: H.lot.z, hx: 1.9, hz: 1.7, ry: H.lot.ry, h: 4.2 }, wave(H.lot));
                    const q = this.geo[id], c = Math.cos(q.a), sn = Math.sin(q.a);
                    let t0 = Infinity;
                    for (let t = VILLAGE.R + 0.4; t < q.endR; t += 6) {
                        const len = Math.min(6, q.endR - t), m = t + len / 2, p = { x: VILLAGE.cx + c * m, z: VILLAGE.cz + sn * m };
                        t0 = Math.min(t0, this.cube({ x: p.x, z: p.z, hx: furrowHalf(q, m) + 0.6, hz: len / 2, ry: Math.atan2(c, sn), h: 1.6 }, wave(p)));
                    }
                    H.roadWait = t0;
                    this.pops.push({ g: H.road, k: 1, wait: t0 });
                }
            }
            H.on = on;
            H.g.visible = on && H.pop > 0; // (la que bota, aparte; las asentadas, juntas: rebakeTown)
            H.road.visible = on && H.pop > 0;
            if (this.fallen[id]) this.fallen[id].visible = !on || (H.pop > 0 && H.roadWait > 0);
        }
        this.rebakeTown();
        show(this.ringG, lv >= TOWN.ring, [{ ...this.ringShape, x: VILLAGE.cx, z: VILLAGE.cz }], true);
        for (const [hl, g] of Object.entries(this.homeG)) {
            const on = lv >= +hl;
            if (on && !g.visible) {
                shown.push(g);
                if (pop) for (const b of this.homeBands[hl]) {
                    let t0 = Infinity;
                    for (const S of b.shapes) t0 = Math.min(t0, this.cube(S, wave(S)));
                    if (b.shapes.length) this.pops.push({ g: b.g, k: 1, wait: t0 });
                }
            }
            g.visible = on;
        }
        show(this.archG, lv >= TOWN.arches, this.archShapes, true);
        this.lastShown = { build: shown.slice(), decor: {} };
        for (const [id, list] of Object.entries(this.regions)) {
            const have = owned.includes(id);
            for (const e of list) {
                const was = e.g.visible;
                e.on = have && lv >= e.lv; // (lo que tiene que verse, aunque aún espere su turno)
                // (lo que sale porque ahora hay sitio, al subir de nivel: dentro de lo construido)
                if (pop && have && !was && e.lv > prev && lv >= e.lv) {
                    e.g.visible = true;
                    shown.push(e.g);
                    this.pops.push({ g: e.g, k: 1, wait: Math.min(...e.shapes.map((S) => wave(S) + 0.84)) });
                    (this.lastShown.decor[id] = this.lastShown.decor[id] || []).push(e.g);
                    continue;
                }
                show(e.g, e.on, e.shapes);
                if (!was && e.g.visible) (this.lastShown.decor[id] = this.lastShown.decor[id] || []).push(e.g);
            }
        }
        // (lo que espera su turno, ya escondido: que no se vea ni un fotograma aplastado)
        for (const P0 of this.pops) if (P0.wait > 0) { P0.g.visible = false; P0.hid = true; }
        for (const H of Object.values(this.houses)) if (H.wait > 0) H.g.visible = false;
        return this.lastShown;
    }

    // Las formas de luz (rayos y bloques): una caja, un cilindro o un donut del tamaño de lo que
    // anuncian (shape: x, z, hx, hz, ry, h; round: cilindro; donut: r y w, de anillo)
    lightMesh(S, mat, core) {
        if (!this.lightGeo) {
            this.lightGeo = {
                box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
                cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20).translate(0, 0.5, 0),
                tube: new THREE.CylinderGeometry(1, 1, 1, 64, 1, true).translate(0, 0.5, 0),
            };
        }
        const G = this.lightGeo, g = new THREE.Group();
        if (S.donut) {
            for (const [r, m] of [[S.r + S.w, mat], [S.r - S.w, mat], [S.r, core]]) {
                const t = new THREE.Mesh(G.tube, m);
                t.scale.set(r, 1, r);
                t.material.side = THREE.DoubleSide;
                g.add(t);
            }
        } else {
            const geo = S.round ? G.cyl : G.box, o = new THREE.Mesh(geo, mat), c = new THREE.Mesh(geo, core);
            o.scale.set(S.hx * 2 + 0.3, 1, (S.round ? S.hx : S.hz) * 2 + 0.3);
            c.scale.set(o.scale.x * 0.5, 1, o.scale.z * 0.5);
            g.add(o, c);
            g.rotation.y = S.ry || 0;
        }
        g.position.set(S.x, 0, S.z);
        g.visible = false;
        g.renderOrder = 5;
        this.root.add(g);
        return g;
    }

    lightMats() {
        if (!this.lightMat) {
            const add = (c, o) => this.own(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            this.lightMat = { beam: add(0xffe08a, 0.45), beamCore: add(0xffffff, 0.75), cube: add(0x5af0ff, 0.42), cubeCore: add(0xffffff, 0.28) };
            this.beams = [];
            this.cubes = [];
        }
        return this.lightMat;
    }

    // Un rayo de luz donde sale una pieza nueva (como el del pozo de los deseos), con su forma: sube
    // de golpe y se va afinando; se ve aunque la pieza sea pequeña y la cámara esté lejos
    beam(S, delay = 0) {
        const M = this.lightMats();
        if (this.beams.length > 320) return;
        const g = this.lightMesh(S, M.beam, M.beamCore);
        this.beams.push({ g, t: -delay, h: Math.max(14, (S.h || 2) * 5) });
    }

    // Un bloque de luz donde el pueblo construye algo (al subir de nivel), con su forma: crece,
    // palpita y se va hacia arriba; lo nuevo entra con el bloque aún entero. Devuelve cuándo entra
    cube(S, delay = 0) {
        const M = this.lightMats(), DUR = 2.2, inAt = delay + DUR * 0.38;
        this.cubesIn = Math.max(this.cubesIn || 0, inAt);
        this.cubesOut = Math.max(this.cubesOut || 0, delay + DUR * 0.55);
        if (this.cubes.length > 420) return inAt;
        const g = this.lightMesh(S, M.cube, M.cubeCore);
        this.cubes.push({ g, t: -delay, h: (S.h || 3) * 1.25 + 1, dur: DUR, donut: !!S.donut, ry: S.ry || 0 });
        return inAt;
    }

    // Los bloques de luz del suelo nuevo de un nivel (la plaza de piedra, la calle de alrededor de
    // la plaza, la avenida de la nave madre); devuelve cuándo ha entrado todo (s): ahí se rehace el suelo
    floorCubes(prev, lv) {
        const passed = (k) => prev < k && lv >= k, C = { x: VILLAGE.cx, z: VILLAGE.cz };
        if (passed(TOWN.plaza)) this.cube({ ...C, hx: VILLAGE.R, hz: VILLAGE.R, round: true, h: 2 }, 0.3);
        if (passed(TOWN.inner)) this.cube({ ...C, donut: true, r: 11.9, w: 1.0, h: 2 }, 0.4);
        if (passed(TOWN.avenue)) {
            const M = Object.values(this.geo).find((q) => q.def.mother), len = M.padR - 5 - VILLAGE.R, m = VILLAGE.R + len / 2;
            this.cube({ x: VILLAGE.cx + Math.cos(M.a) * m, z: VILLAGE.cz + Math.sin(M.a) * m, hx: 2.3, hz: len / 2, ry: Math.atan2(Math.cos(M.a), Math.sin(M.a)), h: 2 }, 0.6);
        }
        return this.cubesIn || 0;
    }

    // ¿Se ve algo de este objeto? ¿Y desde qué nivel se verá lo primero suyo? (para avisar en la tienda)
    shown(id) {
        return (this.regions[id] || []).some((e) => e.on);
    }

    firstLevel(id) {
        return Math.min(...(this.regions[id] || [{ lv: 0 }]).map((e) => e.lv));
    }

    // Lo que se pisa (debe estar vacío: render/town.js: auditTown)
    audit() {
        return auditTown(this);
    }

    // Las casas asentadas y las calles de los mercaderes, juntas (una malla por material)
    rebakeTown() {
        const objs = [];
        for (const H of Object.values(this.houses)) {
            if (!H.on || H.pop > 0) continue; // (la que bota, aparte)
            objs.push(H.road, H.g);
        }
        this.townMerged = this.mergeInto(this.townG, this.townMerged, objs);
    }

    // Junta en un grupo nuevo (dentro de parent) todas las mallas de objs, una por material (en
    // la posición que tengan, aunque estén escondidos); quita el grupo junto de antes (old)
    mergeInto(parent, old, objs) {
        if (old) {
            old.removeFromParent();
            old.traverse((o) => o.geometry && o.geometry.dispose());
        }
        const g = new THREE.Group(), byMat = new Map(), inv = new THREE.Matrix4(), M = new THREE.Matrix4();
        parent.updateMatrixWorld(true);
        inv.copy(parent.matrixWorld).invert();
        for (const obj of objs) obj.traverse((o) => {
            if (!o.isMesh) return;
            M.multiplyMatrices(inv, o.matrixWorld);
            if (!byMat.has(o.material)) byMat.set(o.material, []);
            byMat.get(o.material).push(o.geometry.clone().applyMatrix4(M));
        });
        for (const [mat, list] of byMat) {
            g.add(new THREE.Mesh(mergeBoxes(list), mat));
            for (const q of list) q.dispose();
        }
        parent.add(g);
        return g;
    }

    // Cuántos se han quedado a vivir
    setResidents(n) {
        this.residents.forEach((R, i) => {
            const on = i < n;
            if (on !== !!R.on) {
                R.on = on;
                R.g.visible = on;
                R.inside = 0;
            }
        });
    }

    // Las puertas a las que se puede ir: las casas de los mercaderes que ya están y las de los barrios
    openDoors() {
        const out = [];
        if (this.houses) for (const H of Object.values(this.houses)) if (H.on) out.push({ x: H.g.position.x + Math.sin(H.g.rotation.y) * 1.7, z: H.g.position.z + Math.cos(H.g.rotation.y) * 1.7 });
        for (const d of this.doors || []) if (d.lv <= (this.level || 0)) out.push(d);
        return out;
    }

    // El camino de la plaza a un punto (o de vuelta, back): por la acera de la calle que más cerca
    // le queda (la salida de la plaza, la acera hasta su altura) y luego hasta él
    routeTo(x, z, back = false) {
        const dx = x - VILLAGE.cx, dz = z - VILLAGE.cz, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
        let best = null, bd = Infinity;
        for (const q of Object.values(this.geo)) {
            const d = Math.abs(Math.atan2(Math.sin(a - q.a), Math.cos(a - q.a)));
            if (d < bd) { bd = d; best = q; }
        }
        if (!best || r < VILLAGE.R + 2) return back ? [{ x: VILLAGE.cx + dx * 0.3, z: VILLAGE.cz + dz * 0.3 }] : [];
        const c = Math.cos(best.a), s = Math.sin(best.a), side = Math.sign(-dx * s + dz * c) || 1;
        const along = Math.max(VILLAGE.R + 1, Math.min(r, (best.endR || r) - 1)), off = (best.half ? furrowHalf(best, along) : 2) + 0.7;
        const P = (t) => ({ x: VILLAGE.cx + c * t - s * off * side, z: VILLAGE.cz + s * t + c * off * side });
        const pts = [{ x: VILLAGE.cx + c * (VILLAGE.R - 2), z: VILLAGE.cz + s * (VILLAGE.R - 2) }, P(VILLAGE.R + 1), P(along)];
        if (back) return [P(along), P(VILLAGE.R + 1), { x: VILLAGE.cx + c * (VILLAGE.R - 2), z: VILLAGE.cz + s * (VILLAGE.R - 2) }, { x: VILLAGE.cx + (Math.random() - 0.5) * 6, z: VILLAGE.cz + (Math.random() - 0.5) * 6 }];
        return pts;
    }

    // ¿Hay alguien? (la hoguera, encendida)
    get anyone() {
        return this.visitors.some((v) => v.open);
    }

    update(dt, time, nightK = 0) {
        for (const v of this.visitors) v.update(dt, time, nightK);
        // Los coches de la ronda
        if (this.cars) {
            const on = this.ringG.visible;
            for (const C of this.cars) {
                C.g.visible = on;
                if (!on) continue;
                const na = C.a + C.v * C.dir * dt;
                C.a = na;
                const R = this.ringAt(C.a) + C.dir * 0.55, R2 = this.ringAt(C.a + 0.01 * C.dir) + C.dir * 0.55;
                const x = VILLAGE.cx + Math.cos(C.a) * R, z = VILLAGE.cz + Math.sin(C.a) * R;
                const x2 = VILLAGE.cx + Math.cos(C.a + 0.01 * C.dir) * R2, z2 = VILLAGE.cz + Math.sin(C.a + 0.01 * C.dir) * R2;
                C.g.position.set(x, 0.13, z);
                C.g.rotation.y = Math.atan2(x2 - x, z2 - z);
            }
        }
        // Lo nuevo (barrios, ronda, objetos), con un bote: crece del suelo
        for (const P0 of this.pops) {
            // (mientras espera o está casi plano, escondido: aplastado contra el suelo parpadea)
            if (P0.wait > 0) { P0.wait -= dt; P0.g.scale.set(1, 0.0001, 1); P0.g.visible = false; P0.hid = true; continue; }
            P0.k = Math.max(0, P0.k - dt * 1.4);
            const sy = back(Math.min(1, (1 - P0.k) * 1.2));
            P0.g.scale.set(1, Math.max(0.0001, sy), 1);
            if (P0.hid && sy > 0.06) { P0.g.visible = true; P0.hid = false; }
            else if (sy <= 0.06 && P0.k > 0) { P0.g.visible = false; P0.hid = true; }
        }
        if (this.pops.length && this.pops.every((P0) => P0.k === 0)) this.pops.length = 0;
        // Los cubos de luz: crecen del suelo, palpitan girando y se van hacia arriba, cada vez más finos
        if (this.cubes) for (let i = this.cubes.length - 1; i >= 0; i--) {
            const C = this.cubes[i];
            C.t += dt;
            if (C.t < 0) continue;
            const k = C.t / C.dur;
            if (k >= 1) { C.g.removeFromParent(); this.cubes.splice(i, 1); continue; }
            C.g.visible = true;
            // (crece del suelo con su forma, palpita y se va hacia arriba cada vez más fino; el donut,
            // abriéndose)
            const grow = ease(Math.min(1, k / 0.3)), gone = Math.max(0, (k - 0.55) / 0.45), puls = 1 + Math.sin(C.t * 18) * 0.04 * (1 - gone);
            const w = C.donut ? 1 + gone * 0.12 : (0.4 + grow * 0.6) * puls * (1 - gone * 0.92);
            C.g.scale.set(w, Math.max(0.01, C.h * grow * puls * (1 + gone * 2.5) * (C.donut ? 1 - gone * 0.6 : 1)), w);
        }
        // Los rayos de luz: suben de golpe y se van afinando hasta desaparecer
        if (this.beams) for (let i = this.beams.length - 1; i >= 0; i--) {
            const B = this.beams[i];
            B.t += dt;
            if (B.t < 0) continue;
            const k = B.t / 1.5;
            if (k >= 1) { B.g.removeFromParent(); this.beams.splice(i, 1); continue; }
            B.g.visible = true;
            const w = (1 - k) ** 1.6 + 0.04;
            B.g.scale.set(w, 2 + ease(Math.min(1, k * 3)) * B.h, w);
        }
        // Las casas nuevas, con un bote
        if (this.houses) for (const H of Object.values(this.houses)) if (H.pop > 0) {
            if (H.roadWait > 0 && (H.roadWait -= dt) <= 0 && this.fallen[H.id]) this.fallen[H.id].visible = false;
            if (H.wait > 0) { H.wait -= dt; H.g.scale.set(1, 0.0001, 1); H.g.visible = false; continue; }
            H.pop = Math.max(0, H.pop - dt * 1.4);
            const hy = back(Math.min(1, (1 - H.pop) * 1.2));
            H.g.scale.set(1, Math.max(0.0001, hy), 1);
            H.g.visible = H.on && (hy > 0.06 || H.pop === 0);
            if (H.pop === 0 && !(H.roadWait > 0)) {
                H.g.visible = H.road.visible = false;
                this.rebakeTown();
            } else if (H.pop === 0) H.pop = 0.0001; // (espera a que entre su calle)
        }
        if (this.marketPop > 0) {
            this.marketPop = Math.max(0, this.marketPop - dt * 1.5);
            this.marketG.scale.set(1, Math.max(0.0001, back(Math.min(1, (1 - this.marketPop) * 1.2))), 1);
        }
        // De noche se encienden las farolas, las bombillas y los cristales
        // (las ventanas de las casas se van apagando según avanza la noche: cada grupo a su hora)
        if (this.litMats) for (const [c, L0] of this.litMats) {
            const on = nightK > 0.4 && nightK < (WINDOW_OFF[c] || 2);
            if (on !== L0.state) {
                L0.state = on;
                L0.mat.color.copy(on ? L0.on : L0.off);
            }
        }
        // Se visitan: de vez en cuando uno va al puesto de otro a charlar
        if ((this.visitT -= dt) <= 0) {
            this.visitT = 10 + Math.random() * 14;
            const free = this.visitors.filter((v) => v.open && !v.trip && v.deal < 0);
            if (free.length >= 2) {
                const a = free[(Math.random() * free.length) | 0], b = free.filter((v) => v !== a)[(Math.random() * (free.length - 1)) | 0];
                const S = b.spot, dx = VILLAGE.cx - S.x, dz = VILLAGE.cz - S.z, d = Math.hypot(dx, dz) || 1;
                a.trip = { t: 0, to: { x: S.x + (dx / d) * 1.1 - (dz / d) * 0.8, z: S.z + (dz / d) * 1.1 + (dx / d) * 0.8 }, look: S };
                b.bubbleT = 6;
            }
        }
        for (const v of this.visitors) if (v.bubbleT > 0 && !v.trip && v.deal < 0) {
            v.bubbleT -= dt;
            v.bubble.visible = v.bubbleT > 0 && Math.sin(time * 3 + 1.5) > -0.3;
        }
        // Los habitantes pasean por el cráter (sin pisar la fuente) y se paran a mirar; con el pueblo
        // crecido, a veces se van a casa por las aceras de las calles, entran, y al rato vuelven
        for (const R of this.residents) {
            if (!R.on) continue;
            if (R.inside > 0) {
                if ((R.inside -= dt) <= 0) {
                    R.g.visible = true;
                    R.route = this.routeTo(R.x, R.z, true);
                }
                continue;
            }
            if (!R.goal && R.route && R.route.length) R.goal = R.route.shift();
            if (!R.goal && (R.wait -= dt) <= 0) {
                const doors = this.openDoors();
                if (R.home !== undefined || (doors.length && Math.random() < 0.55)) {
                    const dr = R.home !== undefined && doors[R.home % doors.length] ? doors[R.home % doors.length] : doors[(Math.random() * doors.length) | 0];
                    if (dr) {
                        R.route = [...this.routeTo(dr.x, dr.z), { x: dr.x, z: dr.z, enter: true }];
                        R.goal = R.route.shift();
                    }
                }
                if (!R.goal) {
                    const a = Math.random() * Math.PI * 2, d = 2.2 + Math.random() * 4.6;
                    R.goal = { x: VILLAGE.cx + Math.cos(a) * d, z: VILLAGE.cz + Math.sin(a) * d };
                }
            }
            let moving = false;
            if (R.goal) {
                const dx = R.goal.x - R.x, dz = R.goal.z - R.z, d = Math.hypot(dx, dz);
                if (d < 0.1) {
                    if (R.goal.enter) {
                        R.g.visible = false; // (entra en casa)
                        R.inside = 6 + Math.random() * 10;
                    }
                    R.goal = null;
                    R.wait = R.route && R.route.length ? 0 : 1.5 + Math.random() * 4;
                } else {
                    R.x += (dx / d) * dt * 1.1;
                    R.z += (dz / d) * dt * 1.1;
                    R.g.rotation.y = Math.atan2(dx, dz);
                    moving = true;
                }
            }
            R.step += dt * 10;
            R.g.position.set(R.x, moving ? Math.abs(Math.sin(R.step)) * 0.05 : 0, R.z);
            R.g.arm.rotation.z = moving ? Math.sin(R.step) * 0.3 : Math.sin(time * 0.7 + R.step) > 0.8 ? 2.4 : 0.1;
        }
        const lit = this.anyone;
        this.flames.visible = lit;
        if (lit) this.flames.children.forEach((f, i) => f.scale.set(1, 0.75 + Math.abs(Math.sin(time * (7 + i * 3) + i)) * 0.5, 1));
        this.fireGlow.intensity = lit ? (1.5 + nightK * 4) * (0.85 + Math.sin(time * 13) * 0.15) : 0;
        // Lo que se mueve de los objetos (render/townPieces.js): cada pieza con su desfase
        for (const list of Object.values(this.regions)) for (const e of list) {
            if (!e.g.visible) continue;
            for (const a of e.anims) a.fn(a.o, time + a.ph);
        }
        this.updateFx(dt);
    }
}
