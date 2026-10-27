import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

// Edificios de la granja, todos con cubos y proporciones de verdad (sin caras ni muecas).
// Medidas en casillas (1 casilla ≈ 1 metro y poco). El frente mira hacia +z.

// Octógono a base de dos cajas iguales, una girada 45°: el "cilindro" voxel
function octo(m, parent, size, h, color, x, y, z, outlined = true) {
    const s = size * 0.85;
    m.part(parent, s, h, s, color, x, y, z, outlined);
    const b = m.part(parent, s, h, s, color, x, y, z, outlined);
    b.rotation.y = Math.PI / 4;
    return b;
}

export class Barn extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const R = 0xc8402e, R2 = 0xa83224, TRIM = 0xfff3e0, ROOF = 0x5a4a44, ROOF2 = 0x4a3c38, STONE = 0x9a948c;
        const W = 4.4, H = 2.4, D = 3.4, b = this.root;
        this.part(b, W + 0.2, 0.3, D + 0.2, STONE, 0, 0.15, 0);
        this.part(b, W, H, D, R, 0, 0.3 + H / 2, 0);
        // Tablones verticales en el frente y los lados
        for (let x = -W / 2 + 0.3; x < W / 2; x += 0.42) this.part(b, 0.06, H, 0.02, R2, x, 0.3 + H / 2, D / 2 + 0.01, false);
        for (let z = -D / 2 + 0.3; z < D / 2; z += 0.42) for (const s of [-1, 1]) this.part(b, 0.02, H, 0.06, R2, s * (W / 2 + 0.01), 0.3 + H / 2, z, false);
        // Esquinas blancas
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(b, 0.16, H, 0.16, TRIM, sx * (W / 2 - 0.04), 0.3 + H / 2, sz * (D / 2 - 0.04), false);
        // Tejado holandés (dos pendientes) a escalones, con el hastial rojo delante y detrás
        const steps = [W + 0.5, W + 0.3, W - 0.2, W - 0.9, W - 1.8, W - 2.8, W - 3.6];
        const top = 0.3 + H;
        steps.forEach((w, i) => {
            const y = top + 0.16 + i * 0.3;
            this.part(b, w, 0.3, D + 0.36, i % 2 ? ROOF2 : ROOF, 0, y, 0);
            if (w > 0.8) for (const s of [-1, 1]) this.part(b, w - 0.46, 0.3, 0.04, R, 0, y, s * (D / 2 + 0.2), false);
        });
        // Portón con su X blanca
        const door = new THREE.Group();
        door.position.set(0, 0.3, D / 2 + 0.02);
        b.add(door);
        this.part(door, 1.9, 1.75, 0.1, TRIM, 0, 0.88, 0.02);
        this.part(door, 1.66, 1.55, 0.08, R2, 0, 0.82, 0.06, false);
        for (const s of [-1, 1]) this.part(door, 2.0, 0.12, 0.05, TRIM, 0, 0.82, 0.11, false).rotation.z = s * 0.75;
        this.part(door, 0.06, 1.55, 0.06, TRIM, 0, 0.82, 0.11, false);
        // El granero es el cuartel de las rachas de bajas: en el hastial, una diana como la del
        // logo (anillos rojo y crema) en lugar de la ventana del pajar
        [[1.15, TRIM], [0.9, R], [0.62, TRIM], [0.34, R]].forEach(([s, c], i) => this.part(b, s, s, 0.06, c, 0, top + 0.78, D / 2 + 0.24 + i * 0.02, i === 0));
        // Ventanas laterales
        for (const s of [-1, 1]) for (const z of [-0.8, 0.8]) {
            this.part(b, 0.06, 0.6, 0.6, TRIM, s * (W / 2 + 0.03), 1.75, z, false);
            this.part(b, 0.07, 0.44, 0.44, 0x3a2414, s * (W / 2 + 0.04), 1.75, z, false);
        }
        // Veleta
        this.vane = new THREE.Group();
        this.vane.position.set(0, top + 0.16 + steps.length * 0.3, 0);
        b.add(this.vane);
        this.part(this.vane, 0.05, 0.6, 0.05, 0x3a3030, 0, 0.3, 0, false);
        this.part(this.vane, 0.5, 0.05, 0.05, 0x3a3030, 0, 0.5, 0, false);
        this.part(this.vane, 0.3, 0.2, 0.04, 0x3a3030, 0.1, 0.72, 0, false);
        this.part(this.vane, 0.12, 0.12, 0.04, 0x3a3030, -0.16, 0.72, 0, false);
        // Sacos terreros a los lados del portón
        const SAND = 0xc8b08a, SAND2 = 0xa8906a;
        for (const s of [-1, 1]) for (let row = 0; row < 2; row++) for (let k = 0; k < 3 - row; k++) {
            this.part(b, 0.5, 0.26, 0.34, (k + row) % 2 ? SAND : SAND2, s * (1.45 + k * 0.48 + row * 0.24), 0.13 + row * 0.26, D / 2 + 0.55);
        }
        // Cajas de munición (verde militar con franja amarilla)
        const AMMO = 0x5a6a3a;
        for (const [x, z, y] of [[-2.75, 0.9, 0], [-2.75, 0.2, 0], [-2.75, 0.55, 0.42], [2.7, 1.1, 0]]) {
            this.part(b, 0.62, 0.42, 0.55, AMMO, x, 0.21 + y, z);
            this.part(b, 0.64, 0.08, 0.57, 0xffcc33, x, 0.3 + y, z, false);
        }
        // Red de camuflaje sobre el tejado
        [[-1.2, 2, 0x5a6a3a], [0.9, 2, 0x6a5a3a], [-0.2, 3, 0x4a5a2e], [1.1, 1, 0x4a5a2e], [-1.6, 1, 0x6a5a3a]].forEach(([x, i, c]) => {
            this.part(b, 1.0, 0.08, D * 0.7, c, x, top + 0.33 + i * 0.3, 0, false);
        });
        // Antena de radio con su luz roja que parpadea
        this.part(b, 0.06, 2.2, 0.06, 0x3a3030, W / 2 - 0.5, top + 1.1, -D / 2 + 0.5, false);
        this.part(b, 0.4, 0.04, 0.04, 0x3a3030, W / 2 - 0.5, top + 1.9, -D / 2 + 0.5, false);
        this.light = this.part(b, 0.14, 0.14, 0.14, 0xff2a1a, W / 2 - 0.5, top + 2.25, -D / 2 + 0.5);
        this.top = top + 2.6;
    }

    update(dt, time) {
        this.vane.rotation.y = Math.sin(time * 0.4) * 1.2 + time * 0.15;
        this.light.visible = Math.sin(time * 5) > 0;
        this.updateFx(dt);
    }
}

