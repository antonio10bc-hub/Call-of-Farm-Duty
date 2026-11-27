import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';

// Caballo voxel (para el rodeo del mapa y su campo de tiro): cuerpo largo, cuello que sube hacia
// delante, cabeza alargada con sus orejas, crin y cola de pelo oscuro, y cuatro patas largas con
// sus cascos que galopan (animateHorse). Mira hacia +z. Sin cara, como todo en el juego.
// alien: el caballo alienígena (verde con manchas moradas, antena con su luz y una careta de
// caballo de cartón con su goma, como las de los coches de los mercaderes) y, encima, su jinete
// alienígena con su careta de humano y sombrero vaquero.
const COATS = [[0x8a5a34, 0x3a2418], [0xc8a070, 0x6a4a2a], [0x5a3a24, 0x2a1a10], [0xf0e8d8, 0x9a9088]];
const HOOF = 0x2a1a10, SKIN = 0x7dff4a, SPOT = 0x6a4a9a, LAMP = 0xff3e5e, CARD = 0xc8955a, RUBBER = 0xe0a860;
const MATS = new Map();
const mat = (c) => MATS.get(c) || MATS.set(c, toon(c)).get(c);

function hulled(parent, ink, w, h, d, color, x = 0, y = 0, z = 0, line = true) {
    const m = new THREE.Mesh(box(1, 1, 1), mat(color));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    if (line) {
        const o = new THREE.Mesh(box(1, 1, 1), ink);
        o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
        o.position.copy(m.position);
        parent.add(o);
    }
    return m;
}

// Una pata que gira desde la cadera, con su casco
function leg(parent, ink, x, z, coat) {
    const g = new THREE.Group();
    g.position.set(x, 0.95, z);
    hulled(g, ink, 0.16, 0.78, 0.17, coat, 0, -0.4, 0);
    hulled(g, ink, 0.18, 0.14, 0.19, HOOF, 0, -0.86, 0);
    parent.add(g);
    return g;
}

export function buildHorse(ink, alien = false) {
    const [coat, hair] = alien ? [SKIN, SPOT] : COATS[(Math.random() * COATS.length) | 0];
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    hulled(body, ink, 0.56, 0.56, 1.4, coat, 0, 1.22, 0);
    if (alien) for (const [s, z] of [[1, 0.3], [-1, -0.25], [1, -0.4]]) hulled(body, ink, 0.04, 0.2, 0.3, SPOT, s * 0.29, 1.26, z, false);
    // La silla de montar con su manta
    hulled(body, ink, 0.62, 0.08, 0.5, alien ? 0x3a2a5e : 0xc8402e, 0, 1.52, -0.02);
    hulled(body, ink, 0.4, 0.12, 0.42, 0x6a3a1a, 0, 1.6, -0.02);
    const legs = [[-0.17, 0.5], [0.17, 0.5], [-0.17, -0.5], [0.17, -0.5]].map(([x, z]) => leg(body, ink, x, z, coat));
    // Cuello y cabeza (gira desde la cruz)
    const neck = new THREE.Group();
    neck.position.set(0, 1.4, 0.6);
    neck.rotation.x = -0.6;
    hulled(neck, ink, 0.32, 0.36, 0.75, coat, 0, 0.1, 0.32);
    hulled(neck, ink, 0.08, 0.2, 0.7, hair, 0, 0.32, 0.25); // (la crin)
    const head = new THREE.Group();
    head.position.set(0, 0.12, 0.72);
    head.rotation.x = 1.25;
    hulled(head, ink, 0.3, 0.3, 0.62, coat, 0, 0, 0.22);
    for (const s of [-1, 1]) hulled(head, ink, 0.07, 0.16, 0.07, coat, s * 0.1, 0.2, -0.04);
    if (alien) {
        // La antena con su luz y la careta de caballo de cartón (plana, de perfil) con su goma
        hulled(head, ink, 0.04, 0.3, 0.04, 0x3ec82a, 0, 0.3, 0.05);
        hulled(head, ink, 0.1, 0.1, 0.1, LAMP, 0, 0.48, 0.05);
        for (const s of [-1, 1]) {
            hulled(head, ink, 0.02, 0.36, 0.7, CARD, s * 0.17, 0.02, 0.24);
            hulled(head, ink, 0.025, 0.05, 0.08, 0x2a1a0e, s * 0.185, 0.08, 0.1, false);
            hulled(head, ink, 0.025, 0.14, 0.22, 0x8a5a34, s * 0.185, 0.14, 0.02, false);
        }
        hulled(head, ink, 0.36, 0.03, 0.03, RUBBER, 0, 0.1, -0.08, false);
    }
    neck.add(head);
    body.add(neck);
    // La cola
    const tail = new THREE.Group();
    tail.position.set(0, 1.42, -0.72);
    hulled(tail, ink, 0.12, 0.6, 0.12, hair, 0, -0.28, -0.05);
    body.add(tail);
    let rider = null;
    if (alien) rider = buildRider(body, ink);
    return { g, body, legs, neck, tail, rider, step: Math.random() * 6 };
}

