// Chatarra de un terreno abandonado: neumáticos, bidones oxidados, chapas, neveras, tubos,
// cajas rotas y algún coche desguazado, todo con cajas. La usan el mapa de la granja (en
// pequeño) y el campo de tiro del desbloqueo (a tamaño real), con el barril rojo encima del montón.
export const JUNK = {
    rust: [0x8a4a2a, 0xa85a2a, 0x6a3a22, 0x9a6a3a],
    metal: [0x6a6a66, 0x8a8a80],
    tire: 0x2e2a28,
    fridge: 0xc8c0a8,
    wood: 0x8a6a3a,
    barrel: 0xd8302a,
    barrelDark: 0x2a1a0e,
    barrelBand: 0xffcc33,
    ground: [0x7a6a42, 0x6a5a36, 0x8a7a4a, 0x6f8a3a], // tierra sucia con calvas de maleza
};

const pick = (a) => a[(Math.random() * a.length) | 0];

// Una pieza suelta (una o dos cajas) apoyada en el suelo a la altura y. flat: solo piezas bajas
// (las del montón, para que ninguna tape el barril de arriba)
function piece(x, y, z, s, flat = false) {
    const ry = Math.random() * Math.PI;
    const k = flat ? [0.1, 0.3, 0.45, 0.85][(Math.random() * 4) | 0] : Math.random();
    const tilt = () => (Math.random() - 0.5) * 0.5;
    if (k < 0.2) return [{ x, y: y + 0.14 * s, z, sx: 0.8 * s, sy: 0.28 * s, sz: 0.8 * s, ry, color: JUNK.tire }];
    if (k < 0.38) return [{ x, y: y + 0.28 * s, z, sx: 0.55 * s, sy: 0.55 * s, sz: 0.85 * s, ry, rz: tilt() * 0.3, color: pick(JUNK.rust) }];
    if (k < 0.55) return [{ x, y: y + 0.12 * s, z, sx: 1.3 * s, sy: 0.08 * s, sz: 0.8 * s, ry, rz: tilt(), color: pick(JUNK.rust) }];
    if (k < 0.66) return [{ x, y: y + 0.5 * s, z, sx: 0.7 * s, sy: 1.1 * s, sz: 0.6 * s, ry, rz: tilt() * 0.6, color: JUNK.fridge }];
    if (k < 0.8) return [{ x, y: y + 0.08 * s, z, sx: 0.14 * s, sy: 0.14 * s, sz: 1.5 * s, ry, color: pick(JUNK.metal) }];
    if (k < 0.92) return [{ x, y: y + 0.2 * s, z, sx: 0.6 * s, sy: 0.4 * s, sz: 0.6 * s, ry, rz: tilt() * 0.4, color: JUNK.wood }];
    // Coche desguazado: carrocería y cabina
    const c = pick(JUNK.rust);
    return [
        { x, y: y + 0.32 * s, z, sx: 2 * s, sy: 0.6 * s, sz: 1 * s, ry, color: c },
        { x, y: y + 0.8 * s, z, sx: 1.1 * s, sy: 0.45 * s, sz: 0.9 * s, ry, color: pick(JUNK.rust) },
    ];
}

// Piezas repartidas por el terreno (inside(x, z) dice si un punto vale) y un montón en (px, pz)
// con el barril rojo encima. s: escala (1 = tamaño real, en el campo de tiro). layers: capas
// del montón, de abajo arriba, como [radio, piezas].
// Devuelve { pieces: [cajas], barrel: { x, y, z, w, h } (y = base del barril) }
export function junkyard({ x0, z0, x1, z1, px, pz, count, s = 1, inside = () => true, layers = [[1.6, 7], [1.1, 5], [0.6, 3]] }) {
    const pieces = [];
    for (let n = 0, tries = 0; n < count && tries < count * 20; tries++) {
        const x = x0 + Math.random() * (x1 - x0), z = z0 + Math.random() * (z1 - z0);
        if (!inside(x, z) || Math.hypot(x - px, z - pz) < 2.2 * s) continue;
        pieces.push(...piece(x, 0, z, s));
        n++;
    }
    // El montón: capas de chatarra cada vez más estrechas
    let y = 0;
    for (const [r, n] of layers) {
        for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + Math.random() * 0.6, d = r * s * (0.4 + Math.random() * 0.6);
            pieces.push(...piece(px + Math.sin(a) * d, y, pz + Math.cos(a) * d, s, true));
        }
        pieces.push({ x: px, y: y + 0.3 * s, z: pz, sx: r * 1.4 * s, sy: 0.6 * s, sz: r * 1.4 * s, ry: Math.random(), color: pick(JUNK.rust) });
        y += 0.6 * s;
    }
    const barrel = { x: px, y, z: pz, w: 0.7 * s, h: 0.95 * s };
    return { pieces, barrel };
}

// Cajas del barril rojo (cuerpo, aros oscuros y banda amarilla) apoyado en la base b.y
export function barrelParts(b) {
    const { x, y, z, w, h } = b;
    return [
        { x, y: y + h / 2, z, sx: w, sy: h, sz: w, color: JUNK.barrel },
        { x, y: y + h * 0.2, z, sx: w * 1.08, sy: h * 0.07, sz: w * 1.08, color: JUNK.barrelDark },
        { x, y: y + h * 0.8, z, sx: w * 1.08, sy: h * 0.07, sz: w * 1.08, color: JUNK.barrelDark },
        { x, y: y + h * 0.5, z, sx: w * 1.02, sy: h * 0.16, sz: w * 1.02, color: JUNK.barrelBand },
    ];
}
