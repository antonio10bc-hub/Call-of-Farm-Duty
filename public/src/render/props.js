import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { SHOP } from '../content/ufo.js';

// Lo que se compra en la tienda del ovni para la parcela de la casa: un modelo de cubos por
// objeto, cada uno en su hueco fijo (content/ufo.js: at). Están todos montados y escondidos;
// setPlaced enseña los puestos. Algunos se mueven (molino, fuente, columpios, perro...).
const WOOD = 0xb07a44, WOOD2 = 0x8a5a34, STONE = 0xd8d0c0, STONE2 = 0x9a948c, WATER = 0x6fc8e8, WATER2 = 0x9fe0f4;
const LEAF = 0x4caf3c, LEAF2 = 0x3d9a34, WHITE = 0xfff3e0, RED = 0xc8402e, INKY = 0x2a2a2a, TRUNK = 0x7a4f2a;

export class Plot extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        this.items = {};
        this.anim = [];
        for (const cat of SHOP.find((s) => s.id === 'plot').cats) {
            for (const it of cat.items) {
                const g = new THREE.Group();
                g.position.set(it.at.x, 0, it.at.z);
                g.rotation.y = (it.at.ry || 0) * (Math.PI / 2);
                g.visible = false;
                this.root.add(g);
                const build = BUILD[it.id];
                if (build) build.call(this, g, (w, h, d, c, x, y, z, o = true) => this.part(g, w, h, d, c, x, y, z, o));
                this.items[it.id] = g;
            }
        }
    }

    // Enseña los puestos; los que aparecen ahora, con un bote
    setPlaced(ids) {
        for (const [id, g] of Object.entries(this.items)) {
            const on = ids.includes(id);
            if (on && !g.visible) g.userData.pop = 0;
            g.visible = on;
        }
    }

    update(dt, time) {
        for (const g of Object.values(this.items)) {
            if (!g.visible || g.userData.pop === undefined) continue;
            g.userData.pop = Math.min(1, g.userData.pop + dt * 3);
            const k = g.userData.pop, s = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 : 1;
            g.scale.set(s, k < 1 ? Math.max(0.0001, k * s) : 1, s);
            if (k >= 1) delete g.userData.pop;
        }
        for (const f of this.anim) f(time);
        this.updateFx(dt);
    }
}

// Copa de árbol con fruta (color de la copa, de la fruta y alto del tronco)
function fruitTree(g, P, leaf, fruit, trunk = TRUNK, h = 1.1) {
    P(0.32, h, 0.32, trunk, 0, h / 2, 0);
    P(1.7, 1.2, 1.7, leaf, 0, h + 0.5, 0);
    P(1.1, 0.7, 1.1, leaf, 0, h + 1.3, 0);
    if (fruit) for (const [x, y, z] of [[0.86, 1.4, 0.3], [-0.6, 1.2, 0.86], [0.2, 1.8, -0.86], [-0.86, 1.6, -0.3], [0.5, 2.0, 0.56], [-0.3, 2.2, -0.4]]) P(0.18, 0.18, 0.18, fruit, x, h + y - 1.1, z, false);
}

