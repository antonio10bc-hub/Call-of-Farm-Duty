import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

// Los edificios de los prados de animales (vacas, ovejas y gallinas): cada nivel del campo
// añade alguno (y se quedan los de antes), así su zona se va llenando y no tiene solo animales.
// Cada pieza es un modelo voxel con su contorno, mirando hacia +z, en medidas del mundo.
//   lv     nivel del campo desde el que está
//   r      radio de lo que ocupa (los animales no pasan por ahí)
//   build  la monta (m: el modelo, g: su grupo)
const WOOD = 0x9a6a3a, WOOD2 = 0x7a4f2a, DARK = 0x4a2e1a, HAY = 0xf0c850, HAY2 = 0xd8a830;
const STONE = 0xa8a298, STONE2 = 0x8a847a, WHITE = 0xf6f3ea, METAL = 0xb8c4cc, METAL2 = 0x8a98a8;
const WATER = 0x5ab8e8, RED = 0xc8402e, RED2 = 0xa8301e, ROOF = 0x6a4a3a;

// Tejado a dos aguas en escalones (a lo largo de x): w ancho, d fondo, y base, n escalones
function roof(m, g, w, d, y, color, n = 4, dark = DARK) {
    for (let i = 0; i < n; i++) m.part(g, w + 0.2, 0.18, d + 0.2 - (i * (d + 0.2)) / n, i % 2 ? color : color, 0, y + i * 0.18, 0);
    m.part(g, w + 0.24, 0.08, 0.12, dark, 0, y + n * 0.18, 0, false);
}
// Una casita: paredes, puerta, ventana y tejado
function shed(m, g, w, d, h, wall, roofC, trim = WHITE) {
    m.part(g, w, h, d, wall, 0, h / 2, 0);
    m.part(g, w * 0.32, h * 0.62, 0.06, DARK, 0, h * 0.31, d / 2 + 0.02, false);
    m.part(g, w * 0.36, 0.06, 0.07, trim, 0, h * 0.64, d / 2 + 0.03, false);
    for (const s of [-1, 1]) m.part(g, 0.3, 0.26, 0.06, 0x2a3a4a, s * w * 0.33, h * 0.62, d / 2 + 0.02, false);
    roof(m, g, w, d, h, roofC);
}
function bales(m, g, list) {
    for (const [x, y, z, ry] of list) {
        const b = m.part(g, 0.8, 0.46, 0.5, HAY, x, y + 0.23, z);
        b.rotation.y = ry || 0;
        for (const dx of [-0.2, 0.2]) m.part(b, 0.05, 0.48, 0.52, HAY2, dx, 0, 0, false);
    }
}
function trough(m, g, x, z, w = 1.5) {
    for (const s of [-1, 1]) m.part(g, 0.1, 0.3, 0.1, DARK, x + s * (w / 2 - 0.15), 0.15, z);
    m.part(g, w, 0.32, 0.5, WOOD, x, 0.42, z);
    m.part(g, w - 0.16, 0.04, 0.36, WATER, x, 0.59, z, false);
}
function fence(m, g, x0, z0, x1, z1) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 1.1));
    for (let i = 0; i <= n; i++) m.part(g, 0.12, 0.7, 0.12, WOOD2, x0 + ((x1 - x0) * i) / n, 0.35, z0 + ((z1 - z0) * i) / n);
    for (const y of [0.3, 0.58]) {
        const r = m.part(g, L, 0.08, 0.06, WOOD, (x0 + x1) / 2, y, (z0 + z1) / 2);
        r.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    }
}
// Molinete de agua (de los prados): torre de celosía y una rueda de palas que gira
function windpump(m, g) {
    for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        const leg = m.part(g, 0.1, 3.6, 0.1, METAL2, x * 0.6, 1.8, z * 0.6);
        leg.rotation.set(z * 0.12, 0, -x * 0.12);
    }
    for (const y of [0.8, 1.8, 2.8]) m.part(g, 0.9 - y * 0.12, 0.06, 0.9 - y * 0.12, METAL2, 0, y, 0, false);
    m.part(g, 0.3, 0.3, 0.5, METAL, 0, 3.7, 0);
    m.part(g, 0.08, 0.5, 0.9, METAL2, 0, 3.75, -0.6); // la cola
    const rotor = new THREE.Group();
    rotor.position.set(0, 3.7, 0.32);
    for (let i = 0; i < 8; i++) {
        const b = new THREE.Group();
        b.rotation.z = (i / 8) * Math.PI * 2;
        m.part(b, 0.14, 0.7, 0.04, i % 2 ? RED : WHITE, 0, 0.45, 0);
        rotor.add(b);
    }
    g.add(rotor);
    m.spin = rotor;
    m.part(g, 0.6, 0.5, 0.6, STONE, 0.9, 0.25, 0.3); // el depósito
    m.part(g, 0.5, 0.04, 0.5, WATER, 0.9, 0.51, 0.3, false);
}
// Molino de viento grande (el de las ovejas): torre de piedra, tejado y aspas que giran
function windmill(m, g) {
    for (let i = 0; i < 5; i++) m.part(g, 1.8 - i * 0.18, 0.9, 1.8 - i * 0.18, i % 2 ? STONE : 0xb8b2a8, 0, 0.45 + i * 0.9, 0);
    m.part(g, 0.5, 0.8, 0.06, DARK, 0, 0.4, 0.92, false);
    m.part(g, 0.3, 0.3, 0.06, 0x2a3a4a, 0, 2.6, 0.7, false);
    roof(m, g, 1.3, 1.3, 4.5, ROOF, 4);
    const rotor = new THREE.Group();
    rotor.position.set(0, 4.3, 0.85);
    m.part(rotor, 0.2, 0.2, 0.2, DARK, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
        const b = new THREE.Group();
        b.rotation.z = (i / 4) * Math.PI * 2 + 0.4;
        m.part(b, 0.1, 2.0, 0.06, WOOD2, 0, 1.0, 0);
        m.part(b, 0.5, 1.5, 0.04, 0xf3ead2, 0.3, 1.2, 0.02);
        rotor.add(b);
    }
    g.add(rotor);
    m.spin = rotor;
}
function silo(m, g, h = 3.4, c = METAL) {
    for (let i = 0; i < 4; i++) m.part(g, 1.2, h / 4, 1.2, i % 2 ? c : METAL2, 0, (h / 4) * (i + 0.5), 0);
    m.part(g, 1.0, 0.3, 1.0, RED, 0, h + 0.15, 0);
    m.part(g, 0.6, 0.2, 0.6, RED, 0, h + 0.4, 0);
    m.part(g, 0.08, h, 0.08, DARK, 0.64, h / 2, 0, false); // la escalera
}
function crates(m, g, list, top = WHITE) {
    for (const [x, y, z] of list) {
        m.part(g, 0.6, 0.36, 0.5, WOOD, x, y + 0.18, z);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) m.part(g, 0.14, 0.08, 0.16, top, x - 0.17 + i * 0.17, y + 0.38, z - 0.1 + j * 0.2, false);
    }
}

