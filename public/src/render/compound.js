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

    // Una pieza del recinto (kind: nuke, armory, radar, heli, camp, hangar, plane, checkpoint, depot)
    piece(kind) {
        const g = new THREE.Group(), keep = [];
        this[kind](g, keep);
        this.root.add(g);
        this.bake([g], keep);
        return g;
    }

    sandbags(g, x, z, n, rows = 2, along = 'x') {
        for (let row = 0; row < rows; row++) for (let k = 0; k < n - row; k++) {
            const o = (k - (n - row - 1) / 2) * 0.48, ax = along === 'x';
            this.part(g, ax ? 0.5 : 0.34, 0.26, ax ? 0.34 : 0.5, (k + row) % 2 ? SAND : SAND2, x + (ax ? o : 0), 0.13 + row * 0.26, z + (ax ? 0 : o));
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

    // La bomba nuclear de la racha de 10: tumbada en su remolque, sobre la plataforma con franjas
    // de peligro, con su valla, el cartel de radiación y dos focos
    nuke(g, keep) {
        // Remolque: plataforma, ruedas y lanza
        this.part(g, 3.2, 0.2, 1.4, OLIVE2, 0, 0.6, 0);
        for (const x of [-1.1, 1.1]) for (const z of [-0.75, 0.75]) this.part(g, 0.55, 0.55, 0.24, 0x2e2a28, x, 0.28, z);
        this.part(g, 1.2, 0.12, 0.12, DARK, -2.1, 0.5, 0, false);
        // La bomba: cuerpo panzudo, morro redondeado, aletas y la franja amarilla
        this.part(g, 2.6, 1.0, 1.0, 0x6a7a5a, 0, 1.25, 0);
        this.part(g, 2.2, 1.2, 0.8, 0x6a7a5a, 0, 1.25, 0);
        this.part(g, 0.5, 0.8, 0.8, 0x5a6a4a, 1.5, 1.25, 0);
        this.part(g, 0.3, 0.5, 0.5, 0x5a6a4a, 1.85, 1.25, 0);
        this.part(g, 0.24, 1.08, 1.08, YELLOW, 0.4, 1.25, 0, false);
        for (const [y, z, w, h] of [[1.25, 0, 0.5, 1.7], [1.25, 0, 0.5, 0.12]]) this.part(g, w, h, 0.12, 0x4a5a3a, -1.5, y, z);
        this.part(g, 0.5, 0.12, 1.7, 0x4a5a3a, -1.5, 1.25, 0);
        // Símbolo de radiación (en el lado que mira a la cámara)
        this.part(g, 0.6, 0.6, 0.04, YELLOW, -0.3, 1.25, 0.52, false);
        this.part(g, 0.16, 0.16, 0.05, INK, -0.3, 1.25, 0.54, false);
        for (const [dx, dy] of [[0, 0.18], [-0.16, -0.1], [0.16, -0.1]]) this.part(g, 0.14, 0.12, 0.05, INK, -0.3 + dx, 1.25 + dy, 0.54, false);
        // Valla baja alrededor (postes y barra) y el cartel
        for (let k = 0; k < 10; k++) {
            const a = (k / 10) * Math.PI * 2, x = Math.cos(a) * 3.0, z = Math.sin(a) * 2.4;
            this.part(g, 0.1, 0.8, 0.1, YELLOW, x, 0.4, z, false);
            this.part(g, 0.12, 0.12, 0.12, INK, x, 0.85, z, false);
        }
        this.part(g, 0.1, 1.4, 0.1, DARK, 2.6, 0.7, 2.0, false);
        this.part(g, 0.9, 0.7, 0.06, YELLOW, 2.6, 1.4, 2.0);
        this.part(g, 0.3, 0.3, 0.07, INK, 2.6, 1.4, 2.03, false);
        // Luz roja de alarma que parpadea
        const l = this.part(g, 0.2, 0.2, 0.2, 0xff2a1a, -2.6, 1.6, -1.9);
        this.part(g, 0.08, 1.5, 0.08, DARK, -2.6, 0.75, -1.9, false);
        this.blink.push(l);
        keep.push(l);
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
    }

    // El campamento: dos tiendas, el antiaéreo entre sacos, un depósito de agua y farolas (cada
    // cosa con su sitio, sin pisarse)
    camp(g) {
        const tent = (x, z, ry) => {
            const t = new THREE.Group();
            t.position.set(x, 0, z);
            t.rotation.y = ry;
            g.add(t);
            this.part(t, 3.0, 1.0, 2.4, OLIVE, 0, 0.5, 0);
            [[3.1, 1.2], [2.0, 1.5], [0.9, 1.8]].forEach(([w, y]) => this.part(t, w, 0.32, 2.5, OLIVE2, 0, y, 0));
            this.part(t, 0.7, 0.8, 0.06, 0x2a2a1e, 0, 0.4, 1.22, false);
        };
        tent(-2.3, -2.0, 0.1);
        tent(2.0, -2.6, -0.2);
        // Antiaéreo
        for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2;
            this.part(g, 0.5, 0.3, 0.32, k % 2 ? SAND : SAND2, 2.2 + Math.sin(a) * 0.95, 0.15, 2.0 + Math.cos(a) * 0.95).rotation.y = a;
        }
        this.part(g, 0.7, 0.4, 0.7, 0x5a5a56, 2.2, 0.4, 2.0);
        for (const s of [-0.15, 0.15]) this.part(g, 0.08, 0.08, 1.3, DARK, 2.2 + s, 0.85, 1.55, false).rotation.x = 0.6;
        // Depósito de agua en alto
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(g, 0.12, 2.4, 0.12, 0x6a4a2a, -2.8 + sx * 0.6, 1.2, 2.2 + sz * 0.6, false);
        this.part(g, 1.5, 1.1, 1.5, 0x8a9aa0, -2.8, 3.0, 2.2);
        this.part(g, 1.1, 0.25, 1.1, 0x6a7a80, -2.8, 3.66, 2.2);
        this.lamp(g, -0.2, 3.0);
        this.drum(g, -0.6, 0.6);
        this.drum(g, -0.1, 0.95, OLIVE, true);
    }

    // Hangar en arco, abierto hacia la pista (+x), con su foco y bidones
    hangar(g) {
        [[4.4, 0.9, 0x7a8a6a], [3.8, 1.7, 0x6a7a5a], [3.0, 2.4, 0x7a8a6a], [1.8, 2.9, 0x6a7a5a]].forEach(([d, y, c], i) => {
            this.part(g, 6.4, i ? 0.6 : 1.8, d, c, 0, i ? y : 0.9, 0).rotation.y = Math.PI / 2;
        });
        this.part(g, 0.08, 2.0, 3.2, 0x2a2a1e, 2.2, 1.0, 0, false);
        this.part(g, 0.5, 0.4, 0.5, 0x3a3a3a, 2.3, 3.0, -1.6);
        this.part(g, 0.06, 0.3, 0.36, 0xfff6c0, 2.56, 3.0, -1.6, false);
        for (const [x, z] of [[-1.0, 2.6], [-0.5, 2.7], [-0.8, 3.1]]) this.drum(g, x, z);
        this.crate(g, 1.0, 0, 2.8);
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
    }

    // Un almacén al aire libre: cajas apiladas, bidones y una lona
    depot(g) {
        for (const [x, z, y, ry] of [[0, 0, 0, 0], [0.7, 0, 0, 0], [0.35, 0, 0.42, 0.2], [-0.8, 0.6, 0, 0.4], [1.2, 0.8, 0, -0.2]]) this.crate(g, x, y, z, ry);
        for (const [x, z] of [[-1.2, -0.6], [-0.7, -0.8], [-1.0, -1.2]]) this.drum(g, x, z);
        this.drum(g, 1.6, -0.4, OLIVE, true);
        this.part(g, 1.8, 0.1, 1.4, OLIVE2, 0.35, 0.95, 0.1, false).rotation.z = 0.08;
    }

    update(dt, time) {
        for (const [g, v, ax] of this.spin) {
            if (ax === 'x') g.rotation.x = time * 9 + g.position.z; // (las hélices, al ralentí)
            else g.rotation.y = time * v;
        }
        this.blink.forEach((l, i) => (l.visible = Math.sin(time * 4 + i * 1.7) > 0));
        this.updateFx(dt);
    }
}