export class Silo extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const C = 0xdfe4ea, BAND = 0xaab4c2, DOME = 0x8e9aaa, b = this.root;
        const H = 4.4;
        octo(this, b, 1.7, H, C, 0, H / 2, 0);
        for (let y = 0.6; y < H; y += 0.9) octo(this, b, 1.78, 0.1, BAND, 0, y, 0, false);
        // Cúpula escalonada
        [1.6, 1.3, 0.9, 0.45].forEach((s, i) => octo(this, b, s, 0.25, DOME, 0, H + 0.12 + i * 0.25, 0));
        // Escalera por el lado que mira a la cámara
        for (const s of [-1, 1]) this.part(b, 0.05, H, 0.05, 0x6a6a72, 0.6 + s * 0.14, H / 2, 0.68, false);
        for (let y = 0.3; y < H; y += 0.3) this.part(b, 0.3, 0.04, 0.04, 0x6a6a72, 0.6, y, 0.68, false);
        this.top = H + 1.2;
    }

    update(dt) {
        this.updateFx(dt);
    }
}

export class House extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const WALL = 0xfff0d8, ROOF = 0x3f6fb0, ROOF2 = 0x355f9a, WOOD = 0x8a5a34, GLASS = 0x9fdcff, b = this.root;
        const W = 3.2, H = 1.9, D = 2.8;
        this.part(b, W + 0.1, 0.2, D + 0.1, 0x9a948c, 0, 0.1, 0);
        this.part(b, W, H, D, WALL, 0, 0.2 + H / 2, 0);
        // Tejado a dos aguas con la cumbrera de lado a lado (escalones hacia delante y detrás)
        const top = 0.2 + H;
        [D + 0.4, D - 0.2, D - 0.9, D - 1.6, D - 2.3].forEach((d, i) => {
            this.part(b, W + 0.4, 0.26, d, i % 2 ? ROOF2 : ROOF, 0, top + 0.13 + i * 0.26, 0);
        });
        // Chimenea
        this.part(b, 0.36, 1.2, 0.36, 0xb0503a, 0.9, top + 0.7, -0.3);
        this.chimney = new THREE.Vector3(0.9, top + 1.35, -0.3);
        // Puerta, ventanas y porche
        this.part(b, 0.6, 1.1, 0.06, WOOD, -0.5, 0.75, D / 2 + 0.03);
        this.part(b, 0.06, 0.06, 0.04, 0xffe03a, -0.32, 0.75, D / 2 + 0.07, false);
        for (const x of [0.75]) {
            this.part(b, 0.7, 0.6, 0.05, 0xffffff, x, 1.25, D / 2 + 0.03);
            this.part(b, 0.56, 0.46, 0.05, GLASS, x, 1.25, D / 2 + 0.05, false);
            this.part(b, 0.8, 0.12, 0.2, 0x7fbf4a, x, 0.9, D / 2 + 0.1, false); // jardinera
        }
        for (const z of [-0.6, 0.6]) {
            this.part(b, 0.05, 0.6, 0.6, 0xffffff, W / 2 + 0.03, 1.25, z);
            this.part(b, 0.05, 0.46, 0.46, GLASS, W / 2 + 0.05, 1.25, z, false);
        }
        this.part(b, 1.2, 0.12, 0.7, WOOD, -0.5, 0.06, D / 2 + 0.35);
        this.top = top + 1.6;
    }

    update(dt) {
        this.updateFx(dt);
    }
}

