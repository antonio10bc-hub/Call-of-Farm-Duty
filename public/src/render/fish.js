import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';

// Pez voxel (para la laguna del mapa y su campo de tiro): cuerpo alargado con su vientre claro,
// aleta de arriba, aletas de los lados y la cola (que coletea). Mira hacia +z. Tres tamaños, cada
// uno de su especie:
//   s   pequeño y plateado (salta alto y deprisa)
//   m   mediano, una carpa dorada
//   l   grande, verde oscuro como una perca (salta bajo y despacio)
export const FISH = {
    s: { scale: 0.55, body: 0x9ab8d0, belly: 0xe8f0f6, fin: 0x6a8aa8 },
    m: { scale: 0.85, body: 0xf0a040, belly: 0xffe0a8, fin: 0xd87a28 },
    l: { scale: 1.3, body: 0x5a7a3a, belly: 0xd8d8a0, fin: 0x3a5a2a },
};
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

export function buildFish(ink, size = 'm') {
    const F = FISH[size], g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    hulled(body, ink, 0.26, 0.32, 0.7, F.body, 0, 0, 0);
    hulled(body, ink, 0.22, 0.12, 0.56, F.belly, 0, -0.12, 0.02);
    hulled(body, ink, 0.2, 0.24, 0.16, F.body, 0, 0, 0.4); // la cabeza, un poco más estrecha
    hulled(body, ink, 0.06, 0.16, 0.3, F.fin, 0, 0.22, -0.02); // aleta de arriba
    for (const s of [-1, 1]) hulled(body, ink, 0.12, 0.04, 0.14, F.fin, s * 0.16, -0.06, 0.18).rotation.z = s * 0.4;
    // La cola: coletea desde su raíz
    const tail = new THREE.Group();
    tail.position.set(0, 0, -0.36);
    hulled(tail, ink, 0.06, 0.1, 0.12, F.body, 0, 0, -0.04);
    hulled(tail, ink, 0.06, 0.36, 0.14, F.fin, 0, 0, -0.16);
    body.add(tail);
    g.scale.setScalar(F.scale);
    return { g, body, tail, size, step: Math.random() * 6 };
}

// Coletea (más fuerte en el aire) y se dobla un poco al ritmo de la cola
export function animateFish(c, dt, air = 1) {
    c.step += dt * (10 + air * 8);
    c.tail.rotation.y = Math.sin(c.step) * (0.4 + air * 0.4);
    c.body.rotation.y = -Math.sin(c.step) * 0.08 * air;
}
