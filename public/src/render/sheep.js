import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';

// Oveja voxel (para su prado del mapa y su campo de tiro): cuerpo crema, cabeza y patas oscuras
// (sin cara, como todo en el juego) y el vellón, que le va creciendo (animateSheep) hasta hacerse una
// bola de lana gigante en la que va metida. Mira hacia +z.
const WOOL = [0xfaf6ec, 0xf0e8d6, 0xfffdf6], SKIN = 0xf3ead2, DARK = 0x3a2e2a;
const MATS = new Map();
const mat = (c) => MATS.get(c) || MATS.set(c, toon(c)).get(c);

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
    g.position.set(x, 0.46, z);
    hulled(g, ink, 0.1, 0.44, 0.1, DARK, 0, -0.22, 0);
    parent.add(g);
    return g;
}

export function buildSheep(ink) {
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    hulled(body, ink, 0.46, 0.36, 0.66, SKIN, 0, 0.62, 0);
    const legs = [[-0.15, 0.22], [0.15, 0.22], [-0.15, -0.22], [0.15, -0.22]].map(([x, z]) => leg(body, ink, x, z));
    // Cabeza oscura con sus orejas de lado y un mechón de lana encima
    const head = new THREE.Group();
    head.position.set(0, 0.8, 0.42);
    hulled(head, ink, 0.24, 0.26, 0.3, DARK, 0, 0, 0.06);
    for (const s of [-1, 1]) hulled(head, ink, 0.14, 0.06, 0.08, DARK, s * 0.17, 0.06, 0);
    hulled(head, ink, 0.2, 0.08, 0.16, WOOL[0], 0, 0.15, 0);
    body.add(head);
    // El vellón: un bloque grande con copos alrededor (se escala para que crezca y rueda cuando
    // ya es una bola)
    const wool = new THREE.Group();
    wool.position.set(0, 0.66, -0.02);
    hulled(wool, ink, 0.62, 0.52, 0.72, WOOL[0]);
    for (const [x, y, z, s, c] of [[0, 0.26, 0, 0.42, 1], [0.3, 0.06, 0.1, 0.3, 2], [-0.3, 0.04, -0.12, 0.3, 1], [0, 0.1, 0.36, 0.3, 2], [0.12, 0.2, -0.32, 0.28, 0], [-0.16, -0.18, 0.2, 0.26, 2], [0.2, -0.16, -0.2, 0.26, 1]]) {
        hulled(wool, ink, s, s, s, WOOL[c], x, y, z);
    }
    body.add(wool);
    return { g, body, legs, head, wool, step: Math.random() * 6, roll: 0 };
}

// El vellón: fluff 0 recién esquilada, 1 una bola gigante (WOOL_MAX veces). Con más de medio vellón
// ya no le llegan las patas al suelo: va dentro de la bola, que rueda (y bota un poco) mientras
// las patas patalean. Deja en c.lift lo alta que va, en c.us lo grande que es el vellón y en
// c.r su radio (en las medidas de la oveja)
export const WOOL_MAX = 2.2; // (una bola, pero sin pasarse: así caben muchas)
export function animateSheep(c, dt, time, speed, fluff) {
    c.step += dt * (2.5 + speed * 3.4);
    const k = Math.min(1, speed / 3), us = 0.75 + fluff * fluff * (WOOL_MAX - 0.75);
    const ball = Math.min(1, Math.max(0, (fluff - 0.45) / 0.4)), r = 0.33 * us;
    // Patas: al trote, o pataleando dentro de la bola
    const trot = Math.sin(c.step) * (0.3 + k * 0.5), paddle = Math.sin(time * 14 + c.step) * 0.5;
    c.legs[0].rotation.x = c.legs[3].rotation.x = trot * (1 - ball) + paddle * ball;
    c.legs[1].rotation.x = c.legs[2].rotation.x = -trot * (1 - ball) - paddle * ball;
    // Lo que sube para que la bola quepa (y un botecito al rodar)
    c.lift = Math.max(0, r - 0.66) + Math.abs(Math.sin(c.step)) * (0.06 * k * (1 - ball) + 0.14 * ball);
    c.us = us;
    c.r = r;
    c.body.position.y = c.lift;
    c.body.rotation.x = Math.sin(c.step * 2) * 0.05 * k * (1 - ball);
    // La bola rueda según avanza; la cabeza asoma por delante
    c.roll += (dt * speed * ball) / Math.max(0.3, r);
    c.wool.rotation.x = c.roll;
    c.wool.scale.setScalar(us);
    c.head.position.z = 0.42 + Math.max(0, r - 0.36) * ball;
    c.head.rotation.x = Math.sin(c.step) * 0.08 - ball * 0.2;
}
