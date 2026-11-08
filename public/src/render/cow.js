import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';

// Vaca voxel (para el prado del mapa y su campo de tiro): cuerpo blanco con manchas negras, cabeza
// con hocico rosa y cuernos, cuatro patas que galopan, rabo y la ubre rosa con sus cuatro pezones,
// que se hincha (setUdder). Mira hacia +z. Sin cara, como todo en el juego.
const WHITE = 0xf6f3ea, BLACK = 0x2a2622, PINK = 0xf2a0b0, PINK2 = 0xd8708a, HORN = 0xe8dcc0, HOOF = 0x3a2a1e;
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

// Una pata que gira desde la cadera, con su pezuña
function leg(parent, ink, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0.62, z);
    hulled(g, ink, 0.16, 0.5, 0.16, WHITE, 0, -0.25, 0);
    hulled(g, ink, 0.17, 0.1, 0.17, HOOF, 0, -0.56, 0);
    parent.add(g);
    return g;
}

export function buildCow(ink) {
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    hulled(body, ink, 0.62, 0.5, 1.2, WHITE, 0, 0.88, 0);
    // Manchas negras (un poco salidas del cuerpo, cada vaca las suyas)
    for (let k = 0; k < 3; k++) {
        const side = Math.random() < 0.5 ? -1 : 1, w = 0.24 + Math.random() * 0.18;
        hulled(body, ink, 0.04, 0.2 + Math.random() * 0.16, w, BLACK, side * 0.31, 0.86 + (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.7);
    }
    hulled(body, ink, 0.5, 0.04, 0.32, BLACK, 0, 1.13, (Math.random() - 0.5) * 0.5);
    const legs = [[-0.2, 0.42], [0.2, 0.42], [-0.2, -0.42], [0.2, -0.42]].map(([x, z]) => leg(body, ink, x, z));
    // Cabeza con su hocico, cuernos y orejas
    const head = new THREE.Group();
    head.position.set(0, 1.06, 0.68);
    hulled(head, ink, 0.38, 0.36, 0.34, WHITE, 0, 0, 0.08);
    hulled(head, ink, 0.32, 0.18, 0.12, PINK, 0, -0.08, 0.3);
    for (const s of [-1, 1]) {
        hulled(head, ink, 0.06, 0.14, 0.06, HORN, s * 0.14, 0.24, 0.02);
        hulled(head, ink, 0.14, 0.07, 0.1, BLACK, s * 0.25, 0.08, 0);
    }
    body.add(head);
    // Rabo con su borla
    const tail = new THREE.Group();
    tail.position.set(0, 1.05, -0.6);
    hulled(tail, ink, 0.05, 0.42, 0.05, WHITE, 0, -0.2, 0);
    hulled(tail, ink, 0.1, 0.12, 0.1, BLACK, 0, -0.44, 0);
    body.add(tail);
    // Ubre con sus cuatro pezones (se escala para hincharla)
    const udder = new THREE.Group();
    udder.position.set(0, 0.62, -0.18);
    hulled(udder, ink, 0.34, 0.2, 0.3, PINK, 0, -0.08, 0);
    for (const [x, z] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) hulled(udder, ink, 0.05, 0.1, 0.05, PINK2, x, -0.22, z);
    body.add(udder);
    return { g, body, legs, head, tail, udder, step: Math.random() * 6 };
}

// Un fotograma de la vaca: galope al ritmo de su velocidad (speed, m/s) y la ubre hinchada swell
// (0 vacía, 1 a punto). La ubre crece hasta hacerse gigante (UDDER veces): pasada la mitad ya no
// le caben las patas debajo, así que la vaca se sube encima y va botando por el prado sobre ella
// como en una pelota saltarina (las patas colgando, la ubre aplastándose en cada bote). Deja en
// c.lift lo alta que va (el cuerpo), en c.us lo grande que es la ubre y en c.boing true el
// fotograma en que toca el suelo.
export const UDDER = 6;
export function animateCow(c, dt, time, speed, swell) {
    c.step += dt * (2 + speed * 3.2);
    const k = Math.min(1, speed / 3), sw = 0.3 + k * 0.5;
    const us = 0.6 + swell * swell * (UDDER - 0.6), ride = Math.min(1, Math.max(0, (swell - 0.45) / 0.4));
    // Botes sobre la ubre (más deprisa cuanto más corre)
    c.hop = (c.hop || 0) + dt * (5.5 + speed * 1.2) * ride;
    const air = Math.abs(Math.sin(c.hop)), contact = 1 - Math.min(1, air * 4);
    c.boing = ride > 0.5 && air < 0.25 && !c.down;
    c.down = air < 0.25;
    // Patas: galope normal, o colgando y pataleando en el aire
    const gallop = Math.sin(c.step) * sw, dangle = 0.35 + Math.sin(time * 9 + c.step) * 0.25;
    c.legs[0].rotation.x = c.legs[3].rotation.x = gallop * (1 - ride) + dangle * ride;
    c.legs[1].rotation.x = c.legs[2].rotation.x = -gallop * (1 - ride) + -dangle * ride;
    // Lo que tiene que subir para que la ubre (con sus pezones) quepa debajo, y el bote
    const lift = Math.max(0, 0.27 * us - 0.62);
    c.lift = lift + air * 0.7 * ride + Math.abs(Math.sin(c.step)) * 0.08 * k * (1 - ride);
    c.us = us;
    c.body.position.y = c.lift;
    c.body.rotation.x = Math.sin(c.step * 2) * 0.04 * k * (1 - ride) + Math.cos(c.hop) * 0.18 * ride;
    c.head.rotation.x = Math.sin(c.step) * 0.08 + (speed < 0.3 && ride < 0.2 ? 0.35 : 0) - ride * 0.25; // quieta: pasta; botando: cabeza arriba
    c.tail.rotation.z = Math.sin(time * 4 + c.step) * 0.4 + ride * Math.sin(time * 12) * 0.5;
    // La ubre: tiembla cuando está llena y se aplasta al tocar el suelo
    const wob = swell >= 1 ? Math.sin(time * 14 + c.step) * 0.07 * us : 0, sq = contact * ride * 0.28;
    c.udder.scale.set(us * (1 + sq * 0.6) + wob, us * (1 - sq) - wob, us * (1 + sq * 0.6) + wob);
}
