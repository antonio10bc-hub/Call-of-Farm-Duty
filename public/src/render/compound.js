import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

// El recinto militar del granero (el cuartel de las rachas de bajas): piezas sueltas que se
// reparten por toda su zona (FARM.compound). Cada una es un grupo con su centro en el suelo; la
// granja las coloca. Lo que se mueve (aspas, radar, luces) va aparte; lo demás se junta en
// pocas mallas (bake).
const OLIVE = 0x5a6a3a, OLIVE2 = 0x4a5a2e, SAND = 0xc8b08a, SAND2 = 0xa8906a, CONC = 0x9a948c, CONC2 = 0x847e76;
const DARK = 0x3a3030, YELLOW = 0xffcc33, INK = 0x2a2622, RED = 0xc8402e, CREAM = 0xfff3d6, GLASS = 0x9fdcff;

export class Compound extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        this.spin = []; // [grupo, velocidad]: aspas y radar
        this.blink = []; // luces que parpadean
    }

    // Una pieza del recinto (kind: nuke, armory, radar, heli, range, hangar, plane, checkpoint, depot)
    piece(kind, pad) {
        const g = new THREE.Group(), keep = [];
        this[kind](g, keep, pad && this.padHalf ? this.padHalf(pad) : null);
        this.root.add(g);
        this.bake([g], keep);
        return g;
    }

    sandbags(g, x, z, n, rows = 2, along = 'x') {
        for (let row = 0; row < rows; row++) for (let k = 0; k < n - row; k++) {
            const o = (k - (n - row - 1) / 2) * 0.48, ax = along === 'x';
            const h = (k + row) % 2 ? 0.26 : 0.275; // (los de un tono, un pelo más altos: sin caras en el mismo plano)
            const dd = (k + row) % 2 ? 0.34 : 0.36; // (y de fondo distinto)
            this.part(g, ax ? 0.5 : dd, h, ax ? dd : 0.5, (k + row) % 2 ? SAND : SAND2, x + (ax ? o : 0), h / 2 + row * 0.26, z + (ax ? 0 : o));
        }
    }

    crate(g, x, y, z, ry = 0) {
        this.part(g, 0.62, 0.42, 0.55, OLIVE, x, 0.21 + y, z).rotation.y = ry;
        this.part(g, 0.64, 0.08, 0.57, YELLOW, x, 0.3 + y, z, false).rotation.y = ry;
    }

    drum(g, x, z, c = RED, lying = false) {
        const d = this.part(g, 0.45, 0.62, 0.45, c, x, lying ? 0.24 : 0.31, z);
        this.part(d, 0.47, 0.06, 0.47, INK, 0, 0.18, 0, false);
        if (lying) d.rotation.z = Math.PI / 2;
    }

    flag(g, x, z, c = RED, h = 2.6) {
        this.part(g, 0.08, h, 0.08, DARK, x, h / 2, z, false);
        this.part(g, 0.8, 0.5, 0.04, c, x + 0.42, h - 0.3, z, false);
    }

    lamp(g, x, z) {
        this.part(g, 0.1, 1.8, 0.1, DARK, x, 0.9, z, false);
        this.part(g, 0.4, 0.08, 0.1, DARK, x + 0.15, 1.8, z, false);
        this.part(g, 0.24, 0.2, 0.24, 0xfff0a0, x + 0.3, 1.7, z);
    }

    // La bomba nuclear de la racha de 10: un recinto de alta seguridad que llena su plataforma.
    // En medio, la bomba tumbada en su remolque bajo un pórtico de carga; alrededor, valla de
    // malla con alambre de espino y su portón con barrera; en las esquinas, mástiles con
    // rotativos rojos que giran; la sirena, la caseta de control, barreras de hormigón, bidones,
    // carteles de radiación y focos
    nuke(g, keep, half) {
        // (la valla: medio ancho y medio fondo; a la medida de la plataforma, dentro de su borde de franjas)
        const [X, Z] = half ? [Math.max(4.6, half[0] - 1.3), Math.max(2.8, half[1] - 1.3)] : [5.2, 3.1];
        // Lo del medio (remolque, bomba y pórtico), más grande: es lo que se tiene que ver
        const core = new THREE.Group();
        core.scale.setScalar(1.4);
        core.position.x = -0.4;
        g.add(core);
        // Remolque: plataforma, ruedas y lanza
        this.part(core, 3.2, 0.2, 1.4, OLIVE2, -0.6, 0.6, 0);
        for (const x of [-1.1, 1.1]) for (const z of [-0.75, 0.75]) this.part(core, 0.55, 0.55, 0.24, 0x2e2a28, x - 0.6, 0.28, z);
        this.part(core, 1.2, 0.12, 0.12, DARK, -2.7, 0.5, 0, false);
        // La bomba: cuerpo panzudo, morro redondeado, aletas y la franja amarilla
        const b = new THREE.Group();
        b.position.x = -0.6;
        core.add(b);
        this.part(b, 2.6, 1.0, 1.0, 0x6a7a5a, 0, 1.25, 0);
        this.part(b, 2.2, 1.2, 0.8, 0x6a7a5a, 0, 1.25, 0);
        this.part(b, 0.5, 0.8, 0.8, 0x5a6a4a, 1.5, 1.25, 0);
        this.part(b, 0.3, 0.5, 0.5, 0x5a6a4a, 1.85, 1.25, 0);
        this.part(b, 0.24, 1.08, 1.08, YELLOW, 0.4, 1.25, 0, false);
        for (const [y, z, w, h] of [[1.25, 0, 0.5, 1.7], [1.25, 0, 0.5, 0.12]]) this.part(b, w, h, 0.12, 0x4a5a3a, -1.5, y, z);
        this.part(b, 0.5, 0.12, 1.7, 0x4a5a3a, -1.5, 1.25, 0);
        this.part(b, 0.6, 0.6, 0.04, YELLOW, -0.3, 1.25, 0.52, false);
        this.part(b, 0.16, 0.16, 0.05, INK, -0.3, 1.25, 0.54, false);
        for (const [dx, dy] of [[0, 0.18], [-0.16, -0.1], [0.16, -0.1]]) this.part(b, 0.14, 0.12, 0.05, INK, -0.3 + dx, 1.25 + dy, 0.54, false);
        // El pórtico de carga sobre la bomba: dos patas amarillas, la viga y el polipasto con cadenas
        for (const s of [-1, 1]) {
            this.part(core, 0.22, 3.0, 0.22, YELLOW, -0.6 + s * 1.9, 1.5, -1.05);
            this.part(core, 0.22, 3.0, 0.22, YELLOW, -0.6 + s * 1.9, 1.5, 1.05);
            this.part(core, 0.2, 0.2, 2.3, INK, -0.6 + s * 1.9, 2.95, 0);
        }
        this.part(core, 4.0, 0.26, 0.26, YELLOW, -0.6, 3.1, 0);
        this.part(core, 0.5, 0.4, 0.5, 0x5a5a56, -0.2, 2.8, 0);
        for (const x of [-0.3, -0.1]) this.part(core, 0.04, 0.9, 0.04, INK, x, 2.2, 0, false);
        // Detrás, el armero de cabezas nucleares: un bastidor con tres, tumbadas
        const rx = -X + 2.6, rz = -Z + 0.9;
        for (const x of [-1.3, 1.3]) this.part(g, 0.14, 1.2, 0.6, DARK, rx + x, 0.6, rz, false);
        for (const y of [0.35, 0.95]) this.part(g, 2.8, 0.1, 0.62, 0x5a5a56, rx, y, rz);
        for (const [x, y] of [[-0.7, 0.62], [0.7, 0.62], [0, 1.22]]) {
            this.part(g, 1.1, 0.42, 0.42, 0x6a7a5a, rx + x, y, rz);
            this.part(g, 0.2, 0.3, 0.3, 0x5a6a4a, rx + x + 0.6, y, rz);
            this.part(g, 0.1, 0.44, 0.44, YELLOW, rx + x - 0.2, y, rz, false);
        }
        // En el suelo: la zona de seguridad de la bomba (marco rojo) y un carrete de cable
        for (const [w, d, x, z] of [[6.4, 0.16, 0, -2.0], [6.4, 0.16, 0, 2.0], [0.16, 4.0, -3.2, 0], [0.16, 4.0, 3.2, 0]]) this.part(g, w, 0.03, d, RED, -0.4 + x, 0.02, z, false);
        this.part(g, 0.7, 0.7, 0.3, 0x8a5a2a, X - 0.9, 0.35, -0.6);
        this.part(g, 0.4, 0.4, 0.34, INK, X - 0.9, 0.35, -0.6, false);
        // La valla de malla: postes, dos barras, malla (oscura y fina) y espino arriba; el portón
        // (abierto, delante a la derecha) con su barrera de franjas
        const post = (x, z) => {
            this.part(g, 0.12, 1.5, 0.12, 0x6a6a66, x, 0.75, z, false);
            this.part(g, 0.2, 0.08, 0.2, INK, x, 1.55, z, false);
        };
        const rail = (x0, z0, x1, z1) => {
            const len = Math.hypot(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
            for (const [y, h, c] of [[0.3, 0.06, 0x7a7a76], [1.35, 0.06, 0x7a7a76], [0.82, 0.9, 0x4a4e4a], [1.6, 0.05, 0x9a9a96]]) {
                this.part(g, alongX ? len : 0.04 + (h > 0.5 ? 0 : 0.02), h, alongX ? 0.04 + (h > 0.5 ? 0 : 0.02) : len, c, mx, y, mz, false);
            }
            // (el espino: nudos en zigzag)
            for (let t = 0.5; t < len; t += 0.7) this.part(g, 0.1, 0.1, 0.1, 0xb8b8b4, alongX ? Math.min(x0, x1) + t : mx, 1.66 + (t % 1.4 < 0.7 ? 0.05 : 0), alongX ? mz : Math.min(z0, z1) + t, false);
        };
        const G0 = X - 3.2, G1 = X - 1.0; // (el hueco del portón, en el lado de delante)
        rail(-X, -Z, X, -Z);
        rail(-X, -Z, -X, Z);
        rail(X, -Z, X, Z);
        rail(-X, Z, G0, Z);
        rail(G1, Z, X, Z);
        for (let x = -X; x <= X + 0.01; x += 1.3) { post(x, -Z); if (x < G0 || x > G1) post(x, Z); }
        for (let z = -Z + 1.3; z < Z; z += 1.3) { post(-X, z); post(X, z); }
        post(G0, Z);
        post(G1, Z);
        // La barrera del portón: garita pequeña y brazo a franjas
        this.part(g, 0.5, 0.9, 0.4, CONC, G0 - 0.3, 0.45, Z + 0.5);
        for (let k = 0; k < 5; k++) this.part(g, 0.44, 0.12, 0.12, k % 2 ? RED : CREAM, G0 + 0.2 + k * 0.42, 0.85, Z + 0.5, false);
        // Cada esquina, un mástil con su rotativo rojo (gira y echa dos haces)
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
        for (const [x, z] of [[-X, -Z], [X, -Z], [-X, Z], [X, Z]]) {
            this.part(g, 0.14, 2.4, 0.14, DARK, x, 1.2, z, false);
            this.part(g, 0.34, 0.12, 0.34, INK, x, 2.44, z, false);
            const rot = new THREE.Group();
            rot.position.set(x, 2.66, z);
            g.add(rot);
            this.part(rot, 0.26, 0.3, 0.26, 0xff2a1a, 0, 0, 0);
            for (const s of [-1, 1]) {
                const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.14, 0.3), beamMat);
                beam.position.x = s * 0.9;
                rot.add(beam);
            }
            this.spin.push([rot, 5 + (x > 0 ? 0.4 : 0)]);
            keep.push(rot);
        }
        // La sirena: un poste alto con dos bocinas
        this.part(g, 0.14, 3.2, 0.14, DARK, -X + 0.9, 1.6, Z - 0.7, false);
        for (const s of [-1, 1]) {
            this.part(g, 0.4, 0.3, 0.3, 0x8a8a86, -X + 0.9 + s * 0.3, 3.1, Z - 0.7);
            this.part(g, 0.08, 0.36, 0.36, INK, -X + 0.9 + s * 0.52, 3.1, Z - 0.7, false);
        }
        // La caseta de control (detrás a la derecha): hormigón, ventana, luz roja encima
        this.part(g, 1.8, 1.4, 1.4, CONC, X - 1.6, 0.7, -Z + 1.2);
        this.part(g, 1.96, 0.16, 1.56, CONC2, X - 1.6, 1.48, -Z + 1.2);
        this.part(g, 0.9, 0.4, 0.06, GLASS, X - 1.6, 0.95, -Z + 1.92, false);
        this.part(g, 0.4, 0.8, 0.06, DARK, X - 2.25, 0.4, -Z + 1.92, false);
        const l = this.part(g, 0.22, 0.22, 0.22, 0xff2a1a, X - 1.6, 1.7, -Z + 1.2);
        this.blink.push(l);
        keep.push(l);
        // Barreras de hormigón (jersey) dentro de la valla, con franjas
        for (const [x, z, ry] of [[X - 3.0, Z - 1.6, 0], [X - 1.8, Z - 1.6, 0], [-X + 1.3, -0.8, Math.PI / 2], [-X + 1.3, 0.6, Math.PI / 2]]) {
            this.part(g, 1.1, 0.5, 0.36, CONC, x, 0.25, z).rotation.y = ry;
            this.part(g, 1.12, 0.12, 0.38, YELLOW, x, 0.42, z, false).rotation.y = ry;
        }
        // Bidones de residuos (amarillos con su banda) y cajas
        for (const [x, z] of [[X - 0.8, 0.3], [X - 0.8, 0.85], [X - 1.35, 0.55]]) this.drum(g, x, z, YELLOW);
        this.drum(g, -X + 0.9, Z - 0.8, OLIVE, true);
        this.crate(g, -X + 1.8, 0, Z - 0.7, 0.2);
        // Carteles: radiación en la valla y PELIGRO junto al portón
        const sign = (x, z, w = 0.8) => {
            this.part(g, w, w * 0.8, 0.06, YELLOW, x, 0.95, z + 0.05);
            this.part(g, 0.24, 0.24, 0.07, INK, x, 0.95, z + 0.09, false);
            for (const [dx, dy] of [[0, 0.16], [-0.14, -0.08], [0.14, -0.08]]) this.part(g, 0.1, 0.09, 0.07, INK, x + dx, 0.95 + dy, z + 0.09, false);
        };
        sign(-X + 2.4, Z);
        sign(-0.2, Z);
        sign(-X, 0.2 - Z * 0.3);
        this.part(g, 1.3, 0.5, 0.06, RED, G0 - 1.2, 1.35, Z + 0.06);
        for (let i = 0; i < 6; i++) this.part(g, 0.12, 0.2, 0.03, CREAM, G0 - 1.65 + i * 0.18, 1.35, Z + 0.1, false);
        // Dos focos sobre la bomba
        this.lamp(g, -X + 0.4, -Z + 0.5);
        this.lamp(g, 1.6, -Z + 0.5);
    }

    // La armería: búnker de hormigón con su portón, troneras, sacos delante, cajas de munición
    // apiladas y un armero con fusiles
    armory(g) {
        this.part(g, 5, 1.6, 3.4, CONC, 0, 0.8, -0.4);
        this.part(g, 5.3, 0.2, 3.7, CONC2, 0, 1.7, -0.4);
        this.part(g, 4.4, 0.4, 2.8, 0x6a7a5a, 0, 1.95, -0.4); // tierra y hierba encima
        this.part(g, 1.8, 1.2, 0.08, 0x3a3a34, 0, 0.6, 1.33);
        this.part(g, 1.84, 0.1, 0.1, YELLOW, 0, 1.25, 1.36, false);
        for (const x of [-1.7, 1.7]) this.part(g, 0.8, 0.16, 0.06, 0x1e1e1e, x, 1.1, 1.33, false);
        // Cartel rojo encima del portón
        this.part(g, 1.4, 0.36, 0.06, RED, 0, 1.48, 1.36);
        this.part(g, 1.0, 0.08, 0.07, CREAM, 0, 1.48, 1.39, false);
        this.sandbags(g, -1.9, 2.1, 3);
        this.sandbags(g, 1.9, 2.1, 3);
        for (const [x, z, y] of [[3.0, 0.9, 0], [3.0, 0.3, 0], [3.0, 0.6, 0.42], [3.6, 0.6, 0], [-3.1, -1.4, 0], [-3.1, -0.8, 0]]) this.crate(g, x, y, z);
        // Armero: tablero con fusiles apoyados
        this.part(g, 1.6, 1.1, 0.12, 0x7a4f2a, -3.0, 0.65, 1.0);
        for (let k = 0; k < 4; k++) this.part(g, 0.08, 0.9, 0.06, INK, -3.6 + k * 0.38, 0.6, 1.1, false).rotation.z = 0.12;
        this.flag(g, 2.7, -2.0, OLIVE);
        // Red de camuflaje sobre el búnker (parches de dos verdes y su borde caído) y una antena
        for (const [x, z, w, d, c] of [[-1.2, -0.8, 1.6, 1.4, 0x5a6a3a], [0.6, -0.2, 1.8, 1.6, 0x4a5a2e], [1.4, -1.3, 1.2, 1.0, 0x6a7a42], [-0.4, 0.4, 1.2, 0.9, 0x6a7a42]]) this.part(g, w, 0.08, d, c, x, 2.2 + (x + z) * 0.004, z, false);
        for (const x of [-2.4, 2.4]) this.part(g, 0.1, 1.2, 0.1, DARK, x, 1.6, 1.2, false);
        this.part(g, 0.06, 1.6, 0.06, DARK, 1.6, 2.9, -1.4, false);
        this.part(g, 0.4, 0.06, 0.06, DARK, 1.6, 3.5, -1.4, false);
        // Carretilla elevadora con un palé de cajas, y la valla de la plataforma (postes con cadena)
        this.part(g, 0.8, 0.5, 1.1, YELLOW, -1.9, 0.4, 3.2);
        this.part(g, 0.7, 0.4, 0.06, 0x2a2a2a, -1.9, 1.0, 2.6, false);
        for (const x of [-2.2, -1.6]) this.part(g, 0.08, 1.4, 0.08, DARK, x, 0.7, 2.6, false);
        for (const z of [2.9, 3.6]) for (const x of [-2.2, -1.6]) this.part(g, 0.22, 0.22, 0.22, 0x2e2a28, x, 0.11, z, false);
        this.crate(g, -1.9, 0.1, 2.15, 0);
        for (const [x, z] of [[-3.7, 2.6], [-3.7, -2.9], [3.9, -2.9], [3.9, 2.6]]) {
            this.part(g, 0.14, 0.8, 0.14, YELLOW, x, 0.4, z, false);
            this.part(g, 0.18, 0.12, 0.18, INK, x, 0.86, z, false);
        }
    }

    // Torre de radar: patas de celosía, caseta y la antena que gira; mástil con luz
    radar(g, keep) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(g, 0.14, 3.2, 0.14, DARK, sx * 0.7, 1.6, sz * 0.7, false);
        for (const y of [1.0, 2.1]) for (const s of [-1, 1]) {
            this.part(g, 1.5, 0.06, 0.06, DARK, 0, y, s * 0.7, false);
            this.part(g, 0.06, 0.06, 1.5, DARK, s * 0.7, y, 0, false);
        }
        this.part(g, 1.8, 0.9, 1.8, CONC, 0, 3.6, 0);
        this.part(g, 2.0, 0.12, 2.0, CONC2, 0, 4.1, 0);
        this.part(g, 0.5, 0.4, 0.06, GLASS, 0, 3.65, 0.92, false);
        const dish = new THREE.Group();
        dish.position.set(0, 4.2, 0);
        g.add(dish);
        this.part(dish, 0.12, 0.7, 0.12, DARK, 0, 0.35, 0, false);
        this.part(dish, 1.6, 0.9, 0.1, 0xd8dce2, 0, 0.9, 0.1).rotation.x = -0.4;
        this.spin.push([dish, 1.4]);
        keep.push(dish);
        // Al pie: el generador (con su tubo de escape), cables y una valla baja de postes
        this.part(g, 1.1, 0.7, 0.7, OLIVE, -1.5, 0.35, 1.0);
        this.part(g, 1.12, 0.12, 0.72, YELLOW, -1.5, 0.62, 1.0, false);
        this.part(g, 0.12, 0.5, 0.12, DARK, -1.1, 0.9, 0.8, false);
        this.part(g, 1.2, 0.04, 0.08, INK, -0.5, 0.03, 0.7, false);
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            this.part(g, 0.1, 0.6, 0.1, 0x6a6a66, Math.cos(a) * 2.0, 0.3, Math.sin(a) * 2.0, false);
        }
        this.part(g, 0.1, 3.0, 0.1, DARK, 1.6, 1.5, -1.2, false);
        const l = this.part(g, 0.18, 0.18, 0.18, 0xff2a1a, 1.6, 3.1, -1.2);
        this.blink.push(l);
        keep.push(l);
    }

    // Helipuerto con la H, balizas y el helicóptero al ralentí
    heli(g, keep) {
        this.part(g, 4.2, 0.08, 4.2, CONC2, 0, 0.04, 0);
        this.part(g, 3.6, 0.04, 3.6, CONC, 0, 0.1, 0, false);
        for (const x of [-1, 1]) this.part(g, 0.3, 0.05, 2.2, YELLOW, x, 0.14, 0, false);
        this.part(g, 2.0, 0.05, 0.3, YELLOW, 0, 0.14, 0, false);
        for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) this.part(g, 0.16, 0.16, 0.16, 0xff3e1a, x, 0.12, z);
        const h = new THREE.Group();
        h.position.set(0, 0.12, 0);
        h.rotation.y = 0.5;
        g.add(h);
        for (const s of [-0.5, 0.5]) this.part(h, 0.08, 0.08, 2.2, DARK, s, 0.05, 0, false);
        this.part(h, 1.1, 0.9, 2.2, OLIVE, 0, 0.75, 0.2);
        this.part(h, 0.9, 0.6, 0.6, GLASS, 0, 0.85, 1.4);
        this.part(h, 0.3, 0.3, 2.2, OLIVE2, 0, 0.95, -1.9);
        this.part(h, 0.06, 0.6, 0.4, OLIVE2, 0.12, 1.15, -2.9);
        this.part(h, 0.15, 0.25, 0.15, DARK, 0, 1.32, 0.2, false);
        const rotor = new THREE.Group();
        rotor.position.set(0, 1.46, 0.2);
        h.add(rotor);
        for (const r of [0, Math.PI / 2]) this.part(rotor, 4.2, 0.04, 0.18, 0x2a2a2a, 0, 0, 0, false).rotation.y = r;
        this.spin.push([rotor, 2.2]);
        keep.push(rotor);
        // Junto a la plataforma: el carro de combustible con su manguera, la manga de viento y un
        // extintor
        this.part(g, 1.3, 0.7, 0.7, RED, 2.9, 0.5, -1.2);
        for (const z of [-1.5, -0.9]) this.part(g, 0.24, 0.24, 0.24, 0x2e2a28, 2.5, 0.12, z, false), this.part(g, 0.24, 0.24, 0.24, 0x2e2a28, 3.3, 0.12, z, false);
        this.part(g, 0.8, 0.05, 0.08, INK, 2.1, 0.06, -0.8, false);
        this.part(g, 0.08, 2.2, 0.08, DARK, -2.7, 1.1, -2.4, false);
        for (let k = 0; k < 3; k++) this.part(g, 0.36 - k * 0.06, 0.26 - k * 0.04, 0.26 - k * 0.04, k % 2 ? CREAM : 0xff7a2a, -2.5 + k * 0.32, 2.0, -2.4, false);
        this.part(g, 0.22, 0.45, 0.22, RED, 2.6, 0.23, 1.6);
    }

    // El campo de tiro de pruebas: la línea de tiro bajo un tejadillo (mostrador de sacos y un
    // armero), tres calles de arena con dianas a tres distancias, un blanco que corre por su
    // raíl, siluetas de alien que se levantan y se tumban, y al fondo el talud de tierra con
    // neumáticos; banderolas de viento y cajas de munición
    range(g, keep) {
        const SANDL = 0xd8c08a, WOODR = 0x8a5a2a, BERM = 0x7a5a3a;
        // Las calles: tiras de arena con sus rayas de distancia
        for (const z of [-2.2, 0, 2.2]) {
            this.part(g, 8.2, 0.04, 1.6, SANDL, 0.6, 0.02, z, false);
            for (const x of [-1.2, 1.2, 3.4]) this.part(g, 0.08, 0.05, 1.6, CREAM, x, 0.03, z, false);
        }
        // La línea de tiro: tejadillo sobre cuatro postes, mostrador de sacos y el armero
        for (const [x, z] of [[-4.2, -3.3], [-4.2, 3.3], [-2.9, -3.3], [-2.9, 3.3]]) this.part(g, 0.16, 2.1, 0.16, WOODR, x, 1.05, z, false);
        this.part(g, 1.9, 0.14, 7.2, OLIVE2, -3.55, 2.15, 0);
        this.part(g, 2.0, 0.1, 7.3, OLIVE, -3.55, 2.27, 0);
        for (const z of [-2.2, 0, 2.2]) this.sandbags(g, -2.8, z, 3, 2, 'z');
        for (let k = 0; k < 5; k++) this.part(g, 0.1, 1.0, 0.1, 0x3a3a36, -4.3, 0.75, -1.2 + k * 0.5, false).rotation.x = 0.15;
        this.part(g, 0.2, 0.12, 2.6, WOODR, -4.3, 0.4, -0.2);
        this.part(g, 0.2, 0.12, 2.6, WOODR, -4.3, 1.15, -0.2);
        this.crate(g, -3.8, 0, 2.6, 0.2);
        this.crate(g, -3.7, 0.42, 2.6, -0.1);
        this.flag(g, -4.6, -3.6, RED, 2.8);
        // Dianas fijas: tablero con aros (cerca, medio y lejos; una por calle)
        const board = (x, z, sc = 1) => {
            this.part(g, 0.1, 1.1 * sc, 0.1, WOODR, x, 0.55 * sc, z - 0.35 * sc, false);
            this.part(g, 0.1, 1.1 * sc, 0.1, WOODR, x, 0.55 * sc, z + 0.35 * sc, false);
            this.part(g, 0.08, 0.9 * sc, 0.9 * sc, CREAM, x, 1.2 * sc, z);
            this.part(g, 0.09, 0.62 * sc, 0.62 * sc, RED, x - 0.01, 1.2 * sc, z, false);
            this.part(g, 0.1, 0.36 * sc, 0.36 * sc, CREAM, x - 0.02, 1.2 * sc, z, false);
            this.part(g, 0.11, 0.14 * sc, 0.14 * sc, RED, x - 0.03, 1.2 * sc, z, false);
            // (y por detrás, que es lo que se ve desde el mapa)
            this.part(g, 0.09, 0.62 * sc, 0.62 * sc, RED, x + 0.01, 1.2 * sc, z, false);
            this.part(g, 0.1, 0.36 * sc, 0.36 * sc, CREAM, x + 0.02, 1.2 * sc, z, false);
            this.part(g, 0.11, 0.14 * sc, 0.14 * sc, RED, x + 0.03, 1.2 * sc, z, false);
        };
        board(-0.6, -2.2, 0.8);
        board(1.8, 0, 1);
        board(4.2, 2.2, 1.2);
        // El blanco que corre: raíl de lado a lado y su carro con la diana
        this.part(g, 0.14, 0.12, 7.2, 0x5a5a56, 2.7, 0.08, 0);
        const slider = new THREE.Group();
        slider.position.set(2.7, 0, 0);
        g.add(slider);
        this.part(slider, 0.5, 0.2, 0.5, DARK, 0, 0.18, 0);
        this.part(slider, 0.08, 0.8, 0.8, CREAM, 0, 0.8, 0);
        for (const sd of [-1, 1]) {
            this.part(slider, 0.09, 0.5, 0.5, RED, sd * 0.01, 0.8, 0, false);
            this.part(slider, 0.1, 0.18, 0.18, CREAM, sd * 0.02, 0.8, 0, false);
        }
        keep.push(slider);
        // Siluetas de alien que se levantan y se tumban (cabeza grande, ojos negros)
        const pops = [[0.6, -1.1], [3.6, 1.1], [0.9, 2.9]].map(([x, z], i) => {
            const p = new THREE.Group();
            p.position.set(x, 0, z);
            g.add(p);
            this.part(p, 0.08, 0.7, 0.4, 0x7dff4a, 0, 0.35, 0);
            this.part(p, 0.09, 0.5, 0.6, 0x7dff4a, 0, 0.9, 0);
            for (const s of [-1, 1]) this.part(p, 0.1, 0.14, 0.14, INK, -0.01, 0.95, s * 0.14, false);
            this.part(g, 0.3, 0.1, 0.5, DARK, x, 0.05, z, false);
            keep.push(p);
            return p;
        });
        this.range = { slider, pops };
        // El talud del fondo: tierra con neumáticos apilados delante
        this.part(g, 1.2, 1.4, 7.4, BERM, 5.6, 0.7, 0);
        this.part(g, 0.9, 0.4, 7.0, 0x6a8a3a, 5.6, 1.5, 0);
        for (let k = 0; k < 7; k++) for (let h = 0; h < 2; h++) {
            this.part(g, 0.5, 0.22, 0.5, 0x2e2a28, 4.85, 0.11 + h * 0.23, -3 + k * 1.0 + h * 0.02);
            this.part(g, 0.26, 0.23, 0.26, 0x5a4a3a, 4.85, 0.115 + h * 0.23, -3 + k * 1.0 + h * 0.02, false);
        }
        // Banderolas de viento y un cartel
        this.flag(g, 5.6, -3.9, YELLOW, 3.2);
        this.flag(g, 5.6, 3.9, YELLOW, 3.2);
        this.part(g, 0.1, 1.3, 0.1, DARK, -2.4, 0.65, 3.9, false);
        this.part(g, 1.5, 0.55, 0.06, YELLOW, -2.4, 1.35, 3.95);
        for (let i = 0; i < 5; i++) this.part(g, 0.14, 0.24, 0.03, INK, -2.9 + i * 0.25, 1.35, 3.99, false);
    }

    // Hangar en arco, abierto hacia la pista (+x), con su foco y bidones
    hangar(g) {
        [[4.4, 0.9, 0x7a8a6a], [3.8, 1.7, 0x6a7a5a], [3.0, 2.4, 0x7a8a6a], [1.8, 2.9, 0x6a7a5a]].forEach(([d, y, c], i) => {
            this.part(g, 6.4 - (i % 2) * 0.06, i ? 0.6 : 1.8, d, c, 0, i ? y : 0.9, 0).rotation.y = Math.PI / 2; // (de largo alterno: sin caras en el mismo plano)
        });
        this.part(g, 0.08, 2.0, 3.2, 0x2a2a1e, 2.2, 1.0, 0, false);
        this.part(g, 0.5, 0.4, 0.5, 0x3a3a3a, 2.3, 3.0, -1.6);
        this.part(g, 0.06, 0.3, 0.36, 0xfff6c0, 2.56, 3.0, -1.6, false);
        for (const [x, z] of [[-1.0, 2.6], [-0.5, 2.7], [-0.8, 3.1]]) this.drum(g, x, z);
        this.crate(g, 1.0, 0, 2.8);
        // Delante, el carro de herramientas rojo y una escalera de mantenimiento; detrás, el
        // camión cisterna aparcado
        this.part(g, 0.6, 0.6, 0.4, RED, 3.0, 0.4, 1.6);
        this.part(g, 0.62, 0.06, 0.42, INK, 3.0, 0.5, 1.6, false);
        for (let k = 0; k < 4; k++) this.part(g, 0.5, 0.06, 0.2, YELLOW, 3.2, 0.25 + k * 0.32, -2.2 - k * 0.12, false);
        this.part(g, 0.08, 1.4, 0.08, YELLOW, 2.95, 0.7, -2.4, false);
        this.part(g, 0.08, 1.4, 0.08, YELLOW, 3.45, 0.7, -2.4, false);
        this.part(g, 1.2, 1.0, 1.0, OLIVE, -1.5, 0.75, -3.4);
        this.part(g, 2.4, 0.9, 1.0, 0xc8c8c0, 0.4, 0.75, -3.4);
        this.part(g, 0.6, 0.4, 0.06, GLASS, -2.12, 1.0, -3.4, false);
        for (const x of [-1.5, 0, 1.2]) for (const z of [-3.95, -2.85]) this.part(g, 0.36, 0.36, 0.2, 0x2e2a28, x, 0.2, z, false);
    }

    // El avión de la racha del bombardero, aparcado en la pista: fuselaje, alas, cola, cuatro
    // hélices, la cabina y sus ruedas; con calzos y una escalerilla
    plane(g, keep) {
        const P = new THREE.Group();
        P.position.y = 0.55;
        g.add(P);
        this.part(P, 6.4, 0.9, 0.95, 0x6a7a5a, 0, 0.6, 0);            // fuselaje
        this.part(P, 0.9, 0.7, 0.8, 0x5a6a4a, -3.5, 0.62, 0);          // morro
        this.part(P, 0.7, 0.4, 0.7, GLASS, -2.7, 1.12, 0);             // cabina
        this.part(P, 1.4, 0.12, 7.6, 0x5a6a4a, 0.2, 0.75, 0);          // alas
        for (const z of [-2.6, -1.3, 1.3, 2.6]) {
            this.part(P, 0.9, 0.36, 0.36, 0x4a5a3a, -0.45, 0.62, z);   // motores
            const prop = new THREE.Group();
            prop.position.set(-0.95, 0.62, z);
            P.add(prop);
            this.part(prop, 0.04, 0.9, 0.12, 0x2a2a2a, 0, 0, 0, false);
            this.part(prop, 0.04, 0.12, 0.9, 0x2a2a2a, 0, 0, 0, false);
            this.spin.push([prop, 0, 'x']);
            keep.push(prop);
        }
        this.part(P, 0.9, 0.1, 2.6, 0x5a6a4a, 3.0, 0.75, 0);            // cola
        this.part(P, 0.9, 1.1, 0.1, 0x5a6a4a, 3.0, 1.3, 0);
        this.part(P, 0.5, 0.5, 0.05, 0xfff3d6, 0.8, 0.75, 0.5, false);  // la estrella
        this.part(P, 0.26, 0.26, 0.06, RED, 0.8, 0.75, 0.52, false);
        for (const [x, z] of [[-0.3, -1.1], [-0.3, 1.1], [3.1, 0]]) {
            this.part(P, 0.08, 0.5, 0.08, DARK, x, 0.0, z, false);
            this.part(P, 0.3, 0.3, 0.16, 0x2e2a28, x, -0.35, z);
        }
        // Calzos y escalerilla
        for (const z of [-1.1, 1.1]) this.part(g, 0.2, 0.15, 0.4, YELLOW, -0.65, 0.08, z, false);
        this.part(g, 0.6, 1.0, 0.4, 0x8a8a8a, -2.6, 0.5, 0.9);
    }

    // Control a la salida: sacos a los dos lados del camino, barrera y banderas
    checkpoint(g) {
        this.sandbags(g, -2.4, 0, 4, 2, 'z');
        this.sandbags(g, 2.4, 0, 4, 2, 'z');
        this.part(g, 0.2, 1.0, 0.2, DARK, -1.6, 0.5, -0.6, false);
        this.part(g, 3.0, 0.14, 0.14, RED, -0.2, 1.0, -0.6, false);
        for (let k = 0; k < 4; k++) this.part(g, 0.3, 0.16, 0.16, CREAM, -1.2 + k * 0.7, 1.0, -0.6, false);
        this.flag(g, -3.1, 0.9, OLIVE);
        this.flag(g, 3.1, 0.9, RED);
        this.lamp(g, 2.9, -1.0);
        // La garita del guardia (con ventana y tejadillo), conos y bandas de pinchos
        this.part(g, 1.1, 1.5, 1.1, CONC, -3.6, 0.75, -1.4);
        this.part(g, 1.3, 0.14, 1.3, OLIVE2, -3.6, 1.57, -1.4);
        this.part(g, 0.7, 0.4, 0.06, GLASS, -3.6, 1.1, -0.83, false);
        for (const x of [-0.9, 0.5]) this.part(g, 0.24, 0.42, 0.24, 0xff7a2a, x, 0.21, 0.6);
        this.part(g, 2.4, 0.06, 0.24, 0x5a5a56, -0.2, 0.03, 1.4, false);
        for (let k = 0; k < 6; k++) this.part(g, 0.08, 0.12, 0.08, 0xb8b8b4, -1.2 + k * 0.4, 0.1, 1.4, false);
    }

    // Un almacén al aire libre: cajas apiladas, bidones y una lona
    depot(g) {
        for (const [x, z, y, ry] of [[0, 0, 0, 0], [0.7, 0, 0, 0], [0.35, 0, 0.42, 0.2], [-0.8, 0.6, 0, 0.4], [1.2, 0.8, 0, -0.2]]) this.crate(g, x, y, z, ry);
        for (const [x, z] of [[-1.2, -0.6], [-0.7, -0.8], [-1.0, -1.2]]) this.drum(g, x, z);
        this.drum(g, 1.6, -0.4, OLIVE, true);
        // El contenedor de carga (con sus nervios) y la lona sobre un montón
        this.part(g, 1.4, 1.3, 3.0, 0x8a4a2a, -2.4, 0.65, 0.6);
        for (let k = 0; k < 5; k++) this.part(g, 1.44, 1.2, 0.08, 0x7a3a22, -2.4, 0.65, -0.6 + k * 0.6, false);
        this.part(g, 0.06, 1.0, 0.9, 0x6a3018, -1.68, 0.6, 1.4, false);
        this.part(g, 1.8, 0.1, 1.4, OLIVE2, 0.35, 0.95, 0.1, false).rotation.z = 0.08;
    }

    // La torre de control del aeródromo: base de hormigón, cabina de cristal con su balcón, la
    // baliza que gira y la manga de viento
    tower(g, keep) {
        this.part(g, 1.8, 3.0, 1.8, CONC, 0, 1.5, 0);
        for (let k = 0; k < 3; k++) this.part(g, 1.84, 0.1, 1.84, CONC2, 0, 0.8 + k * 0.8, 0, false);
        this.part(g, 0.6, 1.0, 0.06, 0x3a3a34, 0, 0.5, 0.92, false);
        this.part(g, 2.6, 0.16, 2.6, CONC2, 0, 3.1, 0);
        this.part(g, 2.2, 1.0, 2.2, GLASS, 0, 3.7, 0);
        for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) this.part(g, 0.12, 1.0, 0.12, DARK, x, 3.7, z, false);
        this.part(g, 2.5, 0.2, 2.5, OLIVE2, 0, 4.3, 0);
        for (const s of [-1, 1]) this.part(g, 2.7, 0.06, 0.06, DARK, 0, 3.6, s * 1.3, false), this.part(g, 0.06, 0.06, 2.7, DARK, s * 1.3, 3.6, 0, false);
        const bea = new THREE.Group();
        bea.position.set(0, 4.6, 0);
        g.add(bea);
        this.part(bea, 0.3, 0.3, 0.3, 0xffcc33, 0, 0, 0);
        this.part(bea, 0.9, 0.08, 0.14, 0xfff0a0, 0.45, 0, 0, false);
        this.spin.push([bea, 3]);
        keep.push(bea);
        this.part(g, 0.08, 2.6, 0.08, DARK, 1.6, 1.3, 1.6, false);
        for (let k = 0; k < 3; k++) this.part(g, 0.4 - k * 0.07, 0.3 - k * 0.05, 0.3 - k * 0.05, k % 2 ? CREAM : 0xff7a2a, 1.82 + k * 0.36, 2.4, 1.6, false);
    }

    // El parque móvil: un tejadillo de chapa sobre postes, el jeep y el camión con su lona,
    // bidones y un surtidor
    motorpool(g) {
        for (const [x, z] of [[-2.6, -1.4], [2.6, -1.4], [-2.6, 1.4], [2.6, 1.4]]) this.part(g, 0.14, 2.0, 0.14, DARK, x, 1.0, z, false);
        this.part(g, 5.6, 0.12, 3.2, 0x8a9a8a, 0, 2.05, 0);
        this.part(g, 5.7, 0.06, 0.2, 0x6a7a6a, 0, 2.14, -1.4, false);
        // Jeep
        this.part(g, 1.0, 0.5, 1.8, OLIVE, -1.3, 0.55, 0);
        this.part(g, 0.9, 0.3, 0.7, OLIVE2, -1.3, 0.95, 0.3);
        this.part(g, 0.8, 0.3, 0.06, GLASS, -1.3, 0.95, -0.1, false);
        for (const x of [-1.85, -0.75]) for (const z of [-0.6, 0.6]) this.part(g, 0.2, 0.4, 0.4, 0x2e2a28, x, 0.2, z, false);
        // Camión con lona
        this.part(g, 1.3, 1.0, 1.0, OLIVE, 1.3, 0.8, -0.9);
        this.part(g, 1.3, 0.3, 0.06, GLASS, 1.3, 1.05, -1.42, false);
        this.part(g, 1.4, 1.2, 2.0, 0x6a7a4a, 1.3, 1.1, 0.6);
        this.part(g, 1.44, 0.16, 2.04, 0x5a6a3a, 1.3, 1.75, 0.6, false);
        for (const x of [0.6, 2.0]) for (const z of [-0.9, 0.3, 1.2]) this.part(g, 0.22, 0.46, 0.46, 0x2e2a28, x, 0.23, z, false);
        for (const [x, z] of [[-3.2, -0.4], [-3.2, 0.2]]) this.drum(g, x, z, OLIVE);
        this.part(g, 0.4, 1.0, 0.4, RED, 3.3, 0.5, 1.6);
        this.part(g, 0.3, 0.2, 0.06, CREAM, 3.3, 0.8, 1.81, false);
    }

    // Los depósitos de combustible: dos tanques cilíndricos (a bloques) sobre sus cunas, con
    // escalerilla, tuberías y el cartel de no fumar
    fuel(g) {
        for (const [x, c] of [[-1.3, 0xd8dcd4], [1.3, 0xc8ccc4]]) {
            for (const z of [-1.0, 1.0]) this.part(g, 1.4, 0.4, 0.3, CONC2, x, 0.2, z, false);
            this.part(g, 1.8, 1.6, 2.8, c, x, 1.2, 0);
            this.part(g, 1.4, 1.9, 2.82, c, x, 1.2, 0);
            this.part(g, 1.84, 0.12, 0.12, RED, x, 1.6, 1.42, false);
            this.part(g, 0.6, 0.06, 0.6, 0x9a9a96, x, 2.18, 0, false);
        }
        for (let k = 0; k < 5; k++) this.part(g, 0.4, 0.05, 0.12, YELLOW, -0.1, 0.3 + k * 0.4, -1.5, false);
        this.part(g, 2.8, 0.12, 0.12, 0x6a6a66, 0, 0.3, 1.7, false);
        this.part(g, 0.1, 1.0, 0.1, DARK, 2.6, 0.5, 1.9, false);
        this.part(g, 0.6, 0.6, 0.05, CREAM, 2.6, 1.15, 1.93);
        this.part(g, 0.5, 0.08, 0.06, RED, 2.6, 1.15, 1.96, false).rotation.z = 0.7;
    }

    // El barracón: una nave larga de madera con tejado de chapa, escalones, ventanas, el mástil
    // con la bandera y un banco
    barracks(g) {
        this.part(g, 4.6, 0.3, 2.2, CONC2, 0, 0.15, 0);
        this.part(g, 4.4, 1.3, 2.0, 0x6a5a3a, 0, 0.95, 0);
        for (let i = 0; i < 3; i++) this.part(g, 4.7, 0.2, 2.3 - i * 0.7, i % 2 ? 0x7a8a7a : 0x8a9a8a, 0, 1.7 + i * 0.2, 0);
        for (const x of [-1.5, -0.5, 1.5]) this.part(g, 0.5, 0.4, 0.06, GLASS, x, 1.1, 1.02, false);
        this.part(g, 0.6, 0.9, 0.06, 0x3a2a1a, 0.5, 0.75, 1.02, false);
        this.part(g, 0.9, 0.2, 0.4, CONC, 0.5, 0.1, 1.3);
        this.part(g, 0.08, 3.6, 0.08, 0xd8d8d8, -2.8, 1.8, 1.4, false);
        this.part(g, 1.0, 0.6, 0.04, RED, -2.3, 3.2, 1.4, false);
        this.part(g, 0.4, 0.3, 0.05, CREAM, -2.5, 3.3, 1.42, false);
        this.part(g, 1.2, 0.1, 0.3, 0x7a4f2a, 1.6, 0.4, 1.5);
    }

    update(dt, time) {
        for (const [g, v, ax] of this.spin) {
            if (ax === 'x') g.rotation.x = time * 9 + g.position.z; // (las hélices, al ralentí)
            else g.rotation.y = time * v;
        }
        this.blink.forEach((l, i) => (l.visible = Math.sin(time * 4 + i * 1.7) > 0));
        // El campo de tiro: el blanco corre por su raíl y las siluetas se levantan y se tumban (a saltos)
        if (this.range) {
            this.range.slider.position.z = Math.sin(time * 0.9) * 3.1;
            this.range.pops.forEach((p, i) => (p.rotation.z = Math.sin(time * 1.3 + i * 2.1) > 0.2 ? 0 : Math.PI / 2 - 0.1));
        }
        this.updateFx(dt);
    }
}
