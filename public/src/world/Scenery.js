import * as THREE from 'three';
import { box, toon } from '../render/materials.js';

// El paisaje alrededor de la granja (fuera de la cuadrícula de parcelas), compuesto para que se
// vea bonito desde el mapa: al fondo (arriba en pantalla, hacia -x -z) una cordillera con nieve;
// delante, colinas escalonadas; un río que baja de las montañas, rodea la granja por el oeste y
// el sur y se va hacia el este, con un puente de madera donde lo cruza el camino principal; y
// arboledas a las faldas de las colinas y a la orilla del río. Todo con cubos y contorno.
//   farm   la granja (usa su addHulled/addAnimated para que entre con la ola del principio)
// blocked(x, z): si ahí hay río, colina o montaña (para no plantar árboles encima)

// El río: puntos por los que pasa y su anchura en cada tramo (más ancho río abajo)
const RIVER = [
    [-76, -58, 2.5], [-58, -42, 3.5], [-46, -22, 4.5], [-44, 8, 5], [-42, 40, 5],
    [-34, 66, 5.5], [-12, 77, 5.5], [15, 79, 6], [45, 76, 6], [76, 84, 6.5], [110, 104, 7], [160, 140, 7.5],
];
// Colinas escalonadas: centro, radio y escalones
const HILLS = [
    [-74, -18, 8, 2], [-28, -70, 10, 3], [10, -74, 9, 2], [44, -68, 8, 2], [80, -38, 10, 3], [90, 22, 8, 2],
    [-74, 92, 9, 2], [92, 62, 7, 2], [-70, 40, 8, 2],
];
// La cordillera del fondo: centro, anchura de la base y altura
const PEAKS = [
    [-87, -26, 52, 29], [-72, -59, 60, 38], [-43, -80, 58, 33], [-10, -87, 52, 28], [22, -91, 46, 23],
    [-101, 8, 44, 21], [-107, -53, 44, 25], [-69, -101, 50, 28], [54, -90, 40, 19], [-117, 43, 40, 16],
];
// Arboledas: centro, radio y cuántos árboles
const GROVES = [
    [-48, -78, 14, 34], [-82, -26, 12, 26], [-80, 50, 12, 24], [-58, 104, 10, 16], [26, -84, 14, 30],
    [64, -84, 12, 22], [96, -10, 12, 22], [100, 44, 10, 16], [70, 104, 12, 18], [-20, 104, 10, 14],
    [-100, -60, 10, 18], [-26, -96, 10, 18], [118, -60, 10, 14],
];

const segDist = (x, z, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
    return { d: Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t), w: a[2] + (b[2] - a[2]) * t };
};
// Lo cerca que está del río (y su media anchura ahí)
function riverAt(x, z) {
    let best = { d: Infinity, w: 3 };
    for (let i = 0; i < RIVER.length - 1; i++) {
        const r = segDist(x, z, RIVER[i], RIVER[i + 1]);
        if (r.d < best.d) best = r;
    }
    return best;
}

export function blocked(x, z) {
    const r = riverAt(x, z);
    if (r.d < r.w / 2 + 2) return true;
    if (HILLS.some(([hx, hz, R]) => Math.hypot(x - hx, z - hz) < R + 1)) return true;
    return PEAKS.some(([px, pz, W]) => Math.hypot(x - px, z - pz) < W * 0.55);
}

// Dónde cruza el camino principal (x 14..16) el río: para el puente y para cortar el camino
export const BRIDGE = (() => {
    let z = 60;
    for (let k = 60; k < 120; k += 0.5) if (riverAt(15, k).d < riverAt(15, z).d) z = k;
    return { x: 15, z, half: riverAt(15, z).w / 2 + 1.6 };
})();

