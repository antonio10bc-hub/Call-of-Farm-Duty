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
        // Antena de radio con su luz roja que parpadea
        this.part(b, 0.06, 2.2, 0.06, 0x3a3030, W / 2 - 0.5, top + 1.1, -D / 2 + 0.5, false);
        this.part(b, 0.4, 0.04, 0.04, 0x3a3030, W / 2 - 0.5, top + 1.9, -D / 2 + 0.5, false);
        this.light = this.part(b, 0.14, 0.14, 0.14, 0xff2a1a, W / 2 - 0.5, top + 2.25, -D / 2 + 0.5);
        this.top = top + 2.6;

        // Lo que se construye con cada nivel (acumulado), cada vez más lejos del granero: el
        // recinto crece a la vez (FARM.barn). Las posiciones son relativas al granero.
        const OLIVE = 0x5a6a3a, OLIVE2 = 0x4a5a2e, SAND = 0xc8b08a, SAND2 = 0xa8906a, CONC = 0x9a948c, CONC2 = 0x847e76;
        this.levels = [null];
        const level = () => {
            const g = new THREE.Group();
            b.add(g);
            this.levels.push(g);
            return g;
        };
        const sandbags = (g, x, z, n, rows = 2, along = 'x') => {
            for (let row = 0; row < rows; row++) for (let k = 0; k < n - row; k++) {
                const o = (k - (n - row - 1) / 2) * 0.48;
                this.part(g, along === 'x' ? 0.5 : 0.34, 0.26, along === 'x' ? 0.34 : 0.5, (k + row) % 2 ? SAND : SAND2, x + (along === 'x' ? o : 0), 0.13 + row * 0.26, z + (along === 'x' ? 0 : o));
            }
        };
        const crate = (g, x, y, z) => {
            this.part(g, 0.62, 0.42, 0.55, OLIVE, x, 0.21 + y, z);
            this.part(g, 0.64, 0.08, 0.57, 0xffcc33, x, 0.3 + y, z, false);
        };
        // Piezas sueltas que se repiten por el recinto
        const drum = (g, x, z, c = 0xc8402e, lying = false) => {
            const d = this.part(g, 0.45, 0.62, 0.45, c, x, lying ? 0.24 : 0.31, z);
            this.part(d, 0.47, 0.06, 0.47, 0x2a1a0e, 0, 0.18, 0, false);
            if (lying) d.rotation.z = Math.PI / 2;
        };
        const tent = (g, x, z) => {
            this.part(g, 3.0, 1.0, 2.4, OLIVE, x, 0.5, z);
            [[3.1, 1.2], [2.0, 1.5], [0.9, 1.8]].forEach(([w, y]) => this.part(g, w, 0.32, 2.5, OLIVE2, x, y, z));
            this.part(g, 0.7, 0.8, 0.06, 0x2a2a1e, x, 0.4, z + 1.22, false);
        };
        const lamp = (g, x, z) => {
            this.part(g, 0.1, 1.8, 0.1, 0x3a3030, x, 0.9, z, false);
            this.part(g, 0.4, 0.08, 0.1, 0x3a3030, x + 0.15, 1.8, z, false);
            this.part(g, 0.24, 0.2, 0.24, 0xfff0a0, x + 0.3, 1.7, z);
        };
        const flag = (g, x, z, c = 0xc8402e, h = 2.6) => {
            this.part(g, 0.08, h, 0.08, 0x3a3030, x, h / 2, z, false);
            this.part(g, 0.8, 0.5, 0.04, c, x + 0.42, h - 0.3, z, false);
        };
        const legs = (g, x, z, w, h) => {
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(g, 0.12, h, 0.12, 0x6a4a2a, x + sx * w / 2, h / 2, z + sz * w / 2, false);
        };

        // 1: sacos terreros a los lados del portón, cajas de munición, bidones y la bandera
        let g = level();
        for (const s of [-1, 1]) sandbags(g, s * 1.95, D / 2 + 0.55, 3);
        for (const [x, z, y] of [[-2.75, 0.9, 0], [-2.75, 0.2, 0], [-2.75, 0.55, 0.42], [2.7, 1.1, 0]]) crate(g, x, y, z);
        for (const [x, z] of [[6.4, 1.6], [6.9, 1.6], [6.4, 2.1]]) drum(g, x, z);
        drum(g, 7.0, 2.2, OLIVE, true);
        for (const [x, z, y] of [[5.4, -4.9, 0], [6.0, -4.9, 0], [5.7, -4.5, 0.42]]) crate(g, x, y, z);
        flag(g, -3.2, 3.2, OLIVE);
        // 2: red de camuflaje, dos tiendas de campaña, farolas en el camino y un jeep
        g = level();
        [[-1.2, 2, OLIVE], [0.9, 2, 0x6a5a3a], [-0.2, 3, OLIVE2], [1.1, 1, OLIVE2], [-1.6, 1, 0x6a5a3a]].forEach(([x, i, c]) => {
            this.part(g, 1.0, 0.08, D * 0.7, c, x, top + 0.33 + i * 0.3, 0, false);
        });
        tent(g, -5.5, -3);
        tent(g, -8.4, -5.7);
        crate(g, -3.6, 0, -2.2);
        crate(g, -3.6, 0.42, -2.2);
        for (const x of [-1.6, 1.6]) lamp(g, x, -4.5);
        // Jeep: carrocería, capó, parabrisas, ruedas y rueda de repuesto
        this.part(g, 2.0, 0.55, 1.1, OLIVE, 8.4, 0.55, -4.5);
        this.part(g, 0.7, 0.3, 1.0, OLIVE2, 9.05, 0.95, -4.5);
        this.part(g, 0.06, 0.45, 1.0, 0x3a3030, 8.6, 1.05, -4.5, false);
        for (const [x, z] of [[7.75, -5.1], [9.05, -5.1], [7.75, -3.9], [9.05, -3.9]]) this.part(g, 0.45, 0.45, 0.22, 0x2e2a28, x, 0.25, z);
        this.part(g, 0.14, 0.45, 0.45, 0x2e2a28, 7.32, 0.7, -4.5);
        // 3: búnker con troneras y sacos, cañón antiaéreo entre sacos y un puesto de guardia
        g = level();
        this.part(g, 4, 1.3, 3, CONC, 9.5, 0.65, -1.8);
        this.part(g, 4.2, 0.16, 3.2, CONC2, 9.5, 1.38, -1.8);
        for (const x of [8.6, 10.4]) this.part(g, 0.9, 0.18, 0.06, 0x2a2a2a, x, 0.9, -0.29, false);
        sandbags(g, 9.5, -1.8, 6, 1);
        sandbags(g, 9.5, 0.6, 7, 2);
        for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2;
            this.part(g, 0.5, 0.3, 0.32, k % 2 ? SAND : SAND2, -11 + Math.sin(a) * 0.95, 0.15, -7 + Math.cos(a) * 0.95).rotation.y = a;
        }
        this.part(g, 0.7, 0.4, 0.7, 0x5a5a56, -11, 0.4, -7);
        for (const s of [-0.15, 0.15]) this.part(g, 0.08, 0.08, 1.3, 0x3a3a3a, -11 + s, 0.85, -7.45, false).rotation.x = 0.6;
        legs(g, 11, 2.3, 1.4, 1.8);
        this.part(g, 1.7, 0.12, 1.7, 0x9a6a3a, 11, 1.85, 2.3);
        sandbags(g, 11, 3.05, 3, 1);
        this.part(g, 1.9, 0.12, 1.9, OLIVE2, 11, 2.9, 2.3);
        // 4: helipuerto con su helicóptero, radar en el tejado, depósito de agua y mástil de radio
        g = level();
        this.part(g, 4.2, 0.08, 4.2, CONC2, -10, 0.04, -2);
        this.part(g, 3.6, 0.04, 3.6, CONC, -10, 0.1, -2, false);
        for (const x of [-11, -9]) this.part(g, 0.3, 0.05, 2.2, 0xffcc33, x, 0.14, -2, false);
        this.part(g, 2.0, 0.05, 0.3, 0xffcc33, -10, 0.14, -2, false);
        for (const [x, z] of [[-11.9, -3.9], [-8.1, -3.9], [-11.9, -0.1], [-8.1, -0.1]]) this.part(g, 0.16, 0.16, 0.16, 0xff3e1a, x, 0.12, z);
        const heli = new THREE.Group();
        heli.position.set(-10, 0.12, -2);
        heli.rotation.y = 0.5;
        g.add(heli);
        for (const s of [-0.5, 0.5]) this.part(heli, 0.08, 0.08, 2.2, 0x3a3030, s, 0.05, 0, false);
        this.part(heli, 1.1, 0.9, 2.2, OLIVE, 0, 0.75, 0.2);
        this.part(heli, 0.9, 0.6, 0.6, 0x9fdcff, 0, 0.85, 1.4);
        this.part(heli, 0.3, 0.3, 2.2, OLIVE2, 0, 0.95, -1.9);
        this.part(heli, 0.06, 0.6, 0.4, OLIVE2, 0.12, 1.15, -2.9);
        this.part(heli, 0.15, 0.25, 0.15, 0x3a3030, 0, 1.32, 0.2, false);
        this.rotor = new THREE.Group();
        this.rotor.position.set(0, 1.46, 0.2);
        heli.add(this.rotor);
        for (const r of [0, Math.PI / 2]) this.part(this.rotor, 4.2, 0.04, 0.18, 0x2a2a2a, 0, 0, 0, false).rotation.y = r;
        this.radar = new THREE.Group();
        this.radar.position.set(-W / 2 + 0.7, top + 0.5, -D / 2 + 0.6);
        g.add(this.radar);
        this.part(this.radar, 0.1, 0.9, 0.1, 0x3a3030, 0, 0.45, 0, false);
        this.part(this.radar, 1.1, 0.7, 0.1, 0xd8dce2, 0, 1.0, 0.1).rotation.x = -0.4;
        legs(g, -12, 2.6, 1.2, 2.4);
        this.part(g, 1.5, 1.1, 1.5, 0x8a9aa0, -12, 3.0, 2.6);
        this.part(g, 1.1, 0.25, 1.1, 0x6a7a80, -12, 3.66, 2.6);
        this.part(g, 0.14, 4.6, 0.14, 0x3a3030, 12, 2.3, -5, false);
        for (const y of [1.6, 2.8, 3.9]) this.part(g, 0.7 - y * 0.08, 0.05, 0.05, 0x3a3030, 12, y, -5, false);
        this.mast = this.part(g, 0.18, 0.18, 0.18, 0xff2a1a, 12, 4.7, -5);
        // 5: hangar grande en arco con su foco, un tanque, erizos antitanque, banderas en las
        // esquinas y una torre con foco
        g = level();
        [[4.2, 0.9, 0x7a8a6a], [3.6, 1.7, 0x6a7a5a], [2.8, 2.4, 0x7a8a6a], [1.6, 2.9, 0x6a7a5a]].forEach(([d, y, c], i) => {
            this.part(g, 7, i ? 0.6 : 1.8, d, c, 7, i ? y : 0.9, -7.8);
        });
        this.part(g, 2.4, 1.6, 0.08, 0x2a2a1e, 7, 0.8, -5.66, false);
        this.part(g, 0.5, 0.4, 0.5, 0x3a3a3a, 4, 3.4, -5.9);
        this.part(g, 0.36, 0.3, 0.06, 0xfff6c0, 4, 3.4, -5.63, false);
        this.part(g, 2.6, 0.5, 1.6, OLIVE, -4.5, 0.45, -8.4);
        for (const s of [-1, 1]) this.part(g, 2.8, 0.4, 0.36, 0x2e2a28, -4.5, 0.2, -8.4 + s * 0.75);
        this.part(g, 1.3, 0.45, 1.1, OLIVE2, -4.7, 0.92, -8.4);
        this.part(g, 1.6, 0.16, 0.16, 0x3a3a34, -3.4, 0.98, -8.4, false);
        for (let k = 0; k < 5; k++) {
            const x = -13 + k * 1.4;
            for (const r of [0.8, -0.8]) {
                const bar = this.part(g, 0.1, 0.9, 0.1, 0x5a5a56, x, 0.4, -9.3, false);
                bar.rotation.set(0, k, r);
            }
        }
        flag(g, -13.4, -9.4);
        flag(g, 13.4, -9.4);
        flag(g, -13.4, 3.2);
        legs(g, 13.2, 3, 1.0, 2.8);
        this.part(g, 1.2, 0.1, 1.2, 0x9a6a3a, 13.2, 2.85, 3);
        this.part(g, 0.5, 0.4, 0.5, 0x3a3a3a, 13.2, 3.15, 3);
        this.part(g, 0.36, 0.3, 0.06, 0xfff6c0, 13.2, 3.15, 2.73, false);
        this.setLevel(0);
    }

    // Enseña lo construido hasta el nivel n (0 = el granero sin mejorar)
    setLevel(n) {
        this.levels.forEach((g, i) => g && (g.visible = i <= n));
    }

    update(dt, time) {
        this.vane.rotation.y = Math.sin(time * 0.4) * 1.2 + time * 0.15;
        this.light.visible = Math.sin(time * 5) > 0;
        if (this.radar) this.radar.rotation.y = time * 1.4;
        if (this.rotor) this.rotor.rotation.y = time * 2.2; // el helicóptero, al ralentí
        if (this.mast) this.mast.visible = Math.sin(time * 4 + 1) > 0;
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

// Casa de la granja. Nivel 0: en ruinas (paredes rotas, tejado hundido, chimenea caída,
// ventanas tapiadas y escombros); desde el 1, la casita arreglada.
export class House extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const WALL = 0xfff0d8, ROOF = 0x3f6fb0, ROOF2 = 0x355f9a, WOOD = 0x8a5a34, GLASS = 0x9fdcff;
        const W = 3.2, H = 1.9, D = 2.8;
        const b = (this.whole = new THREE.Group());
        this.root.add(b);
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

        // En ruinas
        const r = (this.ruin = new THREE.Group());
        this.root.add(r);
        const DIRTY = 0xb8a890, DIRTY2 = 0x9a8c74, SOOT = 0x4a4038, FADED = 0x5a6a80, FADED2 = 0x4a5868, PLANK = 0x6a4a2a;
        this.part(r, W + 0.1, 0.2, D + 0.1, 0x7a746c, 0, 0.1, 0);
        // Paredes a trozos, de alturas distintas y con manchas de hollín
        this.part(r, W, 1.5, 0.16, DIRTY, 0, 0.95, -D / 2 + 0.08);
        this.part(r, 1.2, 1.1, 0.16, DIRTY2, -1.0, 0.75, D / 2 - 0.08);
        this.part(r, 0.9, 0.6, 0.16, DIRTY, 1.15, 0.5, D / 2 - 0.08);
        this.part(r, 0.16, 1.3, D, DIRTY2, -W / 2 + 0.08, 0.85, 0);
        this.part(r, 0.16, 0.9, 1.4, DIRTY, W / 2 - 0.08, 0.65, -0.7);
        this.part(r, 1.0, 0.5, 0.04, SOOT, 0.4, 1.3, -D / 2 + 0.18, false);
        this.part(r, 0.04, 0.6, 0.9, SOOT, -W / 2 + 0.18, 1.0, 0.5, false);
        // Ventana tapiada con tablas y hueco de la puerta
        for (const [y, t] of [[1.1, 0.25], [1.3, -0.2]]) this.part(r, 0.7, 0.1, 0.05, PLANK, -1.0, y, D / 2 + 0.02, false).rotation.z = t;
        this.part(r, 0.5, 0.7, 0.05, 0x2a1a0e, 0.2, 0.55, D / 2 - 0.1, false);
        // Tejado hundido: planchas caídas e inclinadas
        this.part(r, W * 0.8, 0.2, 1.6, FADED, -0.3, 1.2, -0.4).rotation.set(0.35, 0, 0.12);
        this.part(r, 1.6, 0.2, 1.2, FADED2, 0.8, 0.5, 0.7).rotation.set(-0.4, 0.3, 0.2);
        this.part(r, 1.2, 0.2, 0.9, FADED, 2.3, 0.15, 1.0).rotation.set(0.1, 0.7, -0.15);
        // Chimenea caída y montones de escombros y tablas
        this.part(r, 0.36, 0.5, 0.36, 0x8a4a3a, 1.0, 1.05, -0.9);
        for (const [x, z, sx, sy, c] of [[1.7, -1.3, 0.5, 0.3, 0x8a4a3a], [1.95, -1.0, 0.3, 0.2, 0x8a4a3a], [-0.3, 0.3, 0.8, 0.35, DIRTY2], [0.4, 0.1, 0.5, 0.25, 0x7a746c], [-2.1, 1.3, 0.6, 0.25, DIRTY]]) {
            this.part(r, sx, sy, sx * 0.8, c, x, 0.2 + sy / 2, z).rotation.y = x;
        }
        for (const [x, z, a] of [[-1.9, -0.4, 0.4], [2.2, 0.2, 1.2], [-0.9, 1.9, 2.0]]) this.part(r, 1.4, 0.08, 0.16, PLANK, x, 0.08, z).rotation.y = a;
        this.setLevel(0);
    }

    // 0: en ruinas; 1 o más: arreglada
    setLevel(n) {
        this.level = n;
        this.whole.visible = n >= 1;
        this.ruin.visible = n === 0;
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
