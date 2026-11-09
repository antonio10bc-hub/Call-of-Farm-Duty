import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';

// Cerdo voxel (para su pocilga del mapa y su campo de tiro): cuerpo rosa con manchas de barro,
// cabeza con su hocico y las orejas caídas, patas con pezuña y el rabito; encima del lomo, la
// trufa que encuentra hozando (oscura, con sus chispas doradas), que es lo que hay que darle.
// Mira hacia +z. Sin cara, como todo en el juego.
const PINK = 0xf2a8b0, PINK2 = 0xe0889a, MUD = 0x7a5232, MUD2 = 0x5a3a22, HOOF = 0x3a2a1e;
const TRUFFLE = [0x4a2e1a, 0x3a2414, 0x5a3a22];
const MATS = new Map();
const mat = (c) => MATS.get(c) || MATS.set(c, toon(c)).get(c);
const SPARK = new THREE.MeshBasicMaterial({ color: 0xffe03a });

function hulled(parent, ink, w, h, d, color, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(box(1, 1, 1), mat(color));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    const o = new THREE.Mesh(box(1, 1, 1), ink);
    o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
    o.position.copy(m.position);
    parent.add(m, o);
    return m;
}

function leg(parent, ink, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0.34, z);
    hulled(g, ink, 0.13, 0.26, 0.13, PINK, 0, -0.13, 0);
    hulled(g, ink, 0.14, 0.08, 0.14, HOOF, 0, -0.3, 0);
    parent.add(g);
    return g;
}

export function buildPig(ink) {
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    hulled(body, ink, 0.56, 0.46, 0.86, PINK, 0, 0.55, 0);
    // Manchas de barro (cada cerdo las suyas)
    for (let k = 0; k < 3; k++) {
        const side = Math.random() < 0.5 ? -1 : 1;
        hulled(body, ink, 0.04, 0.12 + Math.random() * 0.14, 0.16 + Math.random() * 0.2, k ? MUD : MUD2, side * 0.28, 0.44 + Math.random() * 0.16, (Math.random() - 0.5) * 0.6);
    }
    const legs = [[-0.17, 0.27], [0.17, 0.27], [-0.17, -0.27], [0.17, -0.27]].map(([x, z]) => leg(body, ink, x, z));
    // Cabeza con el hocico (y sus dos agujeros) y las orejas caídas hacia delante
    const head = new THREE.Group();
    head.position.set(0, 0.62, 0.52);
    hulled(head, ink, 0.42, 0.38, 0.3, PINK, 0, 0, 0.02);
    hulled(head, ink, 0.24, 0.18, 0.1, PINK2, 0, -0.06, 0.2);
    for (const s of [-1, 1]) {
        hulled(head, ink, 0.04, 0.05, 0.02, MUD2, s * 0.05, -0.06, 0.25);
        hulled(head, ink, 0.14, 0.04, 0.14, PINK2, s * 0.14, 0.2, 0.06).rotation.x = 0.5;
    }
    body.add(head);
    // El rabito, en espiral (tres trozos)
    const tail = new THREE.Group();
    tail.position.set(0, 0.68, -0.44);
    hulled(tail, ink, 0.05, 0.05, 0.1, PINK2, 0, 0, -0.04);
    hulled(tail, ink, 0.05, 0.1, 0.05, PINK2, 0.04, 0.05, -0.08);
    hulled(tail, ink, 0.08, 0.05, 0.05, PINK2, 0.02, 0.1, -0.06);
    body.add(tail);
    // La trufa del lomo (con sus chispas, que giran)
    const truffle = new THREE.Group();
    truffle.position.set(0, 0.92, -0.05);
    hulled(truffle, ink, 0.3, 0.24, 0.28, TRUFFLE[0]);
    hulled(truffle, ink, 0.16, 0.14, 0.16, TRUFFLE[1], 0.12, 0.1, 0.06);
    hulled(truffle, ink, 0.14, 0.12, 0.14, TRUFFLE[2], -0.1, 0.08, -0.08);
    const sparks = new THREE.Group();
    for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2, s = new THREE.Mesh(box(0.07, 0.07, 0.07), SPARK);
        s.position.set(Math.sin(a) * 0.3, 0.14 + (k % 2) * 0.12, Math.cos(a) * 0.3);
        sparks.add(s);
    }
    truffle.add(sparks);
    truffle.scale.setScalar(0.0001);
    body.add(truffle);
    return { g, body, legs, head, tail, truffle, sparks, step: Math.random() * 6 };
}

// Un fotograma del cerdo: corre a speed m/s; slide (0..1) va deslizándose de barriga (las patas
// estiradas por delante y por detrás, el cuerpo pegado al barro); found (0..1) la trufa del lomo
export function animatePig(c, dt, time, speed, slide, found) {
    c.step += dt * (2.5 + speed * 3.6) * (1 - slide);
    const k = Math.min(1, speed / 4), sw = (0.35 + k * 0.55) * (1 - slide);
    c.legs[0].rotation.x = c.legs[3].rotation.x = Math.sin(c.step) * sw;
    c.legs[1].rotation.x = c.legs[2].rotation.x = -Math.sin(c.step) * sw;
    // De barriga: patas de delante hacia delante y las de detrás hacia atrás
    if (slide > 0) {
        for (const i of [0, 1]) c.legs[i].rotation.x += -1.3 * slide;
        for (const i of [2, 3]) c.legs[i].rotation.x += 1.3 * slide;
    }
    c.body.position.y = Math.abs(Math.sin(c.step)) * 0.07 * k * (1 - slide) - 0.2 * slide;
    c.body.rotation.x = Math.sin(c.step * 2) * 0.05 * k * (1 - slide) + 0.08 * slide;
    c.head.rotation.x = Math.sin(c.step) * 0.06 - 0.25 * slide;
    c.tail.rotation.z = Math.sin(time * 9 + c.step) * 0.6;
    const f = Math.min(1, found);
    c.truffle.scale.setScalar(Math.max(0.0001, f * (1 + (f >= 1 ? Math.sin(time * 8 + c.step) * 0.08 : 0))));
    c.sparks.rotation.y = time * 3;
    c.sparks.visible = f >= 1;
}
