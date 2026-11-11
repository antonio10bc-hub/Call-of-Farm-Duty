import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { box } from './materials.js';
import { MERCHANTS, VILLAGE, ALL_DECOR, decorAt, polar, pavedIn } from '../content/merchants.js';
import { CROPS } from '../content/crops.js';

// El pueblo de los mercaderes: el cráter grande del centro de su zona (donde montan sus puestos y
// se va llenando de lo que les compras), los siete surcos que llegan hasta él (cada uno lo dejó la
// nave de un mercader al estrellarse), los árboles tumbados a sus lados, la hoguera y el claro de
// la nave madre. Cada mercader (Visitor) llega en su ovni disfrazado de vehículo por su surco; la
// nave madre (Mother) baja en vertical sobre su claro.
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

// ---------- Decoración del pueblo ----------
// Cada objeto que les compras (o te regalan), en su sitio del cráter
const DECO = {
    gnome(m, g) {
        m.part(g, 0.3, 0.34, 0.24, 0x3a6ab8, 0, 0.17, 0);
        m.part(g, 0.26, 0.24, 0.24, 0x7dff4a, 0, 0.46, 0);
        m.part(g, 0.28, 0.12, 0.28, 0xd84a3a, 0, 0.64, 0);
        m.part(g, 0.16, 0.14, 0.16, 0xd84a3a, 0, 0.76, 0);
        g.scale.setScalar(1.6);
    },
    flamingo(m, g) {
        m.part(g, 0.04, 0.5, 0.04, 0x2a1a0e, 0, 0.25, 0, false);
        m.part(g, 0.42, 0.22, 0.2, 0xff8ab8, 0, 0.6, 0);
        m.part(g, 0.08, 0.36, 0.08, 0xff8ab8, 0.16, 0.86, 0);
        m.part(g, 0.16, 0.12, 0.12, 0xff8ab8, 0.2, 1.06, 0);
        g.scale.setScalar(1.5);
    },
    trophy(m, g) {
        m.part(g, 0.6, 0.5, 0.6, WOOD2, 0, 0.25, 0);
        m.part(g, 0.36, 0.1, 0.36, 0xc8952a, 0, 0.55, 0);
        m.part(g, 0.1, 0.2, 0.1, 0xffd23f, 0, 0.7, 0, false);
        m.part(g, 0.4, 0.34, 0.4, 0xffd23f, 0, 0.97, 0);
        for (const s of [-1, 1]) m.part(g, 0.08, 0.18, 0.08, 0xffd23f, s * 0.26, 1.0, 0, false);
    },
    banner(m, g) {
        m.part(g, 0.1, 2.8, 0.1, METAL, 0, 1.4, 0);
        m.part(g, 1.0, 0.6, 0.04, 0x3aa83a, 0.55, 2.4, 0);
        m.part(g, 0.44, 0.12, 0.03, 0xd8e0e8, 0.55, 2.4, 0.03, false);
    },
    stand(m, g) {
        for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) m.part(g, 0.08, 1.7, 0.08, WOOD2, x, 0.85, z);
        m.part(g, 1.5, 0.5, 0.9, WOOD, 0, 0.5, 0);
        for (let i = 0; i < 4; i++) m.part(g, 0.4, 0.08, 1.1, i % 2 ? 0xfff3d6 : 0x3a8ad8, -0.6 + i * 0.4, 1.75, 0);
        for (const [x, c] of [[-0.45, 0xe8352a], [0, 0xffd23f], [0.45, 0x7dff4a]]) m.part(g, 0.3, 0.2, 0.3, c, x, 0.85, 0, false);
    },
    bench(m, g) {
        for (const x of [-0.55, 0.55]) m.part(g, 0.1, 0.4, 0.4, DARK, x, 0.2, 0);
        m.part(g, 1.4, 0.1, 0.46, WOOD, 0, 0.44, 0);
        m.part(g, 1.4, 0.36, 0.08, WOOD, 0, 0.7, -0.2);
    },
    lamps(m, g) {
        for (const x of [-0.8, 0.8]) {
            m.part(g, 0.12, 2.2, 0.12, 0x3a3a4a, x, 1.1, 0);
            m.lit(g, 0.34, 0.36, 0.34, 0xffe9a0, x, 2.35, 0);
            m.part(g, 0.44, 0.08, 0.44, 0x3a3a4a, x, 2.57, 0);
        }
    },
    mailbox(m, g) {
        m.part(g, 0.1, 0.9, 0.1, WOOD2, 0, 0.45, 0);
        m.part(g, 0.4, 0.36, 0.6, 0x3a6ab8, 0, 1.05, 0);
        m.part(g, 0.04, 0.3, 0.1, 0xd84a3a, 0.22, 1.2, -0.15, false);
    },
    flowers(m, g) {
        m.part(g, 1.6, 0.2, 0.9, 0x6a4a2a, 0, 0.1, 0);
        for (let i = 0; i < 7; i++) {
            const x = -0.65 + i * 0.22, z = i % 2 ? 0.2 : -0.2;
            m.part(g, 0.05, 0.4, 0.05, 0x3ac8b0, x, 0.4, z, false);
            m.part(g, 0.18, 0.14, 0.18, [0xff7ae0, 0x5af0ff, 0xffe03a][i % 3], x, 0.65, z, false);
        }
    },
    shrubs(m, g) {
        for (const [x, z, s, c] of [[-0.5, 0, 0.8, 0x7dff9a], [0.4, 0.2, 0.6, 0x5af0ff], [0, -0.4, 0.5, 0xff7ae0]]) {
            m.part(g, s, s * 0.8, s, 0x3a8a6a, x, s * 0.4, z);
            m.part(g, s * 0.4, s * 0.4, s * 0.4, c, x, s * 0.9, z, false);
        }
    },
    cone(m, g) {
        m.part(g, 0.12, 1.6, 0.12, WOOD2, 0, 0.8, 0);
        [[0.2, 0.3], [0.36, 0.3], [0.5, 0.3]].forEach(([w, h], i) => m.part(g, w, h, w, 0xd8a04a, 0, 1.7 + i * 0.3, 0));
        m.part(g, 0.7, 0.4, 0.7, 0xffb8d8, 0, 2.7, 0);
        m.part(g, 0.5, 0.3, 0.5, 0xfff3d6, 0, 3.0, 0);
        m.part(g, 0.12, 0.12, 0.12, 0xe8352a, 0, 3.22, 0, false);
    },
    lights(m, g) {
        for (const x of [-1.4, 1.4]) m.part(g, 0.1, 2.2, 0.1, WOOD2, x, 1.1, 0);
        for (let i = 0; i < 9; i++) {
            const k = i / 8, x = lerp(-1.4, 1.4, k), y = 2.1 - Math.sin(k * Math.PI) * 0.45;
            m.lit(g, 0.14, 0.16, 0.14, [0xffe03a, 0xff6a5a, 0x7dff4a, 0x6ac8ff][i % 4], x, y, 0);
        }
    },
    well(m, g) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            m.part(g, 0.4, 0.6, 0.3, i % 2 ? STONE : 0x8a847a, Math.cos(a) * 0.55, 0.3, Math.sin(a) * 0.55).rotation.y = -a;
        }
        m.part(g, 0.8, 0.04, 0.8, 0x4aa8e0, 0, 0.5, 0, false);
        for (const x of [-0.6, 0.6]) m.part(g, 0.1, 1.4, 0.1, WOOD2, x, 0.9, 0);
        m.part(g, 1.5, 0.3, 1.0, 0x8a4a2a, 0, 1.7, 0);
    },
    dish(m, g) {
        m.part(g, 0.5, 0.3, 0.5, METAL2, 0, 0.15, 0);
        m.part(g, 0.12, 1.0, 0.12, METAL2, 0, 0.7, 0);
        const d = new THREE.Group();
        d.position.set(0, 1.3, 0);
        d.rotation.x = -0.6;
        g.add(d);
        m.part(d, 1.4, 0.14, 1.4, 0xd8e0e8, 0, 0, 0);
        m.part(d, 0.06, 0.6, 0.06, METAL2, 0, 0.3, 0, false);
        m.part(d, 0.14, 0.14, 0.14, 0xff5a5a, 0, 0.62, 0, false);
    },
    signpost(m, g) {
        m.part(g, 0.12, 2.2, 0.12, WOOD2, 0, 1.1, 0);
        [[0.4, 0xf3ead2], [-0.6, 0xffd23f], [1.2, 0x7dff9a]].forEach(([ry, c], i) => {
            m.part(g, 1.0, 0.24, 0.06, c, Math.cos(ry) * 0.4, 1.9 - i * 0.32, -Math.sin(ry) * 0.4).rotation.y = ry;
        });
    },
    telescope(m, g) {
        for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [0, 0.3]]) m.part(g, 0.06, 1.0, 0.06, DARK, x * 0.8, 0.5, z * 0.8);
        const t = m.part(g, 1.4, 0.26, 0.26, 0xb8862a, 0.1, 1.15, 0);
        t.rotation.z = 0.6;
        m.part(t, 0.34, 0.34, 0.34, 0x8a5a1a, 0.7, 0, 0);
    },
    crystal(m, g) {
        m.part(g, 0.9, 0.3, 0.9, STONE, 0, 0.15, 0);
        for (const [x, z, h, ry] of [[0, 0, 1.6, 0.3], [0.3, 0.2, 1.0, -0.4], [-0.3, -0.1, 0.8, 0.6]]) {
            const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, 0.3), m.own(new THREE.MeshBasicMaterial({ color: 0x9f7aff })));
            c.position.set(x, 0.3 + h / 2, z);
            c.rotation.set(0.1, ry, 0.15);
            g.add(c);
        }
    },
    mushrooms(m, g) {
        for (const [x, z, s, c] of [[0, 0, 1, 0xff5a5a], [0.6, 0.3, 0.6, 0x8a5ad8], [-0.5, 0.2, 0.7, 0xffb020]]) {
            m.part(g, 0.2 * s, 0.9 * s, 0.2 * s, 0xf3ead2, x, 0.45 * s, z);
            m.part(g, 0.8 * s, 0.3 * s, 0.8 * s, c, x, 0.95 * s, z);
            m.part(g, 0.12, 0.06, 0.12, 0xffffff, x + 0.15 * s, 1.11 * s, z, false);
        }
    },
    mill(m, g) {
        for (let i = 0; i < 3; i++) m.part(g, 1.0 - i * 0.18, 0.7, 1.0 - i * 0.18, i % 2 ? 0xf3ead2 : 0xe0d4b4, 0, 0.35 + i * 0.7, 0);
        m.part(g, 0.8, 0.4, 0.8, 0xc8402e, 0, 2.3, 0);
        const sail = new THREE.Group();
        sail.position.set(0, 1.9, 0.5);
        g.add(sail);
        for (let k = 0; k < 4; k++) {
            const b = new THREE.Group();
            b.rotation.z = (k * Math.PI) / 2;
            m.part(b, 0.1, 1.2, 0.04, WOOD2, 0, 0.6, 0);
            m.part(b, 0.32, 0.9, 0.03, 0xf3ead2, 0.2, 0.7, 0.02);
            sail.add(b);
        }
        g.spin = sail;
        g.axis = 'z';
    },
    pumpkins(m, g) {
        for (const [x, z, s] of [[0, 0, 1], [0.55, 0.2, 0.7], [-0.5, 0.25, 0.75], [0.1, 0.5, 0.6]]) {
            m.part(g, 0.6 * s, 0.45 * s, 0.55 * s, 0x9ad04a, x, 0.23 * s, z);
            m.part(g, 0.08, 0.14, 0.08, 0x5a7a2a, x, 0.5 * s, z, false);
            m.part(g, 0.14 * s, 0.1 * s, 0.04, 0x2a1a3a, x, 0.28 * s, z + 0.29 * s, false);
        }
    },
    scarecrow(m, g) {
        m.part(g, 0.12, 1.8, 0.12, WOOD2, 0, 0.9, 0);
        m.part(g, 1.3, 0.1, 0.1, WOOD2, 0, 1.4, 0);
        m.part(g, 0.6, 0.7, 0.3, 0x8a5ad8, 0, 1.25, 0);
        m.part(g, 0.4, 0.36, 0.34, 0x7dff4a, 0, 1.82, 0);
        m.part(g, 0.3, 0.3, 0.04, 0xf3c8a0, 0, 1.82, 0.19, false); // (también lleva careta)
        m.part(g, 0.6, 0.06, 0.6, 0xe8c050, 0, 2.03, 0);
        m.part(g, 0.34, 0.24, 0.34, 0xe8c050, 0, 2.17, 0);
    },
    fountain(m, g) {
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            m.part(g, 0.7, 0.5, 0.4, i % 2 ? 0xe8c050 : 0xd8a830, Math.cos(a) * 1.4, 0.25, Math.sin(a) * 1.4).rotation.y = -a;
        }
        m.part(g, 2.5, 0.06, 2.5, 0x5ac8ff, 0, 0.42, 0, false);
        m.part(g, 0.5, 1.2, 0.5, 0xe8c050, 0, 0.8, 0);
        m.part(g, 1.2, 0.2, 1.2, 0xffd23f, 0, 1.45, 0);
        m.part(g, 0.3, 0.6, 0.3, 0xe8c050, 0, 1.85, 0);
        m.lit(g, 0.4, 0.4, 0.4, 0x7dff4a, 0, 2.35, 0);
        g.water = [];
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2, w = m.part(g, 0.12, 0.12, 0.12, 0xb8ecff, Math.cos(a) * 0.6, 1.6, Math.sin(a) * 0.6, false);
            w.userData.a = a;
            g.water.push(w);
        }
    },
    statue(m, g) {
        m.part(g, 1.2, 0.6, 1.2, STONE, 0, 0.3, 0);
        for (const [x, s] of [[-0.35, 0.9], [0.35, 1.0]]) {
            const st = buildAlien(m, 0xb8b2a8, 0xa8a298, 0x989288);
            st.remove(st.party);
            st.position.set(x, 0.6, 0);
            st.scale.setScalar(s);
            g.add(st);
        }
    },
    discoball(m, g) {
        m.part(g, 0.12, 2.8, 0.12, 0x3a3a4a, 0, 1.4, 0);
        m.part(g, 0.8, 0.08, 0.08, 0x3a3a4a, 0.35, 2.8, 0);
        const b = new THREE.Group();
        b.position.set(0.7, 2.25, 0);
        g.add(b);
        for (let i = 0; i < 8; i++) m.part(b, 0.2, 0.2, 0.2, i % 3 ? 0xd8e0e8 : 0x9fdcff, ((i & 1) - 0.5) * 0.2, (((i >> 1) & 1) - 0.5) * 0.2, ((i >> 2) - 0.5) * 0.2, false);
        g.spin = b;
    },
    tree(m, g) {
        m.part(g, 0.5, 2.6, 0.5, 0xd8c8f0, 0, 1.3, 0);
        for (const [y, w, c] of [[2.8, 2.4, 0x8a5ad8], [3.4, 1.8, 0x9a6ae8], [3.9, 1.0, 0xb87dff]]) m.part(g, w, 0.5, w, c, 0, y, 0);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            m.lit(g, 0.2, 0.2, 0.2, [0xff7ae0, 0x5af0ff, 0xffe03a][i % 3], Math.cos(a) * 1.1, 2.5, Math.sin(a) * 1.1);
        }
    },
    // Los exclusivos de la nave madre
    arch(m, g) {
        for (const x of [-1.2, 1.2]) for (let k = 0; k < 4; k++) m.part(g, 0.4, 0.6, 0.4, 0x9fdcff, x - Math.sign(x) * k * 0.12, 0.3 + k * 0.6, 0);
        for (let k = 0; k < 5; k++) m.part(g, 0.5, 0.36, 0.4, 0x9fdcff, -0.9 + k * 0.45, 2.6 + Math.sin((k / 4) * Math.PI) * 0.35, 0);
        m.lit(g, 0.3, 0.3, 0.3, 0xff7ae0, 0, 3.15, 0);
    },
    totem(m, g) {
        [[0x8a5ad8, 0.9], [0x3ac8b0, 0.8], [0xff7ae0, 0.85], [0x7dff4a, 0.7]].forEach(([c, w], k) => {
            m.part(g, w, 0.7, w, c, 0, 0.35 + k * 0.7, 0);
            for (const x of [-0.16, 0.16]) m.lit(g, 0.14, 0.14, 0.04, 0xffe03a, x, 0.45 + k * 0.7, w / 2 + 0.03);
        });
        for (const s of [-1, 1]) m.part(g, 0.7, 0.14, 0.2, 0x8a5ad8, s * 0.6, 2.4, 0);
    },
    holo(m, g) {
        m.part(g, 1.0, 0.4, 1.0, 0x4a5868, 0, 0.2, 0);
        m.lit(g, 0.6, 0.06, 0.6, 0x5af0ff, 0, 0.43, 0);
        const p = new THREE.Group();
        p.position.y = 1.6;
        g.add(p);
        const mat = m.own(new THREE.MeshBasicMaterial({ color: 0x5af0ff, transparent: true, opacity: 0.55, depthWrite: false }));
        for (const [w, y] of [[0.6, 0.45], [1.0, 0.15], [1.0, -0.15], [0.6, -0.45]]) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, w), mat);
            b.position.y = y;
            p.add(b);
        }
        g.spin = p;
    },
    rocket(m, g) {
        for (const s of [-1, 1]) m.part(g, 0.2, 0.9, 0.6, 0xc8402e, s * 0.45, 0.45, 0);
        for (let k = 0; k < 4; k++) m.part(g, 0.7 - k * 0.12, 0.8, 0.7 - k * 0.12, k % 2 ? 0xf3ead2 : 0xd8e0e8, 0, 0.6 + k * 0.8, 0);
        m.part(g, 0.3, 0.5, 0.3, 0xc8402e, 0, 3.6, 0);
        m.lit(g, 0.3, 0.3, 0.04, 0x9fdcff, 0, 2.1, 0.33);
    },
    pond(m, g) {
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            m.part(g, 0.5, 0.24, 0.4, STONE, Math.cos(a) * 1.15, 0.12, Math.sin(a) * 1.15).rotation.y = -a;
        }
        m.lit(g, 1.9, 0.06, 1.9, 0x7dff9a, 0, 0.1, 0);
        for (const [x, z] of [[-0.4, 0.2], [0.35, -0.3]]) m.part(g, 0.36, 0.06, 0.3, 0x3a8a6a, x, 0.16, z, false);
    },
    saucer(m, g) {
        m.part(g, 0.14, 1.0, 0.14, 0x3a3a4a, 0, 0.5, 0);
        const p = new THREE.Group();
        p.position.y = 1.3;
        p.rotation.z = 0.25;
        g.add(p);
        m.part(p, 1.6, 0.16, 1.6, METAL, 0, 0, 0);
        m.part(p, 1.1, 0.2, 1.1, METAL2, 0, -0.14, 0);
        m.part(p, 0.6, 0.4, 0.6, GLASS, 0, 0.26, 0);
        for (let k = 0; k < 6; k++) m.lit(p, 0.12, 0.08, 0.12, k % 2 ? 0xffe03a : 0xff3e5e, Math.cos(k) * 0.72, 0, Math.sin(k) * 0.72);
    },
};

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
        // La decoración (escondida hasta que la compras)
        this.decor = {};
        const keep = [];
        for (const d of ALL_DECOR) {
            const g = new THREE.Group(), at = decorAt(d);
            g.position.set(at.x, 0, at.z);
            g.rotation.y = Math.atan2(VILLAGE.cx - at.x, VILLAGE.cz - at.z) || 0; // (de cara al centro)
            DECO[d.id](this, g);
            g.visible = false;
            r.add(g);
            this.decor[d.id] = { g, pop: 0, base: g.scale.x };
            keep.push(g);
        }
        this.bake([r], [...keep, this.flames, this.fireGlow, ...Object.values(this.fallen || {})]);
        for (const f of Object.values(this.fallen || {})) this.bake([f], []);
        for (const { g } of Object.values(this.decor)) this.bake([g], [g.spin, ...(g.water || [])].filter(Boolean));
        // Los habitantes (se quedan a vivir con el pueblo crecido): alienígenas pequeños, también
        // disfrazados, que pasean por el cráter
        this.residents = [[0xffb07a, 0x5a8ac8, 0xd84a3a], [0x7ad8ff, 0xd8a03a, 0x3a3a4a], [0xff7ae0, 0x4a8a6a, 0xe8c050]].map(([sk, co, ha], i) => {
            const a = buildAlien(this, sk, co, ha);
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
            // Árboles tumbados hacia fuera a los dos lados (más cuanto más cerca del surco y del
            // principio, donde la nave tocó tierra). Aparte: se quitan cuando su calle se pavimenta
            const fallen = new THREE.Group();
            r.add(fallen);
            (this.fallen = this.fallen || {})[g.def.id] = fallen;
            let i = 0;
            for (let rr = g.parkR + 2; rr < g.endR - 0.5; rr += 1.9, i++) {
                for (const side of [-1, 1]) {
                    const j = (i * 7 + (side > 0 ? 3 : 0)) % 5, w = furrowHalf(g, rr), d = w + 1.6 + j * 0.42 + (i % 2) * 0.3;
                    const k = Math.min(1, Math.max(0, (rr - g.parkR) / (g.endR - g.parkR))), p = P(rr + (j - 2) * 0.2, side, d);
                    const pivot = new THREE.Group();
                    pivot.position.set(p.x, 0, p.z);
                    pivot.rotation.y = -g.a;
                    const tree = new THREE.Group(), sc = 0.8 + ((i * 3 + j) % 4) * 0.12;
                    tree.rotation.set(side * (0.32 + 0.4 * k), (j - 2) * 0.12, (j - 2) * 0.05);
                    tree.scale.setScalar(sc);
                    this.part(tree, 0.3, 1.0, 0.3, 0x7a4f2a, 0, 0.5, 0);
                    this.part(tree, 1.5, 0.9, 1.5, 0x3d9a34, 0, 1.35, 0).rotation.y = i * 0.7;
                    this.part(tree, 1.05, 0.7, 1.05, 0x4caf3c, 0, 2.0, 0).rotation.y = i * 0.7 + 0.4;
                    this.part(tree, 0.55, 0.4, 0.55, 0x5cc04a, 0, 2.5, 0);
                    this.part(tree, 0.7, 0.18, 0.4, DIRT[(i + j) % 3], 0, 0.06, -side * 0.35);
                    pivot.add(tree);
                    fallen.add(pivot);
                }
            }
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

    // Lo que tienes del pueblo, a la vista (lo nuevo sale con un bote)
    setDecor(owned, pop = true) {
        for (const [id, d] of Object.entries(this.decor)) {
            const on = owned.includes(id);
            if (on && !d.g.visible && pop) d.pop = 1;
            d.g.visible = on;
        }
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

    // ---------- El pueblo en tres fases (content/merchants.js: TOWN) ----------
    // Las casas de los mercaderes (cada una con su color y un toque alien: antena con su bola que
    // brilla de noche) y las farolas de las calles pavimentadas. El suelo (plaza empedrada, rondas
    // y calles) lo pinta la granja (Farm.setTownPhase)
    buildTown() {
        const g = (this.townG = new THREE.Group());
        this.root.add(g);
        this.houses = {};
        this.lamps = {};
        for (const geo of Object.values(this.geo)) {
            if (geo.def.mother) continue;
            const d = geo.def, lot = houseLot(geo), h = new THREE.Group();
            h.position.set(lot.x, 0, lot.z);
            h.rotation.y = lot.ry;
            // Base, paredes, tejado a dos aguas (del color de su gorro), puerta, ventanas y antena
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
            this.houses[d.id] = { g: h, pop: 0 };
            // Su calle pavimentada: losas de piedra sobre el surco, con bordillo claro
            const road = new THREE.Group(), ca = Math.cos(geo.a), sa = Math.sin(geo.a);
            let n = 0;
            for (let rr = VILLAGE.R + 0.4; rr < geo.endR + 0.4; rr += 0.8, n++) {
                const w = furrowHalf(geo, rr) * 2 + 0.3, x = VILLAGE.cx + ca * rr, z = VILLAGE.cz + sa * rr, th = n % 2 ? 0.1 : 0.106;
                this.part(road, 0.8, th, w, n % 2 ? 0xa49a88 : 0x968c7a, x, th / 2, z, false).rotation.y = -geo.a;
                for (const sd of [-1, 1]) this.part(road, 0.76, 0.16, 0.2, 0xd4c8b0, x - sa * sd * (w / 2), 0.08, z + ca * sd * (w / 2), false).rotation.y = -geo.a;
            }
            road.visible = false;
            g.add(road);
            this.bake([road], []);
            this.houses[d.id].road = road;
            // Las farolas de su calle (a los dos lados, alternas)
            const lamps = new THREE.Group(), c = Math.cos(geo.a), s = Math.sin(geo.a);
            for (let t = geo.parkR + 2, k = 0; t < geo.endR - 1; t += 4.5, k++) {
                const off = (furrowHalf(geo, t) + 0.7) * (k % 2 ? 1 : -1), x = VILLAGE.cx + c * t - s * off, z = VILLAGE.cz + s * t + c * off;
                this.part(lamps, 0.12, 2.4, 0.12, DARK, x, 1.2, z);
                this.lit(lamps, 0.34, 0.3, 0.34, 0xfff0a0, x, 2.5, z);
            }
            lamps.visible = false;
            g.add(lamps);
            this.bake([lamps], []);
            this.lamps[d.id] = lamps;
        }
    }

    // ---------- Propuesta de expansión (fase 4: solo para verla, no está en el juego) ----------
    // Todo el claro hecho ciudad: dos rondas de barrio (casitas de colores de cara al centro, con
    // su huerto y alguna antena alien), la calle del mercado (toldos a los dos lados de una calle),
    // el parque alien con su estanque en la cuña de la avenida de la nave madre y el barrio
    // tecnológico alrededor de su plataforma (cúpulas y antenas)
    buildPlan() {
        const g = (this.planG = new THREE.Group());
        this.root.add(g);
        const geos = Object.values(this.geo), mother = geos.find((q) => q.def.mother);
        const WALLS = [0xf3e6c4, 0xe8c8a0, 0xc8dce8, 0xe0b8c8, 0xd8e0b0, 0xf0d0a0], ROOFS = [0xc8402e, 0x3a6ab8, 0x5a8a3a, 0x8a4a8a, 0xd88a2a];
        const nearStreet = (a, r, m) => geos.some((q) => !q.def.mother && Math.abs(Math.atan2(Math.sin(a - q.a), Math.cos(a - q.a))) * r < (q.half || 2) + m);
        const inPark = (a) => Math.abs(Math.atan2(Math.sin(a - mother.a), Math.cos(a - mother.a))) < 0.55;
        const house = (x, z, ry, k, big = 1) => {
            const h = new THREE.Group();
            h.position.set(x, 0, z);
            h.rotation.y = ry;
            const W = 2.2 * big, D = 1.9 * big, H = 1.4 * big;
            this.part(h, W + 0.3, 0.16, D + 0.3, STONE, 0, 0.08, 0);
            this.part(h, W, H, D, WALLS[k % WALLS.length], 0, 0.16 + H / 2, 0);
            for (let i = 0; i < 3; i++) this.part(h, W + 0.3 - i * 0.7, 0.3, D + 0.24 - i * 0.02, ROOFS[k % ROOFS.length], 0, 0.16 + H + 0.15 + i * 0.3, 0);
            this.part(h, 0.5, 0.8, 0.06, DARK, 0, 0.56, D / 2 + 0.01);
            this.lit(h, 0.4, 0.36, 0.06, 0xffe08a, W / 2 - 0.45, 0.16 + H * 0.6, D / 2 + 0.01);
            if (k % 3 === 0) { this.part(h, 0.06, 0.8, 0.06, METAL, -W / 2 + 0.3, 0.16 + H + 1.1, 0); this.lit(h, 0.16, 0.16, 0.16, 0x7dff4a, -W / 2 + 0.3, 0.16 + H + 1.55, 0); }
            // Su huerto detrás
            for (let i = 0; i < 3; i++) this.part(h, 0.5, 0.14, 0.9, [0x5aa83a, 0x4a9a34, 0x8a5a3a][i], -0.7 + i * 0.7, 0.07, -D / 2 - 0.8, false);
            g.add(h);
        };
        // Las casas: anillos de barrio (r 25 y 31), entre calles, de cara al centro
        let k = 0;
        for (const R of [25.5, 31.5, 37.5]) {
            const step = 5.4 / R;
            for (let a = 0; a < Math.PI * 2; a += step) {
                if (nearStreet(a, R, 3.4) || inPark(a) || R > this.reach((a * 180) / Math.PI) - 4) continue;
                const x = VILLAGE.cx + Math.cos(a) * R, z = VILLAGE.cz + Math.sin(a) * R;
                house(x, z, Math.atan2(VILLAGE.cx - x, VILLAGE.cz - z), k++, R > 35 ? 1.15 : 1);
            }
        }
        // La calle del mercado: la del primero (toldos de rayas a los dos lados)
        const mk = geos.find((q) => q.def.id === 'm0'), c = Math.cos(mk.a), s = Math.sin(mk.a);
        for (let t = mk.parkR + 7, i = 0; t < mk.endR - 2; t += 2.4, i++) for (const sd of [-1, 1]) {
            const off = (furrowHalf(mk, t) + 1.6) * sd, x = VILLAGE.cx + c * t - s * off, z = VILLAGE.cz + s * t + c * off, st = new THREE.Group();
            st.position.set(x, 0, z);
            st.rotation.y = -mk.a;
            this.part(st, 1.8, 0.7, 1.0, WOOD, 0, 0.35, 0);
            for (let j = 0; j < 4; j++) this.part(st, 0.45, 0.1, 1.4, j % 2 ? 0xfff3d6 : [0xc8402e, 0x3a8ad8, 0x5aa83a][i % 3], -0.68 + j * 0.45, 1.6 - j * 0.02, 0, false);
            for (const px of [-0.85, 0.85]) this.part(st, 0.08, 1.6, 0.08, WOOD2, px, 0.8, 0.6, false);
            this.part(st, 0.4, 0.3, 0.4, [0xffd23f, 0xe8352a, 0xf08a1e][(i + sd + 3) % 3], 0, 0.85, 0);
            g.add(st);
        }
        // El parque alien: árboles de copas moradas y turquesa, un estanque redondo y bancos
        const pa = mother.a + 0.32, pc = { x: VILLAGE.cx + Math.cos(pa) * 26, z: VILLAGE.cz + Math.sin(pa) * 26 };
        for (let i = 0; i < 25; i++) {
            const q = Math.sqrt(i / 25) * 5.2, aa = i * 2.4, x = pc.x + Math.cos(aa) * q, z = pc.z + Math.sin(aa) * q;
            if (i < 6) { this.part(g, 1.0, 0.08, 1.0, [0x4aa8e0, 0x3f98d4][i % 2], x, 0.04, z, false); continue; }
            this.part(g, 0.24, 1.4, 0.24, WOOD2, x, 0.7, z);
            this.lit(g, 1.1, 0.9, 1.1, [0xb87dff, 0x5af0ff, 0x7dff4a][i % 3], x, 1.8, z);
        }
        const pb = mother.a - 0.32;
        for (let i = 0; i < 18; i++) {
            const q = Math.sqrt(i / 18) * 4.6, aa = i * 2.4, x = VILLAGE.cx + Math.cos(pb) * 27 + Math.cos(aa) * q, z = VILLAGE.cz + Math.sin(pb) * 27 + Math.sin(aa) * q;
            this.part(g, 0.22, 1.2, 0.22, WOOD2, x, 0.6, z);
            this.part(g, 1.0, 0.8, 1.0, [0x4caf3c, 0x3d9a34][i % 2], x, 1.55, z);
        }
        // El barrio tecnológico, junto a la plataforma de la nave madre: cúpulas y antenas
        for (const [dr, da] of [[-4, -0.35], [-4, 0.35], [5, -0.25], [5, 0.25]]) {
            const rr = mother.padR + dr, x = VILLAGE.cx + Math.cos(mother.a + da) * rr, z = VILLAGE.cz + Math.sin(mother.a + da) * rr;
            for (let i = 0; i < 3; i++) this.part(g, 3 - i * 0.9, 0.6, 3 - i * 0.9, i === 2 ? GLASS : METAL, x, 0.3 + i * 0.6, z);
            this.part(g, 0.1, 2.0, 0.1, METAL2, x + 1.2, 1.0, z, false);
            this.lit(g, 0.24, 0.24, 0.24, 0x7dff4a, x + 1.2, 2.1, z);
        }
        this.bake([g], []);
        g.visible = false;
    }

    // La fase del pueblo: qué casas y farolas se ven (pop: las nuevas, con un bote)
    setTownPhase(phase, pop = true) {
        if (phase >= 4 && !this.planG) this.buildPlan();
        if (this.planG) this.planG.visible = phase >= 4;
        if (!this.townG) this.buildTown();
        const paved = pavedIn(phase);
        for (const [id, H] of Object.entries(this.houses)) {
            const on = paved.includes(id);
            if (on && !H.g.visible && pop) H.pop = 1;
            H.g.visible = on;
            this.lamps[id].visible = on && phase >= 3;
            H.road.visible = on;
            if (this.fallen[id]) this.fallen[id].visible = !on;
        }
        this.townPhase = phase;
    }

    // Cuántos se han quedado a vivir
    setResidents(n) {
        this.residents.forEach((R, i) => (R.g.visible = i < n));
    }

    // ¿Hay alguien? (la hoguera, encendida)
    get anyone() {
        return this.visitors.some((v) => v.open);
    }

    update(dt, time, nightK = 0) {
        for (const v of this.visitors) v.update(dt, time, nightK);
        // Las casas nuevas, con un bote
        if (this.houses) for (const H of Object.values(this.houses)) if (H.pop > 0) {
            H.pop = Math.max(0, H.pop - dt * 1.4);
            H.g.scale.set(1, Math.max(0.0001, back(Math.min(1, (1 - H.pop) * 1.2))), 1);
        }
        if (this.marketPop > 0) {
            this.marketPop = Math.max(0, this.marketPop - dt * 1.5);
            this.marketG.scale.set(1, Math.max(0.0001, back(Math.min(1, (1 - this.marketPop) * 1.2))), 1);
        }
        // De noche se encienden las farolas, las bombillas y los cristales
        const night = nightK > 0.4;
        if (this.litMats && night !== this.litNight) {
            this.litNight = night;
            for (const L0 of this.litMats.values()) L0.mat.color.copy(night ? L0.on : L0.off);
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
        // Los habitantes pasean por el cráter (sin pisar la fuente) y se paran a mirar
        for (const R of this.residents) {
            if (!R.g.visible) continue;
            if (!R.goal && (R.wait -= dt) <= 0) {
                const a = Math.random() * Math.PI * 2, d = 2.2 + Math.random() * 4.6;
                R.goal = { x: VILLAGE.cx + Math.cos(a) * d, z: VILLAGE.cz + Math.sin(a) * d };
            }
            let moving = false;
            if (R.goal) {
                const dx = R.goal.x - R.x, dz = R.goal.z - R.z, d = Math.hypot(dx, dz);
                if (d < 0.1) {
                    R.goal = null;
                    R.wait = 1.5 + Math.random() * 4;
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
        for (const d of Object.values(this.decor)) {
            if (!d.g.visible) continue;
            if (d.g.spin) d.g.spin.rotation[d.g.axis || 'y'] = time * 1.6;
            if (d.g.water) d.g.water.forEach((w, k) => {
                const t = (time * 0.8 + k / 6) % 1, a = w.userData.a;
                w.position.set(Math.cos(a) * (0.3 + t * 0.9), 1.6 + Math.sin(t * Math.PI) * 0.5 - t * 1.0, Math.sin(a) * (0.3 + t * 0.9));
            });
            if (d.pop > 0) {
                d.pop = Math.max(0, d.pop - dt * 1.6);
                const k = 1 - d.pop;
                d.g.scale.setScalar(d.base * Math.max(0.0001, back(Math.min(1, k * 1.2))));
            }
        }
        this.updateFx(dt);
    }
}
