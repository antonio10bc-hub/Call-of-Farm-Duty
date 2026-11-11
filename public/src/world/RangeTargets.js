import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from '../render/materials.js';

// El campo de tiro de pruebas: dianas de verdad, sin cultivos. Se dispara de pie desde la línea
// de tiro (un mostrador de sacos bajo un tejadillo, en el lado oeste del campo) hacia el este.
// Clases de blanco (kind):
//   board  diana fija sobre dos patas (cerca, medio y lejos)
//   slide  diana que corre de lado a lado por su raíl
//   pop    silueta de alien que se levanta y se tumba (solo se le puede dar levantada)
//   plate  placa de acero: aguanta 3 tiros (como las calabazas)
// Al darle, la diana cae hacia atrás. mode: 'mix' (de todo), 'fixed', 'moving', 'popup', 'steel'.
export const RANGE_FX = { burst: [0xfff3d6, 0xe8402e, 0x8a5a2a], chaff: [0xd8c08a, 0xfff3d6] };
// La línea de tiro: dónde se pone el tirador (de pie: ojo a 1.6 m) y hacia dónde mira
export const RANGE_SPOTS = [{ x: -4.5, z: 3 }, { x: -4.5, z: 6.5 }, { x: -4.5, z: 10 }];
export const RANGE_EYE = 1.6;
const CREAM = 0xfff3d6, RED = 0xe8402e, WOOD = 0x8a5a2a, STEEL = 0x8a929a, ALIEN = 0x7dff4a, INK = 0x2a1a0e;

const LAYOUT = {
    board: [[4, 4.2, 1.1], [9, 9.5, 1], [14, 2.6, 0.9], [19, 7, 0.8], [6.5, 11.5, 1], [16.5, 12.5, 0.85]],
    slide: [[11, 1.5, 11.5, 1.7], [17.5, 2.5, 12.5, 2.6], [7.5, 2, 8, 1.2]], // x, z desde, z hasta, velocidad
    pop: [[7, 7, 0], [12.5, 5.5, 1.3], [18, 10.5, 2.6], [21, 3.5, 0.8], [10, 12, 2]], // x, z, fase
    plate: [[5.5, 1.5], [15, 10], [20.5, 5.5]],
};
const MODES = { mix: ['board', 'slide', 'pop', 'plate'], fixed: ['board'], moving: ['slide'], popup: ['pop'], steel: ['plate'] };

export class RangeTargets {
    constructor(outlineColor) {
        this.outlineColor = outlineColor;
        this.root = new THREE.Group();
        this.root.visible = false;
        this.list = [];
        this.mats = new Map();
        this.buildLine();
    }

