import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';

// Gallina voxel (para su corral del mapa y su campo de tiro): cuerpo blanco, cola levantada,
// cresta y barbilla rojas, pico y patas naranjas, alas que aletean (sin cara, como todo en el
// juego). Mira hacia +z. animateChicken: corretea, picotea, se agacha temblando cuando va a
// lanzar el huevo (swell) y aletea al lanzarlo (flap)
const WHITE = 0xfaf6ec, CREAM = 0xf0e6d0, RED = 0xe8352a, ORANGE = 0xf0a020;
const MATS = new Map();
const mat = (c) => MATS.get(c) || MATS.set(c, toon(c)).get(c);

function hulled(parent, ink, w, h, d, color, x = 0, y = 0, z = 0, hull = true) {
    const m = new THREE.Mesh(box(1, 1, 1), mat(color));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    if (hull) {
        const o = new THREE.Mesh(box(1, 1, 1), ink);
        o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
        o.position.copy(m.position);
        parent.add(o);
    }
    return m;
}

export function buildChicken(ink) {
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    hulled(body, ink, 0.34, 0.3, 0.44, WHITE, 0, 0.42, 0);
    hulled(body, ink, 0.24, 0.26, 0.14, CREAM, 0, 0.56, -0.24); // la cola, levantada
    const legs = [-0.08, 0.08].map((x) => {
        const l = new THREE.Group();
        l.position.set(x, 0.28, 0);
        hulled(l, ink, 0.05, 0.26, 0.05, ORANGE, 0, -0.13, 0, false);
        hulled(l, ink, 0.1, 0.03, 0.12, ORANGE, 0, -0.26, 0.03, false);
        body.add(l);
        return l;
    });
    const wings = [-1, 1].map((s) => {
        const w = new THREE.Group();
        w.position.set(s * 0.18, 0.5, 0.02);
        hulled(w, ink, 0.06, 0.2, 0.3, CREAM, s * 0.02, -0.06, 0);
        body.add(w);
        w.side = s;
        return w;
    });
    const head = new THREE.Group();
    head.position.set(0, 0.68, 0.2);
    hulled(head, ink, 0.2, 0.22, 0.2, WHITE, 0, 0, 0);
    hulled(head, ink, 0.06, 0.1, 0.16, RED, 0, 0.15, -0.01); // cresta
    hulled(head, ink, 0.1, 0.06, 0.1, ORANGE, 0, -0.01, 0.14, false); // pico
    hulled(head, ink, 0.05, 0.08, 0.04, RED, 0, -0.1, 0.1, false); // barbilla
    body.add(head);
    return { g, body, legs, wings, head, step: Math.random() * 6, flap: 0, peck: Math.random() * 6 };
}

// swell: 0 recién lanzado, 1 a punto (se agacha y tiembla). c.flap > 0: aletea (al lanzar)
export function animateChicken(c, dt, time, speed, swell) {
    c.step += dt * (4 + speed * 6);
    const k = Math.min(1, speed / 2.5);
    const run = Math.sin(c.step);
    c.legs[0].rotation.x = run * 0.7 * k;
    c.legs[1].rotation.x = -run * 0.7 * k;
    const crouch = Math.max(0, (swell - 0.7) / 0.3);
    c.body.position.y = Math.abs(Math.sin(c.step)) * 0.06 * k - crouch * 0.08 + (c.flap > 0 ? Math.sin((c.flap / 0.5) * Math.PI) * 0.25 : 0);
    c.body.rotation.z = crouch * Math.sin(time * 40) * 0.08;
    c.body.rotation.x = k * 0.15;
    // Picotea cuando va despacio
    c.peck += dt;
    const pecking = speed < 0.4 && Math.sin(c.peck * 1.3) > 0.6;
    c.head.rotation.x = pecking ? 0.9 + Math.sin(time * 18) * 0.25 : Math.sin(c.step * 2) * 0.12 * k;
    // Alas: pegadas al correr (un poco abiertas), batiendo al lanzar
    c.flap = Math.max(0, c.flap - dt);
    for (const w of c.wings) w.rotation.z = w.side * (c.flap > 0 ? 0.4 + Math.abs(Math.sin(time * 30)) * 1.1 : 0.12 * k + crouch * 0.3);
}
