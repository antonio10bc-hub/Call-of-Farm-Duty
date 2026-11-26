import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';
import { CROPS } from '../content/crops.js';

// Cabra voxel (para su risco del mapa y su campo de tiro): cuerpo corto, patas finas con pezuña
// oscura, cuello hacia arriba, cabeza con dos cuernos hacia atrás, perilla y el rabito tieso. Sin
// cara, como todo en el juego. Mira hacia +z. animateGoat: las patas se recogen en el aire y la
// cabeza cabecea en tierra
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

function leg(parent, ink, x, z, coat, dark) {
    const g = new THREE.Group();
    g.position.set(x, 0.46, z);
    hulled(g, ink, 0.09, 0.38, 0.09, coat, 0, -0.19, 0);
    hulled(g, ink, 0.1, 0.08, 0.1, dark, 0, -0.42, 0);
    parent.add(g);
    return g;
}

// coat: el color de su pelo (si no, uno al azar de los de la cabra)
export function buildGoat(ink, coat) {
    const G = CROPS.pumpkin;
    coat = coat ?? G.coat[(Math.random() * G.coat.length) | 0];
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    // (el cuerpo gira sobre su centro: así da las volteretas)
    body.position.y = 0.6;
    hulled(body, ink, 0.4, 0.34, 0.66, coat, 0, 0.02, 0);
    const legs = [[-0.13, 0.22], [0.13, 0.22], [-0.13, -0.22], [0.13, -0.22]].map(([x, z]) => leg(body, ink, x, z, coat, G.dark)).map((l) => {
        l.position.y -= 0.6;
        return l;
    });
    // Cuello y cabeza: hacia arriba y adelante
    const head = new THREE.Group();
    head.position.set(0, 0.22, 0.32);
    body.add(head);
    hulled(head, ink, 0.18, 0.3, 0.16, coat, 0, 0.1, 0.02).rotation.x = -0.35;
    hulled(head, ink, 0.2, 0.2, 0.3, coat, 0, 0.26, 0.14);
    hulled(head, ink, 0.12, 0.12, 0.08, G.dark, 0, 0.22, 0.3); // (el morro)
    hulled(head, ink, 0.06, 0.14, 0.06, coat === G.coat[2] ? G.dark : 0xe8dcc0, 0, 0.1, 0.24); // (la perilla)
    for (const s of [-1, 1]) {
        hulled(head, ink, 0.05, 0.18, 0.05, G.horn, s * 0.06, 0.42, 0.06).rotation.x = -0.6; // (los cuernos, hacia atrás)
        hulled(head, ink, 0.12, 0.05, 0.08, coat, s * 0.14, 0.3, 0.06); // (las orejas, de lado)
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.14, -0.34);
    hulled(tail, ink, 0.08, 0.16, 0.06, coat, 0, 0.06, 0).rotation.x = -0.4;
    body.add(tail);
    return { g, body, legs, head, tail, step: Math.random() * 6 };
}

// air: 0 en tierra, 1 en pleno salto (las patas recogidas); flip: el giro de la voltereta (rad)
export function animateGoat(c, dt, time, air, flip = 0) {
    c.step += dt * 6;
    const tuck = air * 0.9, wiggle = Math.sin(c.step) * 0.08 * (1 - air);
    c.legs[0].rotation.x = c.legs[1].rotation.x = -tuck + wiggle; // (las de delante, hacia delante)
    c.legs[2].rotation.x = c.legs[3].rotation.x = tuck - wiggle; // (las de atrás, hacia atrás)
    c.body.rotation.x = flip;
    // En tierra cabecea (como si mordisqueara o fuera a embestir); en el aire, la cabeza estirada
    c.head.rotation.x = (1 - air) * Math.max(0, Math.sin(time * 2.3 + c.step * 0.3)) * 0.45 - air * 0.25;
    c.tail.rotation.x = Math.sin(time * 9 + c.step) * 0.25;
}