export function buildScenery(farm) {
    const theme = farm.theme;
    // ---------- El río: casillas de agua (dos tonos) con su orilla de arena ----------
    const water = [], bank = [];
    for (let z = -100; z < 160; z++) for (let x = -130; x < 180; x++) {
        const cx = x + 0.5, cz = z + 0.5, r = riverAt(cx, cz);
        if (r.d > r.w / 2 + 1.3) continue;
        if (cx > -30 && cx < 60 && cz > -30 && cz < 60) continue; // nunca dentro de las parcelas
        if (r.d <= r.w / 2) water.push({ x: cx, y: -0.27, z: cz, sx: 1, sy: 0.08, sz: 1, color: (Math.floor(cx * 0.5) + Math.floor(cz * 0.5)) & 1 ? 0x4aa8e0 : 0x3f98d4, deep: r.d < r.w / 4 });
        else bank.push({ x: cx, y: -0.27, z: cz, sx: 1, sy: 0.06, sz: 1 });
    }
    const wm = new THREE.InstancedMesh(box(1, 1, 1), toon(0xffffff), water.length);
    water.forEach((p, i) => wm.setColorAt(i, new THREE.Color(p.deep ? 0x2f84c4 : p.color)));
    farm.addAnimated(wm, water, 0.6);
    farm.addAnimated(new THREE.InstancedMesh(box(1, 1, 1), toon(0xd9c48a), bank.length), bank, 0.6);
    // Destellos sobre el agua (se mueven río abajo en update)
    farm.riverGlints = [];
    const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let k = 0; k < 40; k++) {
        const m = new THREE.Mesh(box(0.5, 0.04, 0.16), gm);
        m.userData.t = Math.random();
        farm.root.add(m);
        farm.riverGlints.push(m);
    }

    // ---------- El puente de madera del camino principal ----------
    const B = BRIDGE, WOOD = 0x9a6a3a, WOOD2 = 0x7a4f2a, deck = [], rails = [];
    for (let z = B.z - B.half; z <= B.z + B.half; z += 0.5) deck.push({ x: B.x, y: 0.12, z, sx: 3.6, sy: 0.16, sz: 0.44 });
    for (const sx of [-1, 1]) {
        rails.push({ x: B.x + sx * 1.9, y: 0.55, z: B.z, sx: 0.14, sy: 0.12, sz: B.half * 2 });
        for (let z = B.z - B.half; z <= B.z + B.half + 0.01; z += B.half / 2) rails.push({ x: B.x + sx * 1.9, y: 0.32, z, sx: 0.16, sy: 0.6, sz: 0.16 });
    }
    farm.addHulled(WOOD, deck, 0.7);
    farm.addHulled(WOOD2, rails, 0.75);

    // ---------- Colinas escalonadas (hierba, cada escalón algo más claro) ----------
    const hills = [];
    const GR = [0x5f9e38, 0x6aaa3e, 0x78b848, 0x86c452];
    for (const [hx, hz, R, L] of HILLS) {
        for (let k = 0; k < L; k++) {
            const r = R * (1 - k / (L + 0.6)), y = 0.6 + k * 1.2;
            // Dos cajas cruzadas por escalón: de lejos se lee redondeada
            hills.push({ x: hx, y: y - 0.6, z: hz, sx: r * 2, sy: 1.2, sz: r * 1.5, color: GR[k] });
            hills.push({ x: hx, y: y - 0.6, z: hz, sx: r * 1.5, sy: 1.2, sz: r * 2, color: GR[k] });
        }
    }
    const hm = farm.addHulled(0xffffff, hills.map((p) => ({ ...p, y: p.y + 0.6 })), 0.8);
    hills.forEach((p, i) => hm.setColorAt(i, new THREE.Color(p.color)));

    // ---------- La cordillera: pirámides escalonadas de roca con nieve arriba ----------
    const rock = [];
    for (const [px, pz, W, H] of PEAKS) {
        const steps = 7, h = H / steps;
        for (let k = 0; k < steps; k++) {
            const w = W * (1 - k / steps), snow = k >= steps - 2;
            const c = snow ? 0xf4f6fa : k % 2 ? 0x8a8a96 : 0x7a7a88;
            rock.push({ x: px + Math.sin(k * 1.7) * 1.5, y: k * h + h / 2, z: pz + Math.cos(k * 1.3) * 1.5, sx: w, sy: h, sz: w * 0.85, ry: 0.15 * k, color: c });
        }
    }
    const rm = farm.addHulled(0xffffff, rock, 1);
    rock.forEach((p, i) => rm.setColorAt(i, new THREE.Color(p.color)));

    // ---------- Arboledas (además de los árboles sueltos de alrededor de la valla) ----------
    const spots = [];
    for (const [gx, gz, R, n] of GROVES) {
        for (let k = 0, tries = 0; k < n && tries < n * 20; tries++) {
            const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R, x = gx + Math.cos(a) * d, z = gz + Math.sin(a) * d;
            if (blocked(x, z) || spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 1.8)) continue;
            spots.push([x, z]);
            k++;
        }
    }
    // A la orilla del río, de vez en cuando
    for (let i = 0; i < RIVER.length - 1; i++) {
        const [ax, az, w] = RIVER[i], [bx, bz] = RIVER[i + 1];
        for (let t = 0.1; t < 1; t += 0.22) {
            const x = ax + (bx - ax) * t, z = az + (bz - az) * t, nx = -(bz - az), nz = bx - ax, L = Math.hypot(nx, nz), s = Math.random() < 0.5 ? -1 : 1;
            const px = x + (nx / L) * s * (w / 2 + 3 + Math.random() * 2), pz = z + (nz / L) * s * (w / 2 + 3 + Math.random() * 2);
            if (!blocked(px, pz) && !(px > -32 && px < 62 && pz > -32 && pz < 62) && Math.abs(px - 15) > 4) spots.push([px, pz]);
        }
    }
    return spots;
}

// Los destellos del río bajan con la corriente
export function updateScenery(farm, dt) {
    if (!farm.riverGlints) return;
    for (const m of farm.riverGlints) {
        m.userData.t = (m.userData.t + dt * 0.012) % 1;
        const f = m.userData.t * (RIVER.length - 1), i = Math.floor(f), k = f - i, a = RIVER[i], b = RIVER[i + 1];
        const off = Math.sin(m.id * 1.7) * a[2] * 0.3;
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
        m.position.set(a[0] + dx * k - (dz / L) * off, -0.17, a[1] + dz * k + (dx / L) * off);
        m.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
        m.visible = Math.sin(m.userData.t * 300 + m.id) > -0.2;
    }
}