export class Tower extends VoxelModel {
    // open: sin tejadillo y con los postes a la altura de la barandilla (desde ella se dispara)
    constructor(outlineColor, open = false) {
        super(outlineColor);
        const WOOD = 0x9a6a3a, WOOD2 = 0x7a4f2a, ROOF = 0x8a3a2a, b = this.root;
        const H = 3.2, S = 0.8;
        const post = open ? H + 0.7 : H + 1.1;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(b, 0.18, post, 0.18, WOOD2, sx * S, post / 2, sz * S);
        // Riostras en cruz
        for (const s of [-1, 1]) {
            this.part(b, 2.1, 0.1, 0.08, WOOD, 0, H / 2, s * S, false).rotation.z = 1.0;
            this.part(b, 0.08, 0.1, 2.1, WOOD, s * S, H / 2, 0, false).rotation.x = 1.0;
        }
        this.part(b, 2.0, 0.16, 2.0, WOOD, 0, H, 0);
        // Barandilla
        for (const s of [-1, 1]) {
            this.part(b, 1.9, 0.08, 0.08, WOOD2, 0, H + 0.6, s * S, false);
            this.part(b, 0.08, 0.08, 1.9, WOOD2, s * S, H + 0.6, 0, false);
        }
        // Tejadillo a cuatro aguas
        if (!open) [2.3, 1.7, 1.1, 0.5].forEach((s, i) => this.part(b, s, 0.2, s, ROOF, 0, H + 1.2 + i * 0.2, 0));
        // Escalera
        for (const s of [-1, 1]) this.part(b, 0.06, H, 0.06, WOOD2, s * 0.22, H / 2, S + 0.25, false);
        for (let y = 0.3; y < H; y += 0.32) this.part(b, 0.5, 0.05, 0.05, WOOD2, 0, y, S + 0.25, false);
        this.top = H + 2.2;
    }

    update(dt) {
        this.updateFx(dt);
    }
}

export class Tractor extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const G = 0x3f9a3a, G2 = 0x2f7a2e, TIRE = 0x2a2624, RIM = 0xffcc33, b = this.root;
        // Chasis y capó (el frente mira a +z)
        this.part(b, 0.9, 0.5, 2.0, G, 0, 0.8, 0.1);
        this.part(b, 0.8, 0.45, 1.0, G2, 0, 1.25, 0.55);
        this.part(b, 0.7, 0.3, 0.06, 0x3a3a3a, 0, 1.0, 1.12, false); // rejilla
        // Cabina con cristales
        this.part(b, 1.0, 0.1, 1.0, G, 0, 2.15, -0.45);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(b, 0.07, 1.0, 0.07, G2, sx * 0.45, 1.6, -0.45 + sz * 0.45, false);
        this.part(b, 0.6, 0.2, 0.5, 0x2a2a2a, 0, 1.15, -0.5, false); // asiento
        // Tubo de escape
        this.part(b, 0.08, 0.7, 0.08, 0x5a5a5a, 0.3, 1.8, 0.75, false);
        this.exhaust = new THREE.Vector3(0.3, 2.2, 0.75);
        // Ruedas: grandes detrás, pequeñas delante (dos cajas cruzadas = rueda octogonal)
        for (const [z, r, w] of [[-0.55, 1.15, 0.36], [0.85, 0.65, 0.26]]) {
            for (const s of [-1, 1]) {
                const x = s * (0.45 + w / 2 + 0.02);
                this.part(b, w, r, r * 0.42, TIRE, x, r / 2, z);
                this.part(b, w, r * 0.42, r, TIRE, x, r / 2, z);
                this.part(b, w, r * 0.82, r * 0.82, TIRE, x, r / 2, z).rotation.x = Math.PI / 4;
                this.part(b, w + 0.04, r * 0.36, r * 0.36, RIM, x, r / 2, z, false);
            }
        }
        this.top = 2.6;
    }

    update(dt) {
        this.updateFx(dt);
    }
}

export const STRUCTURES = { barn: Barn, silo: Silo, house: House, tower: Tower, tractor: Tractor };
