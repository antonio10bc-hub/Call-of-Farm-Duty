import * as THREE from 'three';
import { box, toon, OUTLINE } from './materials.js';

// Las armas de la caja sorpresa, hechas de cubos (el cañón hacia -z, como el rifle): las mismas
// piezas sirven para el arma en primera persona (RifleModel.setSpecial) y para las que giran sobre
// la caja. Cada pieza: [ancho, alto, fondo, color, x, y, z, sin contorno (brilla)]
//   muzzle   dónde sale el disparo
//   sight    altura de su mira (alza y punto de mira): al apuntar queda a la altura del ojo
//   sightX   a qué lado está (la de la bazuca, en el costado izquierdo del tubo)
export const WONDER_LOOK = {
    // Bazuca: el tubo verde, la cabeza del cohete asomando con su punta roja, empuñaduras, la
    // tobera de atrás y su mira al costado izquierdo (alza atrás y punto de mira amarillo delante,
    // cada uno en su soporte)
    rpg: {
        muzzle: -1.26,
        sight: 0.1,
        sightX: -0.24,
        parts: [
            [0.16, 0.04, 0.05, 0x2a2a2a, -0.15, 0.05, -0.05], [0.07, 0.06, 0.03, 0x2a2a2a, -0.24, 0.08, -0.05],
            [0.16, 0.04, 0.05, 0x2a2a2a, -0.15, 0.05, -0.68], [0.025, 0.06, 0.025, 0xffe03a, -0.24, 0.08, -0.68, true],
            [0.16, 0.16, 1.2, 0x5a6a3a, 0, 0.02, -0.25], [0.24, 0.24, 0.3, 0x6a7a5a, 0, 0.02, -0.97],
            [0.13, 0.13, 0.13, 0xc8402e, 0, 0.02, -1.17], [0.07, 0.17, 0.08, 0x2a2a2a, 0, -0.13, 0.05],
            [0.07, 0.17, 0.08, 0x2a2a2a, 0, -0.13, -0.3], [0.04, 0.1, 0.06, 0x2a2a2a, 0.1, 0.12, -0.3],
            [0.22, 0.22, 0.08, 0x3a3a3a, 0, 0.02, 0.37],
        ],
    },
    // Pistola de rayos: cuerpo rojo, empuñadura, cañón plateado con tres anillos verdes que brillan,
    // aleta arriba y el plato de la boca
    ray: {
        muzzle: -0.78,
        sight: 0.17,
        parts: [
            [0.02, 0.04, 0.03, 0x7dff4a, 0, 0.13, -0.66, true],
            [0.12, 0.16, 0.42, 0xc8402e, 0, 0, -0.2], [0.1, 0.24, 0.12, 0x3a2a2a, 0, -0.18, 0],
            [0.08, 0.08, 0.3, 0xc0c8d0, 0, 0.02, -0.55], [0.04, 0.1, 0.3, 0xc0c8d0, 0, 0.12, -0.2],
            [0.2, 0.2, 0.04, 0xc0c8d0, 0, 0.02, -0.72],
            [0.18, 0.18, 0.04, 0x7dff4a, 0, 0.02, -0.45, true], [0.18, 0.18, 0.04, 0x7dff4a, 0, 0.02, -0.55, true],
            [0.18, 0.18, 0.04, 0x7dff4a, 0, 0.02, -0.65, true],
        ],
    },
    // Ballesta explosiva: culata de madera, palas, cuerda, mirilla y el virote con su carga roja
    xbow: {
        muzzle: -0.76,
        sight: 0.16,
        parts: [
            [0.1, 0.12, 0.6, 0x8a5a2a, 0, -0.02, 0], [0.08, 0.16, 0.1, 0x5a3a1a, 0, -0.14, 0.16],
            [0.9, 0.06, 0.08, 0x3a3a3a, 0, 0.02, -0.36], [0.86, 0.015, 0.015, 0xf3ead2, 0, 0.03, -0.26, true],
            [0.03, 0.03, 0.62, 0x7a4f2a, 0, 0.07, -0.4], [0.08, 0.08, 0.1, 0xc8402e, 0, 0.07, -0.72],
            [0.06, 0.06, 0.2, 0x2a2a2a, 0, 0.13, -0.04],
        ],
    },
};