    part(g, w, h, d, c, x, y, z, line = true) {
        if (!this.mats.has(c)) this.mats.set(c, toon(c));
        const m = new THREE.Mesh(box(w, h, d), this.mats.get(c));
        m.position.set(x, y, z);
        g.add(m);
        if (line) {
            const o = new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), this.lineMat || (this.lineMat = outline(this.outlineColor)));
            o.position.copy(m.position);
            g.add(o);
        }
        return m;
    }

    // La línea de tiro: tejadillo, mostrador de sacos por puesto y raíles de las dianas que corren
    buildLine() {
        const g = (this.line = new THREE.Group());
        this.root.add(g);
        const x = RANGE_SPOTS[0].x;
        for (const z of [0.6, 12.4]) for (const dx of [-1.2, 0.6]) this.part(g, 0.18, 3.2, 0.18, WOOD, x + dx, 1.6, z, false);
        this.part(g, 2.4, 0.16, 12.4, 0x4a5a2e, x - 0.3, 3.25, 6.5);
        for (const s of RANGE_SPOTS) {
            for (let k = 0; k < 3; k++) for (let row = 0; row < 3; row++) this.part(g, 0.5, 0.3, 0.55, (k + row) % 2 ? 0xc8b08a : 0xa8906a, s.x + 1.1, 0.15 + row * 0.3, s.z - 0.8 + k * 0.56 + (row % 2) * 0.01);
            this.part(g, 0.7, 0.08, 1.8, WOOD, s.x + 1.1, 0.94, s.z);
        }
        for (const [rx, z0, z1] of LAYOUT.slide) this.part(g, 0.16, 0.12, z1 - z0 + 1, 0x5a5a56, rx + 0.3, 0.06, (z0 + z1) / 2, false);
        // Talud del fondo
        this.part(g, 1.4, 1.6, 15, 0x7a5a3a, 24.5, 0.8, 6.5);
        this.part(g, 1.0, 0.4, 14.6, 0x6a8a3a, 24.5, 1.7, 6.5);
    }

    // Una diana redonda (aros rojos y blancos) mirando hacia la línea de tiro (-x)
    rings(g, r, y) {
        this.part(g, 0.1, r * 2, r * 2, CREAM, 0, y, 0);
        this.part(g, 0.11, r * 1.4, r * 1.4, RED, -0.01, y, 0, false);
        this.part(g, 0.12, r * 0.8, r * 0.8, CREAM, -0.02, y, 0, false);
        this.part(g, 0.13, r * 0.3, r * 0.3, RED, -0.03, y, 0, false);
    }

    make(kind, sz = 1) {
        const g = new THREE.Group(), body = new THREE.Group();
        g.add(body);
        if (kind === 'board' || kind === 'slide') {
            const r = 0.55 * sz, top = kind === 'slide' ? 1.0 : 1.3 * sz;
            for (const s of [-1, 1]) this.part(body, 0.1, top, 0.1, WOOD, 0.08, top / 2, s * r * 0.7, false);
            if (kind === 'slide') this.part(body, 0.5, 0.2, 0.6, 0x3a3a36, 0.1, 0.12, 0);
            this.rings(body, r, top + r * 0.8);
            return { obj: g, body, hb: [0.3, r, r], cy: top + r * 0.8 };
        }
        if (kind === 'pop') {
            this.part(body, 0.08, 0.9, 0.5, ALIEN, 0, 0.45, 0);
            this.part(body, 0.09, 0.6, 0.75, ALIEN, 0, 1.2, 0);
            for (const s of [-1, 1]) this.part(body, 0.1, 0.18, 0.18, INK, -0.02, 1.25, s * 0.18, false);
            this.part(g, 0.4, 0.12, 0.7, 0x3a3a36, 0.1, 0.06, 0);
            return { obj: g, body, hb: [0.3, 0.75, 0.42], cy: 0.8 };
        }
        // Placa de acero sobre un poste, con su borde
        this.part(body, 0.14, 1.0, 0.14, 0x3a3a36, 0.1, 0.5, 0, false);
        this.part(body, 0.12, 0.9, 0.9, STEEL, 0, 1.4, 0);
        this.part(body, 0.13, 0.5, 0.5, 0xb8c0c8, -0.01, 1.4, 0, false);
        return { obj: g, body, hb: [0.3, 0.48, 0.48], cy: 1.4 };
    }

    // Pone las dianas de ese modo en targets (los blancos del campo); devuelve cuántas
    spawn(mode, targets) {
        this.clear();
        this.root.visible = true;
        const kinds = MODES[mode] || MODES.mix;
        let i = 0;
        for (const kind of kinds) for (const row of LAYOUT[kind]) {
            const sz = kind === 'board' ? row[2] : 1, m = this.make(kind, sz);
            const [x, z] = kind === 'slide' ? [row[0], (row[1] + row[2]) / 2] : [row[0], row[1]];
            m.obj.position.set(x, 0, z);
            this.root.add(m.obj);
            const s = { kind: `range-${kind}`, range: kind, x, y: m.cy, z, hb: m.hb, cy: m.cy, obj: m.obj, body: m.body, size: m.cy / 0.6, row,
                alive: true, landed: false, grow: -0.4 - i++ * 0.08, flash: 0, dying: 0, fall: 0, up: kind === 'pop' ? 0 : 1, hp: kind === 'plate' ? 3 : 0 };
            this.list.push(s);
            targets.push(s);
        }
        return this.list.length;
    }

    hittable(s) {
        return s.alive && s.landed && (s.range !== 'pop' || s.up > 0.7);
    }

    hitBox(s) {
        const [hx, hy, hz] = s.hb;
        return [s.x - hx, s.y - hy, s.z - hz, s.x + hx, s.y + hy, s.z + hz];
    }

    update(dt, time) {
        for (const s of this.list) {
            // Brotan del suelo (suben) y, al darles, caen hacia atrás
            const k = s.landed ? 1 : Math.max(0, Math.min(1, s.grow / 0.5));
            if (s.range === 'slide') {
                const [, z0, z1, v] = s.row;
                if (s.alive) s.z = (z0 + z1) / 2 + Math.sin(time * v * 0.5 + s.row[0]) * (z1 - z0) / 2;
                s.obj.position.z = s.z;
            }
            if (s.range === 'pop' && s.alive) {
                // Arriba unos segundos, abajo otros (a saltos, como las de verdad)
                const c = (time * 0.45 + s.row[2]) % 2;
                const target = c < 1.1 ? 1 : 0;
                s.up += Math.sign(target - s.up) * Math.min(Math.abs(target - s.up), dt * 6);
            }
            if (!s.alive) s.fall = Math.min(1, s.fall + dt * 4);
            const lean = s.range === 'pop' ? (1 - s.up) : 0;
            s.body.rotation.z = -(Math.max(lean, s.fall) * (Math.PI / 2 - 0.08)); // (hacia atrás: lejos de la línea)
            s.body.scale.y = Math.max(0.001, k);
            s.flash = Math.max(0, s.flash - dt * 6);
            s.y = s.cy * (1 - s.fall);
        }
    }

    clear() {
        for (const s of this.list) this.root.remove(s.obj);
        this.list.length = 0;
    }

    hide() {
        this.clear();
        this.root.visible = false;
    }
}