const BUILD = {
    // ---------- Agua ----------
    pool(g, P) {
        P(6.2, 0.24, 3.8, STONE, 0, 0.12, 0);
        P(5.4, 0.26, 3.0, WATER, 0, 0.14, 0, false);
        for (const z of [-0.7, 0.5]) P(3.6, 0.27, 0.12, WATER2, 0.2, 0.15, z, false);
        for (const s of [-0.18, 0.18]) P(0.06, 0.7, 0.06, 0xd8dce2, 2.6 + s, 0.45, -1.62, false);
        const ring = new THREE.Group();
        ring.position.set(-1.4, 0.3, 0.4);
        g.add(ring);
        for (let k = 0; k < 4; k++) this.part(ring, 0.5, 0.12, 0.14, k % 2 ? 0xffffff : RED, Math.sin(k * Math.PI / 2) * 0.26, 0, Math.cos(k * Math.PI / 2) * 0.26).rotation.y = k * Math.PI / 2;
        this.anim.push((t) => (ring.position.y = 0.3 + Math.sin(t * 2) * 0.03));
    },
    pond(g, P) {
        P(2.8, 0.12, 2.2, WATER, 0, 0.06, 0, false);
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            P(0.4, 0.2, 0.32, k % 2 ? STONE2 : 0xb8b2a8, Math.sin(a) * 1.5, 0.1, Math.cos(a) * 1.2).rotation.y = a;
        }
        for (const [x, z] of [[-1.2, -0.9], [-1.0, -1.1], [1.3, 0.8]]) P(0.06, 0.7, 0.06, 0x6f8a3a, x, 0.35, z, false);
        const ducks = [];
        for (const [x, z] of [[-0.4, 0.2], [0.5, -0.4]]) {
            const d = new THREE.Group();
            d.position.set(x, 0.18, z);
            g.add(d);
            this.part(d, 0.34, 0.2, 0.24, 0xffe03a, 0, 0, 0);
            this.part(d, 0.16, 0.16, 0.16, 0xffe03a, 0.16, 0.16, 0);
            this.part(d, 0.1, 0.05, 0.08, 0xff9a1f, 0.28, 0.14, 0, false);
            ducks.push(d);
        }
        this.anim.push((t) => ducks.forEach((d, i) => {
            d.position.x += Math.sin(t * 0.5 + i * 3) * 0.002;
            d.rotation.y = Math.sin(t * 0.4 + i) * 1.2;
        }));
    },
    fountain(g, P) {
        P(2.0, 0.4, 2.0, STONE, 0, 0.2, 0);
        P(1.6, 0.42, 1.6, WATER, 0, 0.22, 0, false);
        P(0.36, 1.1, 0.36, STONE, 0, 0.75, 0);
        P(0.9, 0.18, 0.9, STONE, 0, 1.3, 0);
        const jet = P(0.16, 0.5, 0.16, WATER2, 0, 1.6, 0, false);
        this.anim.push((t) => jet.scale.set(1, 0.7 + Math.abs(Math.sin(t * 3)) * 0.6, 1));
    },
    birdbath(g, P) {
        P(0.3, 0.8, 0.3, STONE2, 0, 0.4, 0);
        P(0.8, 0.14, 0.8, STONE, 0, 0.86, 0);
        P(0.6, 0.15, 0.6, WATER, 0, 0.88, 0, false);
        P(0.18, 0.14, 0.24, 0x3f6fb0, 0.25, 1.0, 0);
        P(0.1, 0.1, 0.1, 0x3f6fb0, 0.25, 1.1, 0.12);
    },
    hottub(g, P) {
        P(1.8, 0.6, 1.8, WOOD, 0, 0.3, 0);
        P(1.5, 0.62, 1.5, 0x8adcf0, 0, 0.32, 0, false);
        const bubbles = [];
        for (let k = 0; k < 5; k++) bubbles.push(P(0.12, 0.12, 0.12, 0xffffff, Math.sin(k * 1.3) * 0.5, 0.64, Math.cos(k * 1.3) * 0.5, false));
        this.anim.push((t) => bubbles.forEach((b, i) => (b.position.y = 0.64 + Math.abs(Math.sin(t * 3 + i)) * 0.1)));
    },
    // ---------- Jardín ----------
    apple(g, P) { fruitTree(g, P, LEAF, RED); },
    orange(g, P) { fruitTree(g, P, LEAF2, 0xff9a1f); },
    cherry(g, P) { fruitTree(g, P, 0xffb0c8, 0xff6f9a, 0x5a3a2a, 1.2); },
    willow(g, P) {
        P(0.38, 1.7, 0.38, TRUNK, 0, 0.85, 0);
        P(2.6, 0.7, 2.6, 0x7fbf4a, 0, 2.0, 0);
        P(1.6, 0.5, 1.6, 0x8fcc50, 0, 2.5, 0);
        for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2;
            P(0.14, 1.3, 0.14, k % 2 ? 0x7fbf4a : 0x6aa83c, Math.sin(a) * 1.2, 1.25, Math.cos(a) * 1.2, false);
        }
    },
    hedge(g, P) {
        P(9.4, 0.8, 0.7, LEAF2, 0, 0.4, 0);
        P(9.2, 0.12, 0.6, 0x4caf3c, 0, 0.84, 0, false);
    },
    flowerbed(g, P) {
        P(3.0, 0.22, 1.2, 0x8a5a34, 0, 0.11, 0);
        const C = [0xffe03a, 0xff8fb0, 0xffffff, 0xff3e5e];
        for (let a = 0; a < 7; a++) for (let b = 0; b < 3; b++) P(0.16, 0.16, 0.16, C[(a + b) % 4], -1.2 + a * 0.4, 0.34, -0.36 + b * 0.36, false);
    },
    roses(g, P) {
        P(4.2, 0.6, 0.8, LEAF2, 0, 0.3, 0);
        for (let k = 0; k < 10; k++) P(0.18, 0.18, 0.18, k % 3 ? 0xff3e5e : 0xffffff, -1.9 + k * 0.42, 0.62, (k % 2 ? 0.2 : -0.2), false);
    },
    pumpkins(g, P) {
        P(3.0, 0.1, 2.4, 0x6a4a2a, 0, 0.05, 0);
        for (const [x, z, s] of [[-1, -0.7, 0.5], [0.1, -0.6, 0.42], [1.0, -0.7, 0.55], [-0.8, 0.5, 0.44], [0.3, 0.6, 0.6], [1.1, 0.5, 0.4]]) {
            P(s, s * 0.8, s, 0xe8902a, x, 0.1 + s * 0.4, z);
            P(0.08, 0.14, 0.08, 0x4f7a3a, x, 0.1 + s * 0.85, z, false);
            P(0.4, 0.06, 0.3, LEAF, x + 0.3, 0.13, z + 0.2, false);
        }
    },
    // ---------- Juegos ----------
    swing(g, P) {
        for (const x of [-1.5, 1.5]) for (const z of [-0.5, 0.5]) P(0.1, 2.2, 0.1, RED, x, 1.05, z * 0.6).rotation.x = z * 0.45;
        P(3.2, 0.12, 0.12, RED, 0, 2.05, 0);
        const seats = [];
        for (const x of [-0.6, 0.6]) {
            const s = new THREE.Group();
            s.position.set(x, 2.0, 0);
            g.add(s);
            for (const sx of [-0.2, 0.2]) this.part(s, 0.03, 1.5, 0.03, INKY, sx, -0.75, 0, false);
            this.part(s, 0.5, 0.08, 0.3, 0xffe03a, 0, -1.5, 0);
            seats.push(s);
        }
        this.anim.push((t) => seats.forEach((s, i) => (s.rotation.z = Math.sin(t * 2.2 + i * 1.5) * 0.25)));
    },
    slide(g, P) {
        for (const x of [-0.35, 0.35]) P(0.08, 1.6, 0.08, 0x3f6fb0, x, 0.8, -1.1, false);
        for (let y = 0.3; y < 1.5; y += 0.35) P(0.7, 0.05, 0.05, 0x3f6fb0, 0, y, -1.1, false);
        P(0.9, 0.1, 0.8, 0x3f6fb0, 0, 1.5, -0.8);
        P(0.8, 0.08, 2.4, 0xffd23f, 0, 0.8, 0.5).rotation.x = 0.62;
    },
    trampoline(g, P) {
        for (let k = 0; k < 4; k++) P(0.1, 0.5, 0.1, INKY, Math.sin(k * Math.PI / 2) * 1.0, 0.25, Math.cos(k * Math.PI / 2) * 1.0, false);
        // Marco de cuatro barras y la lona azul dentro, que bota
        for (const [w, d, x, z] of [[2.4, 0.2, 0, 1.1], [2.4, 0.2, 0, -1.1], [0.2, 2.4, 1.1, 0], [0.2, 2.4, -1.1, 0]]) P(w, 0.12, d, INKY, x, 0.55, z);
        const mat = P(2.0, 0.06, 2.0, 0x3f6fb0, 0, 0.56, 0, false);
        this.anim.push((t) => (mat.position.y = 0.56 - Math.max(0, Math.sin(t * 4)) * 0.08));
    },
    treehouse(g, P) {
        P(0.5, 2.6, 0.5, TRUNK, 0, 1.3, 0);
        P(2.6, 1.4, 2.6, LEAF, 0, 3.4, 0);
        P(1.8, 0.8, 1.8, LEAF2, 0, 4.4, 0);
        P(1.7, 0.12, 1.5, WOOD2, 0.2, 2.4, 0.7);
        P(1.5, 1.1, 1.3, WOOD, 0.2, 3.0, 0.7);
        P(1.7, 0.3, 1.5, RED, 0.2, 3.7, 0.7);
        P(0.4, 0.6, 0.05, 0x2a1a0e, 0.2, 2.8, 1.37, false);
        for (let y = 0.3; y < 2.4; y += 0.35) P(0.5, 0.06, 0.06, WOOD2, 0.2, y, 1.6, false);
    },
    sandbox(g, P) {
        P(1.8, 0.24, 1.8, WOOD, 0, 0.12, 0);
        P(1.5, 0.26, 1.5, 0xe8d090, 0, 0.13, 0, false);
        P(0.25, 0.25, 0.25, RED, 0.4, 0.38, -0.3);
        P(0.06, 0.45, 0.12, 0x3f6fb0, -0.4, 0.45, 0.3).rotation.z = 0.5;
    },
    seesaw(g, P) {
        P(0.3, 0.45, 0.4, RED, 0, 0.22, 0);
        const plank = new THREE.Group();
        plank.position.y = 0.48;
        g.add(plank);
        this.part(plank, 2.8, 0.1, 0.36, 0xffd23f, 0, 0, 0);
        for (const x of [-1.2, 1.2]) this.part(plank, 0.06, 0.3, 0.3, RED, x, 0.18, 0, false);
        this.anim.push((t) => (plank.rotation.z = Math.sin(t * 1.4) * 0.28));
    },
    goal(g, P) {
        for (const z of [-1, 1]) P(0.1, 1.2, 0.1, 0xffffff, 0, 0.6, z);
        P(0.1, 0.1, 2.1, 0xffffff, 0, 1.2, 0);
        P(0.06, 1.1, 2.0, 0xd8dce2, -0.6, 0.6, 0, false);
        P(0.3, 0.3, 0.3, 0xffffff, 1.4, 0.15, 0.3);
        P(0.12, 0.12, 0.31, INKY, 1.4, 0.2, 0.3, false);
    },
    // ---------- Estructuras ----------
    gazebo(g, P) {
        P(3.0, 0.2, 3.0, WHITE, 0, 0.1, 0);
        for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) P(0.14, 1.8, 0.14, WHITE, x, 1.1, z);
        [3.3, 2.5, 1.6, 0.7].forEach((s, i) => P(s, 0.22, s, i % 2 ? 0x44692f : 0x4f7a3a, 0, 2.1 + i * 0.22, 0));
    },
    greenhouse(g, P) {
        P(3.0, 0.2, 2.4, WHITE, 0, 0.1, 0);
        P(2.9, 1.4, 2.3, 0xc4f0e0, 0, 0.9, 0, false);
        for (const x of [-1.45, 0, 1.45]) P(0.08, 1.4, 2.32, WHITE, x, 0.9, 0, false);
        [2.3, 1.5, 0.7].forEach((d, i) => P(3.0, 0.22, d, 0xd8f8ec, 0, 1.7 + i * 0.22, 0, false));
        for (let k = 0; k < 4; k++) P(0.3, 0.4, 0.3, LEAF, -1 + k * 0.66, 0.4, 0.5, false);
    },
    windmill(g, P) {
        [[2.0, 0], [1.7, 1], [1.4, 2], [1.1, 3]].forEach(([s, i]) => P(s, 1.0, s, i % 2 ? STONE : 0xe8e0d0, 0, 0.5 + i, 0));
        P(1.3, 0.7, 1.3, RED, 0, 4.3, 0);
        P(0.5, 0.8, 0.06, 0x2a1a0e, 0, 0.4, 1.02, false);
        const sails = new THREE.Group();
        sails.position.set(0, 4.0, 0.8);
        g.add(sails);
        this.part(sails, 0.3, 0.3, 0.3, WOOD2, 0, 0, 0);
        for (let k = 0; k < 4; k++) {
            const arm = new THREE.Group();
            arm.rotation.z = (k * Math.PI) / 2;
            sails.add(arm);
            this.part(arm, 0.12, 2.2, 0.08, WOOD2, 0, 1.2, 0, false);
            this.part(arm, 0.5, 1.6, 0.04, 0xfff6e8, 0.3, 1.4, 0);
        }
        this.anim.push((t) => (sails.rotation.z = t * 0.9));
    },
    doghouse(g, P) {
        P(1.0, 0.8, 1.2, RED, 0, 0.4, 0);
        [[1.2, 0.95], [0.8, 1.1], [0.4, 1.25]].forEach(([w, y]) => P(w, 0.16, 1.3, 0x5a4a44, 0, y, 0));
        P(0.4, 0.5, 0.05, 0x2a1a0e, 0, 0.3, 0.61, false);
        // El perro, con su cola que se mueve
        P(0.5, 0.3, 0.3, 0x9a6a3a, 0.9, 0.35, 0.4);
        P(0.3, 0.3, 0.28, 0x9a6a3a, 1.2, 0.55, 0.4);
        P(0.08, 0.14, 0.1, 0x5a3a2a, 1.2, 0.74, 0.32, false);
        for (const [x, z] of [[0.75, 0.3], [1.05, 0.3], [0.75, 0.5], [1.05, 0.5]]) P(0.08, 0.2, 0.08, 0x9a6a3a, x, 0.1, z, false);
        const tail = P(0.06, 0.25, 0.06, 0x9a6a3a, 0.62, 0.5, 0.4, false);
        this.anim.push((t) => (tail.rotation.z = Math.sin(t * 12) * 0.6));
    },
    well(g, P) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            P(0.5, 0.7, 0.24, k % 2 ? STONE2 : 0xb8b2a8, Math.sin(a) * 0.55, 0.35, Math.cos(a) * 0.55).rotation.y = a;
        }
        P(0.8, 0.1, 0.8, 0x3a5a8a, 0, 0.55, 0, false);
        for (const x of [-0.6, 0.6]) P(0.1, 1.4, 0.1, WOOD2, x, 1.0, 0);
        P(1.5, 0.12, 0.8, RED, 0, 1.75, 0);
        P(0.2, 0.22, 0.2, WOOD, 0, 1.15, 0);
    },
    shed(g, P) {
        P(2.0, 1.4, 1.6, WOOD, 0, 0.7, 0);
        P(2.2, 0.16, 1.9, 0x5a4a44, 0, 1.5, 0).rotation.x = 0.12;
        P(0.6, 1.0, 0.05, WOOD2, 0.4, 0.5, 0.81, false);
        P(0.3, 0.5, 0.04, 0x2a1a0e, -0.5, 0.9, 0.81, false);
    },
    pergola(g, P) {
        for (const [x, z] of [[-1.4, -0.7], [1.4, -0.7], [-1.4, 0.7], [1.4, 0.7]]) P(0.14, 2.0, 0.14, WOOD2, x, 1.0, z);
        for (const z of [-0.7, 0.7]) P(3.2, 0.12, 0.14, WOOD2, 0, 2.05, z);
        for (let k = 0; k < 6; k++) P(0.1, 0.1, 1.8, WOOD, -1.25 + k * 0.5, 2.15, 0, false);
        const ham = new THREE.Group();
        ham.position.set(0, 1.3, 0);
        g.add(ham);
        for (let k = 0; k < 5; k++) this.part(ham, 0.5, 0.06, 0.7, k % 2 ? 0xffffff : 0x3f6fb0, -1.0 + k * 0.5, -Math.sin((k / 4) * Math.PI) * 0.3, 0, false);
        this.anim.push((t) => (ham.rotation.x = Math.sin(t * 1.3) * 0.15));
    },
    bbq(g, P) {
        for (const x of [-0.2, 0.2]) P(0.06, 0.6, 0.06, INKY, x, 0.3, 0, false);
        P(0.7, 0.4, 0.6, INKY, 0, 0.75, 0);
        P(0.72, 0.06, 0.62, 0x6a6a6a, 0, 0.98, 0, false);
        for (const x of [-0.15, 0.15]) P(0.14, 0.06, 0.1, 0xc8402e, x, 1.03, 0, false);
        P(0.5, 0.5, 0.5, WOOD, 1.0, 0.25, 0.2);
    },
    // ---------- Decoración ----------
    gnomes(g, P) {
        for (const [x, z, c] of [[-0.5, 0, 0x3f6fb0], [0.1, 0.4, 0x4f8a3a], [0.5, -0.3, 0x7b5cff]]) {
            P(0.26, 0.3, 0.26, c, x, 0.15, z);
            P(0.22, 0.16, 0.12, 0xffffff, x, 0.36, z + 0.1, false);
            P(0.2, 0.18, 0.2, 0xffd0b0, x, 0.42, z);
            [[0.24, 0.55], [0.16, 0.66], [0.08, 0.76]].forEach(([s, y]) => P(s, 0.12, s, RED, x, y, z, false));
        }
    },
    flamingos(g, P) {
        for (const [x, z] of [[0, 0], [0.7, 0.4]]) {
            P(0.05, 0.6, 0.05, 0xff8fb0, x, 0.3, z, false);
            P(0.36, 0.24, 0.5, 0xff8fb0, x, 0.72, z);
            P(0.07, 0.5, 0.07, 0xff8fb0, x, 1.05, z + 0.22, false);
            P(0.14, 0.14, 0.18, 0xff8fb0, x, 1.32, z + 0.26);
            P(0.06, 0.06, 0.12, INKY, x, 1.28, z + 0.38, false);
        }
    },
    scarecrow(g, P) {
        P(0.1, 2.0, 0.1, WOOD2, 0, 1.0, 0);
        P(1.6, 0.1, 0.1, WOOD2, 0, 1.4, 0);
        P(0.6, 0.6, 0.3, RED, 0, 1.25, 0);
        for (const x of [-0.55, 0.55]) P(0.4, 0.2, 0.26, 0x3f6fb0, x, 1.4, 0);
        P(0.34, 0.34, 0.3, 0xe8c25a, 0, 1.75, 0);
        P(0.7, 0.06, 0.7, 0xd8b45a, 0, 1.94, 0);
        P(0.32, 0.18, 0.32, 0xd8b45a, 0, 2.05, 0);
    },
    lamps(g, P) {
        for (const x of [-1.6, 1.6]) for (const z of [-4, 0, 4]) {
            P(0.1, 1.7, 0.1, INKY, x, 0.85, z, false);
            P(0.3, 0.3, 0.3, 0xfff0a0, x, 1.8, z);
            P(0.36, 0.08, 0.36, INKY, x, 1.98, z, false);
        }
    },
    picket(g, P) {
        for (const s of [-1, 1]) {
            for (let k = 0; k < 8; k++) P(0.1, 0.6, 0.06, 0xffffff, s * (1.4 + k * 0.45), 0.3, 0, false);
            for (const y of [0.2, 0.45]) P(3.3, 0.06, 0.05, 0xffffff, s * 2.98, y, 0.04, false);
        }
    },
    mailbox(g, P) {
        P(0.1, 0.9, 0.1, WOOD2, 0, 0.45, 0);
        P(0.3, 0.3, 0.5, 0x3f6fb0, 0, 1.0, 0);
        P(0.04, 0.3, 0.12, RED, 0.17, 1.15, 0.1, false);
    },
    bunting(g, P) {
        const C = [RED, 0xffd23f, 0x3f6fb0, 0x4f8a3a, 0xff8fb0];
        for (const z of [-1.6, 1.6]) {
            for (const x of [-4, 0, 4]) P(0.08, 1.9, 0.08, WOOD2, x, 0.95, z, false);
            P(8, 0.03, 0.03, INKY, 0, 1.85, z, false);
            for (let k = 0; k < 16; k++) P(0.26, 0.26, 0.03, C[k % 5], -3.75 + k * 0.5, 1.68, z, false).rotation.z = Math.PI / 4;
        }
    },
    goldhen(g, P) {
        P(0.9, 0.6, 0.9, STONE, 0, 0.3, 0);
        const hen = new THREE.Group();
        hen.position.y = 0.6;
        g.add(hen);
        this.part(hen, 0.5, 0.42, 0.65, 0xffd23f, 0, 0.3, 0);
        this.part(hen, 0.28, 0.3, 0.28, 0xffd23f, 0, 0.6, 0.28);
        this.part(hen, 0.06, 0.12, 0.16, RED, 0, 0.8, 0.3, false);
        this.part(hen, 0.08, 0.06, 0.1, 0xff9a1f, 0, 0.58, 0.46, false);
        this.part(hen, 0.4, 0.36, 0.14, 0xe6a400, 0, 0.5, -0.36);
        this.anim.push((t) => (hen.rotation.y = t * 0.8));
    },
    // ---------- De otro mundo ----------
    'crop-circle'(g, P) {
        for (const [r, n] of [[1.2, 16], [0.62, 9]]) {
            for (let k = 0; k < n; k++) {
                const a = (k / n) * Math.PI * 2;
                P(0.5, 0.02, 0.24, 0x5a9e32, Math.sin(a) * r, 0.02, Math.cos(a) * r, false).rotation.y = a + Math.PI / 2;
            }
        }
        P(0.4, 0.02, 0.4, 0x5a9e32, 0, 0.02, 0, false);
    },
    meteor(g, P) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            P(0.6, 0.04, 0.4, 0x3a3028, Math.sin(a) * 1.1, 0.02, Math.cos(a) * 1.1, false).rotation.y = a;
        }
        P(1.0, 0.8, 0.9, 0x4a4038, 0, 0.35, 0).rotation.set(0.3, 0.5, 0.2);
        P(0.6, 0.5, 0.6, 0x5a4a40, 0.4, 0.6, -0.2).rotation.y = 1;
        const glow = [P(0.5, 0.06, 0.08, 0xff9a1f, 0, 0.78, 0.42, false), P(0.08, 0.4, 0.08, 0xffe03a, -0.47, 0.4, 0.1, false)];
        this.anim.push((t) => glow.forEach((m) => (m.visible = Math.sin(t * 3) > -0.6)));
    },
    antenna(g, P) {
        for (let k = 0; k < 3; k++) {
            const a = (k / 3) * Math.PI * 2;
            P(0.08, 1.4, 0.08, 0x6a6a72, Math.sin(a) * 0.4, 0.6, Math.cos(a) * 0.4, false).rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
        }
        P(0.1, 3.4, 0.1, 0x9aa8b8, 0, 1.9, 0, false);
        P(1.2, 0.1, 1.2, 0x7dff4a, 0, 3.0, 0).rotation.x = 0.5;
        const light = P(0.2, 0.2, 0.2, 0x7dff4a, 0, 3.7, 0);
        this.anim.push((t) => (light.visible = Math.sin(t * 6) > 0));
    },
    'alien-doll'(g, P) {
        P(0.4, 0.4, 0.34, 0x7dff4a, 0, 0.2, 0);
        P(0.56, 0.48, 0.48, 0x7dff4a, 0, 0.62, 0);
        for (const x of [-0.13, 0.13]) P(0.14, 0.18, 0.04, 0x111111, x, 0.66, 0.24, false);
        for (const x of [-0.26, 0.26]) P(0.12, 0.3, 0.12, 0x7dff4a, x, 0.22, 0.06);
    },
};