// El jinete alienígena: traje morado, cabeza verde enorme con su careta plana de cara humana (de
// cartón, con su goma) y un sombrero vaquero; las piernas abiertas a los lados de la silla
function buildRider(body, ink) {
    const r = new THREE.Group();
    r.position.set(0, 1.66, -0.05);
    for (const s of [-1, 1]) hulled(r, ink, 0.14, 0.42, 0.16, 0x3e2a5e, s * 0.33, -0.12, 0.06);
    hulled(r, ink, 0.42, 0.44, 0.28, 0x6a4a9a, 0, 0.3, 0);
    hulled(r, ink, 0.44, 0.07, 0.3, 0xffe03a, 0, 0.12, 0);
    for (const s of [-1, 1]) hulled(r, ink, 0.12, 0.36, 0.13, SKIN, s * 0.28, 0.32, 0.16);
    hulled(r, ink, 0.5, 0.44, 0.44, SKIN, 0, 0.76, 0);
    const mask = new THREE.Group();
    mask.position.set(0, 0.76, 0.24);
    hulled(mask, ink, 0.38, 0.4, 0.03, 0xf3c8a0, 0, 0, 0);
    for (const x of [-0.09, 0.09]) {
        hulled(mask, ink, 0.05, 0.05, 0.02, 0x2a1a0e, x, 0.06, 0.02, false);
        hulled(mask, ink, 0.06, 0.04, 0.02, 0xff9fb0, x * 1.4, -0.03, 0.02, false);
    }
    hulled(mask, ink, 0.14, 0.03, 0.02, 0xc8402e, 0, -0.11, 0.02, false);
    r.add(mask);
    hulled(r, ink, 0.54, 0.03, 0.03, RUBBER, 0, 0.8, 0.02, false);
    // El sombrero vaquero
    hulled(r, ink, 0.8, 0.06, 0.7, 0x8a5a2e, 0, 1.0, 0);
    hulled(r, ink, 0.44, 0.24, 0.4, 0x8a5a2e, 0, 1.14, 0);
    hulled(r, ink, 0.46, 0.06, 0.42, 0x3a2418, 0, 1.05, 0, false);
    body.add(r);
    return r;
}

// Un fotograma del caballo: galope al ritmo de su velocidad (speed, m/s); air: lo que va saltando
// (0 en el suelo, 1 en lo alto: las patas recogidas)
export function animateHorse(h, dt, time, speed, air = 0) {
    h.step += dt * (2 + speed * 1.6);
    const k = Math.min(1, speed / 4), sw = (0.25 + k * 0.6) * (1 - air);
    const a = Math.sin(h.step) * sw, b = Math.sin(h.step + 0.7) * sw;
    h.legs[0].rotation.x = a - air * 1.1;
    h.legs[1].rotation.x = b - air * 1.1;
    h.legs[2].rotation.x = -a + air * 0.9;
    h.legs[3].rotation.x = -b + air * 0.9;
    h.body.position.y = Math.abs(Math.sin(h.step)) * 0.1 * k;
    h.body.rotation.x = Math.sin(h.step * 2) * 0.05 * k - air * 0.18;
    h.neck.rotation.x = -0.6 + Math.sin(h.step) * 0.1 * k + (speed < 0.3 ? 0.5 : 0); // quieto: pasta
    h.tail.rotation.x = -0.4 * k - Math.sin(time * 5 + h.step) * 0.15;
    if (h.rider) h.rider.position.y = 1.66 + Math.abs(Math.cos(h.step)) * 0.06 * k;
}

// De noche, los caballos alienígenas y sus jinetes brillan (la piel verde y la luz de la antena),
// como los alienígenas a pie
export function horseNight(k, time) {
    const pulse = 0.75 + Math.sin(time * 3) * 0.25;
    mat(SKIN).emissive.setHex(0x2a8a1a).multiplyScalar(k * 0.6);
    mat(LAMP).emissive.setHex(0xff3e5e).multiplyScalar(k * pulse);
}