const MATS = new Map();
const mat = (c, glow) => {
    const k = `${c}${glow ? 'g' : ''}`;
    return MATS.get(k) || MATS.set(k, glow ? new THREE.MeshBasicMaterial({ color: c }) : toon(c)).get(k);
};

// Pieza con su contorno de tinta (las que brillan, sin él)
function hulled(parent, ink, [w, h, d, color, x, y, z, glow]) {
    const m = new THREE.Mesh(box(1, 1, 1), mat(color, glow));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    if (glow) return m;
    const o = new THREE.Mesh(box(1, 1, 1), ink);
    o.scale.set(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2);
    o.position.copy(m.position);
    parent.add(o);
    return m;
}

// Un arma de la caja, para enseñarla en el mundo (sobre la caja)
export function buildWonder(id, ink) {
    const g = new THREE.Group();
    for (const p of WONDER_LOOK[id].parts) hulled(g, ink, p);
    return g;
}

// La caja: madera oscura con tablones claros, esquinas de chapa, interrogantes pintados y la tapa
// (que se abre girando desde atrás)
export function buildBox(ink) {
    const g = new THREE.Group(), WOOD = 0x6a4224, PLANK = 0x8a5a30, METAL = 0x9aa8b8, MARK = 0xfff3d6;
    hulled(g, ink, [1.3, 0.6, 0.7, WOOD, 0, 0.3, 0]);
    for (const y of [0.15, 0.45]) hulled(g, ink, [1.32, 0.08, 0.72, PLANK, 0, y, 0]);
    for (const x of [-0.62, 0.62]) for (const z of [-0.32, 0.32]) hulled(g, ink, [0.08, 0.62, 0.08, METAL, x, 0.31, z]);
    // «?» pintados a los lados (dos trazos de un interrogante)
    for (const z of [0.36, -0.36]) {
        for (const x of [-0.3, 0.3]) {
            hulled(g, ink, [0.14, 0.05, 0.02, MARK, x, 0.42, z, true]);
            hulled(g, ink, [0.05, 0.12, 0.02, MARK, x + 0.06, 0.36, z, true]);
            hulled(g, ink, [0.05, 0.05, 0.02, MARK, x, 0.22, z, true]);
        }
    }
    const lid = new THREE.Group();
    lid.position.set(0, 0.6, -0.35);
    hulled(lid, ink, [1.34, 0.1, 0.74, PLANK, 0, 0.05, 0.35]);
    hulled(lid, ink, [1.36, 0.04, 0.08, METAL, 0, 0.1, 0.7]);
    // Un «?» grande pintado en la tapa, a píxeles (se lee desde arriba, desde la torre; su parte
    // de arriba hacia el fondo, -z)
    const Q = ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.....', '..X..'], u = 0.08;
    Q.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === 'X') hulled(lid, ink, [u, 0.01, u, MARK, (c - 2) * u, 0.105, 0.35 + (r - 3) * u, true]);
    }));
    g.add(lid);
    g.lid = lid;
    return g;
}

// El «?» que flota encima (siempre de cara a la cámara): dibujado en píxeles
export function boxIcon() {
    const cv = Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
    const c = cv.getContext('2d');
    const rows = ['....KKKKKK......', '...KYYYYYYK.....', '..KYYKKKKYYK....', '..KYK....KYK....', '..KKK....KYK....', '........KYYK....', '.......KYYK.....', '......KYYK......', '......KYK.......', '......KKK.......', '................', '......KKK.......', '......KYK.......', '......KKK.......', '................', '................'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === '.') return;
        c.fillStyle = ch === 'K' ? '#2a1a0e' : '#9fdcff';
        c.fillRect(x + 2, y, 1, 1);
    }));
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
}
