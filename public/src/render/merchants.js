import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { MERCHANTS, VILLAGE, DECOR, decorAt, polar } from '../content/merchants.js';
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
            const r = Math.max(R + 8, Math.min(VILLAGE.pad, reach(def.angle) - 8));
            return [def.id, { def, a, dir: [-c, -s], pad: polar(r, def.angle), padR: r, stall, half: 6 }];
        }
        const sc = def.len / 4.9, half = 1.95 * sc + 0.3; // (medio ancho del ovni)
        const parkR = R + 1.1 + half, endR = Math.max(parkR + 9, reach(def.angle) - 2.5);
        return [def.id, { def, a, dir: [-c, -s], sc, half, parkR, endR, park: polar(parkR, def.angle), start: polar(endR, def.angle), stall }];
    }));
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
    const P = (w, h, x, y, c, z = 0, out = true) => m.part(g, w, h, 0.06, c, side < 0 ? -x : x, y, z, out);
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
            P(4.85, 1.9, 0, 1.3, 0xf0c030); P(4.85, 0.18, 0, 0.62, 0x2a3a5a, 0.02, false);
            for (let k = 0; k < 5; k++) win(0.66, 0.6, -1.6 + k * 0.85, 1.72);
            win(0.5, 1.2, -2.15, 1.3); P(0.9, 0.3, -1.9, 2.1, 0x2a2624, 0.04, false); // la puerta y el cartel de la línea
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
            P(4.85, 1.85, 0, 1.25, 0xf6f3ea); P(4.85, 0.3, 0, 0.55, 0xff8ab8, 0.02, false);
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
            P(4.85, 0.22, 0.1, 0.95, 0x6a4a2a, 0.03, false);
            win(0.8, 0.55, -1.85, 1.5); win(0.9, 0.5, 0.4, 1.55); win(0.9, 0.5, 1.6, 1.55);
            P(0.5, 1.0, -0.6, 1.0, 0x8a6a4a, 0.03, false);
            wheel(-1.5); wheel(1.6);
            break;
        }
        case 'tractor': {
            P(3.6, 1.2, -0.4, 1.0, CARD, -0.03);
            P(2.4, 0.9, -0.9, 1.0, 0x4a9a3a); P(1.4, 1.5, 0.9, 1.6, 0x4a9a3a); win(0.9, 0.9, 0.9, 1.75);
            P(0.16, 0.9, -1.4, 1.85, 0x3a3a3a); // el tubo de escape
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
        this.setLevel(1);
        this.pose(0);
    }

    get present() {
        return this.want > 0;
    }

    get open() {
        return this.step >= T.open;
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
        if (dealDance(this, dt)) {
            // (bailando)
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
        this.setLevel(1);
        this.pose(0);
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
            P(w * 0.86, 0.8, w * 0.86, c, 0, y, 0).rotation.y = Math.PI / 4;
        });
        P(12.2, 0.4, 12.2, 0x3ac8b0, 0, Y0 + 2.2, 0);
        P(10.4, 0.4, 10.4, 0x5ad8c8, 0, Y0 + 2.2, 0).rotation.y = Math.PI / 4;
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
        P(9.6, 1.4, 9.6, MET[1], 0, Y0, 0).rotation.y = Math.PI / 4;
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
            P(w * 0.9, h, w * 0.9, c, 0, y - h / 2, 0).rotation.y = Math.PI / 4;
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
        if (dealDance(this, dt)) {
            // (bailando)
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
            m.part(g, 0.34, 0.36, 0.34, 0xffe9a0, x, 2.35, 0);
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
            m.part(g, 0.14, 0.16, 0.14, [0xffe03a, 0xff6a5a, 0x7dff4a, 0x6ac8ff][i % 4], x, y, 0, false);
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
        m.part(g, 0.4, 0.4, 0.4, 0x7dff4a, 0, 2.35, 0);
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
            m.part(g, 0.2, 0.2, 0.2, [0xff7ae0, 0x5af0ff, 0xffe03a][i % 3], Math.cos(a) * 1.1, 2.5, Math.sin(a) * 1.1, false);
        }
    },
};

// ---------- El pueblo entero ----------
export class Village extends VoxelModel {
    // reach(grados): hasta dónde llega la zona en esa dirección (desde el centro)
    constructor(outline, reach) {
        super(outline);
        const r = this.root;
        this.geo = villageGeometry(reach);
        this.buildGround(r);
        this.buildFire(r);
        // La decoración (escondida hasta que la compras)
        this.decor = {};
        const keep = [];
        for (const d of DECOR) {
            const g = new THREE.Group(), at = decorAt(d);
            g.position.set(at.x, 0, at.z);
            g.rotation.y = Math.atan2(VILLAGE.cx - at.x, VILLAGE.cz - at.z) || 0; // (de cara al centro)
            DECO[d.id](this, g);
            g.visible = false;
            r.add(g);
            this.decor[d.id] = { g, pop: 0, base: g.scale.x };
            keep.push(g);
        }
        this.bake([r], [...keep, this.flames, this.fireGlow]);
        for (const { g } of Object.values(this.decor)) this.bake([g], [g.spin, ...(g.water || [])].filter(Boolean));
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
            this.part(r, s, 0.03, s * 0.8, 0x3a3028, VILLAGE.cx + Math.cos(a) * d, 0.015, VILLAGE.cz + Math.sin(a) * d, false);
        }
        for (const g of geos) {
            if (g.def.mother) continue;
            const c = Math.cos(g.a), s = Math.sin(g.a), nx = -s, nz = c, P = (rr, side, w) => ({ x: VILLAGE.cx + c * rr + nx * side * w, z: VILLAGE.cz + s * rr + nz * side * w });
            let n = 0;
            // El fondo del surco: tierra oscura y removida
            for (let rr = R + 0.4; rr < g.endR; rr += 0.8, n++) {
                const w = furrowHalf(g, rr) * 2, p = P(rr, 0, 0);
                this.part(r, 0.84, 0.05, w, TRENCH[n % 2], p.x, 0.025, p.z, false).rotation.y = -g.a;
                this.part(r, 0.84, 0.06, w * 0.35, 0x3a2414, p.x, 0.04, p.z, false).rotation.y = -g.a;
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
            // principio, donde la nave tocó tierra)
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
                    r.add(pivot);
                }
            }
        }
        // El claro de la nave madre: quemado en círculo, con piedras alrededor
        const M = geos.find((g) => g.def.mother);
        if (M) for (let k = 0; k < 18; k++) {
            const a = (k / 18) * Math.PI * 2;
            this.part(r, 0.5, 0.3, 0.4, k % 2 ? STONE : 0x8a847a, M.pad.x + Math.cos(a) * 4.6, 0.15, M.pad.z + Math.sin(a) * 4.6).rotation.y = -a;
            if (k % 3 === 0) this.part(r, 1.4, 0.03, 1.0, 0x3a3028, M.pad.x + Math.cos(a) * 2.2, 0.015, M.pad.z + Math.sin(a) * 2.2, false);
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
        for (const ry of [0.5, -0.6]) this.part(r, 1.0, 0.16, 0.16, DARK, F.x, 0.14, F.z).rotation.y = ry;
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

    // ¿Hay alguien? (la hoguera, encendida)
    get anyone() {
        return this.visitors.some((v) => v.open);
    }

    update(dt, time, nightK = 0) {
        for (const v of this.visitors) v.update(dt, time, nightK);
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