// Lo de cada prado, nivel a nivel
export const BARNYARD = {
    milk: [
        { lv: 1, r: 1.2, build: (m, g) => { trough(m, g, 0, 0); bales(m, g, [[0.4, 0, 0.8, 0.2]]); } },
        { lv: 2, r: 1.0, build: (m, g) => {
            for (const [x, z] of [[0, 0], [0.45, 0.1], [0.15, 0.45]]) {
                m.part(g, 0.34, 0.5, 0.34, METAL, x, 0.25, z);
                m.part(g, 0.22, 0.12, 0.22, METAL2, x, 0.56, z);
            }
            bales(m, g, [[-0.8, 0, 0, 0], [-0.8, 0.46, 0, 0.3]]);
        } },
        { lv: 3, r: 2.0, build: (m, g) => shed(m, g, 3.0, 2.2, 1.6, RED, ROOF) }, // el establo, rojo con su puerta
        { lv: 4, r: 1.2, build: (m, g) => { silo(m, g); bales(m, g, [[1.1, 0, 0.5, 0.4]]); } },
        { lv: 4, r: 1.2, build: (m, g) => bales(m, g, [[0, 0, 0, 0], [0.82, 0, 0, 0], [0.41, 0.46, 0, 0], [0, 0, 0.52, 0], [0.82, 0, 0.52, 0], [0.41, 0.46, 0.52, 0], [0.41, 0.92, 0.26, 0]]) },
        { lv: 5, r: 1.1, build: (m, g) => windpump(m, g) },
        { lv: 5, r: 1.8, build: (m, g) => { fence(m, g, -1.4, 0, 1.4, 0); trough(m, g, 0, 0.7, 2.2); } },
    ],
    wool: [
        { lv: 1, r: 1.0, build: (m, g) => { // comedero de heno con tejadillo
            for (const s of [-1, 1]) m.part(g, 0.1, 1.0, 0.1, WOOD2, s * 0.6, 0.5, 0);
            m.part(g, 1.3, 0.4, 0.5, WOOD, 0, 0.45, 0);
            m.part(g, 1.1, 0.2, 0.36, HAY, 0, 0.72, 0, false);
            m.part(g, 1.5, 0.08, 0.7, ROOF, 0, 1.04, 0);
        } },
        { lv: 2, r: 1.3, build: (m, g) => { // carro-cabaña del pastor
            m.part(g, 2.0, 1.1, 1.2, 0x5a7a9a, 0, 0.95, 0);
            for (const x of [-0.6, 0.6]) for (const s of [-1, 1]) m.part(g, 0.4, 0.4, 0.1, DARK, x, 0.3, s * 0.62);
            m.part(g, 0.4, 0.7, 0.06, DARK, 0.5, 0.95, 0.62, false);
            for (let i = 0; i < 3; i++) m.part(g, 2.1 - i * 0.1, 0.12, 1.3 - i * 0.35, 0x3a5a7a, 0, 1.56 + i * 0.12, 0);
            m.part(g, 0.14, 0.4, 0.14, DARK, -0.6, 1.9, 0);
        } },
        { lv: 3, r: 1.8, build: (m, g) => { // corral de piedra seca con balas de lana
            m.part(g, 3.0, 0.5, 0.3, STONE, 0, 0.25, -1.0);
            for (const s of [-1, 1]) m.part(g, 0.3, 0.5, 2.0, STONE2, s * 1.35, 0.25, 0);
            for (const [x, z] of [[-0.5, -0.3], [0.2, -0.4], [-0.1, 0.3]]) m.part(g, 0.5, 0.5, 0.5, 0xfaf6ec, x, 0.25, z);
        } },
        { lv: 4, r: 2.1, build: (m, g) => shed(m, g, 3.4, 2.0, 1.4, 0xd8c8a8, 0x5a6a7a) }, // el esquiladero
        { lv: 4, r: 0.9, build: (m, g) => { for (const [x, y, z] of [[0, 0, 0], [0.55, 0, 0.1], [0.25, 0.5, 0.05]]) m.part(g, 0.5, 0.5, 0.5, 0xfaf6ec, x, y + 0.25, z); } },
        { lv: 5, r: 1.3, at: [10.5, 5.2], build: (m, g) => windmill(m, g) }, // (a un lado: es alto y taparía el esquiladero)
        { lv: 5, r: 1.6, build: (m, g) => { fence(m, g, -1.4, 0, 1.4, 0); bales(m, g, [[0, 0, 0.6, 0]]); } },
    ],
    egg: [
        { lv: 1, r: 0.9, build: (m, g) => { // nidales con paja y un comedero
            m.part(g, 1.2, 0.5, 0.5, WOOD, 0, 0.25, 0);
            for (const x of [-0.38, 0, 0.38]) m.part(g, 0.3, 0.12, 0.3, HAY, x, 0.52, 0.06, false);
            m.part(g, 0.3, 0.12, 0.2, WHITE, 0, 0.6, 0.06, false);
            m.part(g, 0.5, 0.2, 0.5, METAL, 0.9, 0.1, 0.3);
            m.part(g, 0.3, 0.3, 0.3, METAL2, 0.9, 0.35, 0.3);
        } },
        { lv: 2, r: 1.3, build: (m, g) => { // gallinero sobre patas, con su rampa
            for (const [x, z] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]]) m.part(g, 0.12, 0.6, 0.12, WOOD2, x, 0.3, z);
            m.part(g, 1.8, 1.0, 1.3, 0xe8d8b0, 0, 1.1, 0);
            m.part(g, 0.36, 0.4, 0.06, DARK, 0.4, 0.85, 0.66, false);
            const ramp = m.part(g, 0.36, 0.06, 0.9, WOOD, 0.4, 0.32, 1.0);
            ramp.rotation.x = 0.55;
            roof(m, g, 1.8, 1.3, 1.6, RED, 3, RED2);
        } },
        { lv: 3, r: 1.0, build: (m, g) => { // silo del pienso y sacos
            silo(m, g, 2.4, 0xd8e0e8);
            for (const [x, z] of [[1.0, 0.3], [1.0, -0.2]]) m.part(g, 0.5, 0.56, 0.4, 0xe0d0a0, x, 0.28, z);
        } },
        { lv: 4, r: 1.6, build: (m, g) => shed(m, g, 2.6, 1.8, 1.3, 0xf0e6d0, RED) }, // gallinero grande
        { lv: 4, r: 0.9, build: (m, g) => crates(m, g, [[0, 0, 0], [0.64, 0, 0.05], [0.3, 0.38, 0.02]]) }, // cajas de huevos
        { lv: 5, r: 0.8, build: (m, g) => { // espantapájaros con sombrero
            m.part(g, 0.12, 1.8, 0.12, WOOD2, 0, 0.9, 0);
            m.part(g, 1.3, 0.1, 0.1, WOOD2, 0, 1.4, 0);
            m.part(g, 0.6, 0.7, 0.3, 0x5a8ac8, 0, 1.25, 0);
            m.part(g, 0.34, 0.34, 0.3, 0xf0d8a0, 0, 1.8, 0);
            m.part(g, 0.6, 0.06, 0.6, 0x8a5a2a, 0, 2.0, 0);
            m.part(g, 0.34, 0.24, 0.34, 0x8a5a2a, 0, 2.14, 0);
        } },
        { lv: 5, r: 1.9, build: (m, g) => { fence(m, g, -1.5, 0, 1.5, 0); crates(m, g, [[-0.6, 0, 0.6], [0.6, 0, 0.6]], 0xf0e0c8); } },
    ],
};

// Dónde va cada pieza del prado: juntas, como una granjita junto al borde de arriba del campo
// (en casillas desde ese punto, en el orden en que aparecen; el campo crece y caben todas)
export const SLOTS = [[0, 0], [-3.6, 0.6], [3.8, -0.2], [-7, 1.6], [7.4, 1.4], [-3.4, 6.2], [3.4, 4.8]];
export const SCALE = 1.45; // (más grandes que los animales: se ven desde lejos)

export class BarnPiece extends VoxelModel {
    constructor(outline, def) {
        super(outline);
        this.def = def;
        def.build(this, this.root);
        this.bake([this.root], [this.spin]);
        this.root.scale.setScalar(SCALE);
        this.shown = false;
    }

    update(dt, time) {
        if (this.spin) this.spin.rotation.z = time * (this.def.lv >= 5 ? 1.6 : 1);
        this.updateFx(dt);
    }
}
