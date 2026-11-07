// El relieve del mapa: colinas suaves que suben hacia las montañas del fondo (-x -z), un valle
// por donde baja el río hasta un lago y, de ahí, hacia el este. Escalonado en saltos de STEP (como
// todo, a cubos). groundH(x, z): la altura natural en un punto (sin parcelas); las parcelas se
// asientan a la altura del terreno donde caen y el terreno se funde con ellas (world/Scenery.js).

export const STEP = 0.6;
export const RIVER = [
    [-30, -112, 3], [-12, -80, 3.5], [-2, -46, 4], [-14, -10, 4.5], [-24, 30, 5], [-26, 62, 5], [-28, 92, 5.5],
];
export const LAKE = { x: -30, z: 108, r: 11 };
export const OUT = [[-14, 116, 5.5], [30, 114, 6], [80, 108, 6.5], [150, 126, 7]];

// Colinas: centro, altura y radio (campanas suaves que se suman)
const BUMPS = [
    [24, -42, 3.2, 26], [78, -60, 6.5, 34], [-36, -56, 5, 28], [66, 28, 4, 26], [74, 76, 2.4, 26],
    [-62, 56, 2, 24], [-58, 0, 1.4, 22], [112, 4, 5, 20], [-104, -24, 4.4, 22], [40, 104, 3, 20],
    [-80, -86, 6, 26], [104, -100, 6, 26], [8, 76, 1.2, 18],
];

const segDist = (x, z, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
    return { d: Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t), w: a[2] + (b[2] - a[2]) * t };
};
export function nearLine(x, z, pts) {
    let best = { d: Infinity, w: 3 };
    for (let i = 0; i < pts.length - 1; i++) {
        const r = segDist(x, z, pts[i], pts[i + 1]);
        if (r.d < best.d) best = r;
    }
    return best;
}
// Lo lejos que está del agua (0 dentro)
export function waterDist(x, z) {
    const r = nearLine(x, z, RIVER), o = nearLine(x, z, OUT);
    return Math.max(0, Math.min(r.d - r.w / 2, o.d - o.w / 2, Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.r));
}
const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

// La altura natural (antes de escalonar)
export function groundRaw(x, z) {
    let h = 0;
    for (const [bx, bz, a, r] of BUMPS) h += a * 1.8 * Math.exp(-((x - bx) ** 2 + (z - bz) ** 2) / (r * r));
    // Ondulación suave y la subida hacia las montañas del fondo
    h += 0.5 * (Math.sin(x * 0.09 + 0.7) * Math.cos(z * 0.08 - 1.1) + 0.6);
    h += Math.max(0, -(x + z) - 110) * 0.05;
    // El valle del río: llano junto al agua
    return Math.max(0, h) * smooth(1, 12, waterDist(x, z));
}

export const quant = (h) => Math.round(h / STEP) * STEP;
export const groundH = (x, z) => quant(groundRaw(x, z));
