import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

const RED = 0xff4a3a, RED_DARK = 0xc42a2a, TRIM = 0xfff6e8, ROOF = 0xc42a2a, ROOF_DARK = 0x9a1f30;
const HAY = 0xffd23f, WOOD = 0xb8763a;

// Granero voxel con cara: el centro de la granja. Respira, parpadea y su veleta gira.
export class BarnModel extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        const b = (this.body = new THREE.Group());
        this.root.add(b);
        const W = 2.4, D = 2.1, H = 1.8;
        // Cuerpo y zócalo
        this.part(b, W, H, D, RED, 0, H / 2, 0);
        this.part(b, W + 0.1, 0.16, D + 0.1, RED_DARK, 0, 0.08, 0);
        // Esquinas blancas
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.part(b, 0.14, H, 0.14, TRIM, sx * (W / 2 - 0.02), H / 2, sz * (D / 2 - 0.02), false);
        // Tejado a dos aguas hecho de escalones
        const steps = 5;
        for (let i = 0; i < steps; i++) {
            const w = W + 0.36 - i * ((W + 0.1) / steps);
            this.part(b, w, 0.24, D + 0.16, i % 2 ? ROOF_DARK : ROOF, 0, H + 0.12 + i * 0.24, 0);
        }
        // Frontón rojo con ventanita de paja y ojos
        const front = D / 2 + 0.02;
        this.part(b, 0.62, 0.42, 0.06, TRIM, 0, H + 0.42, front + 0.12);
        this.part(b, 0.48, 0.3, 0.06, HAY, 0, H + 0.42, front + 0.15, false);
        this.eyeGroup = this.eyes(b, 0, H - 0.5, front + 0.03, 0.34, 2.2);
        // Mejillas
        for (const sx of [-1, 1]) this.part(b, 0.22, 0.1, 0.03, 0xff9fd0, sx * 0.62, H - 0.78, front + 0.01, false);
        // Portón con su X blanca
        const door = new THREE.Group();
        door.position.set(0, 0, front);
        b.add(door);
        this.part(door, 1.1, 0.86, 0.08, TRIM, 0, 0.43, 0.02);
        this.part(door, 0.96, 0.74, 0.06, RED_DARK, 0, 0.41, 0.06, false);
        for (const s of [-1, 1]) {
            const bar = this.part(door, 1.12, 0.09, 0.04, TRIM, 0, 0.41, 0.1, false);
            bar.rotation.z = s * 0.66;
        }
        // Veleta: un gallito sobre el tejado que gira con el viento
        this.vane = new THREE.Group();
        this.vane.position.set(0, H + 0.12 + steps * 0.24, 0);
        b.add(this.vane);
        this.part(this.vane, 0.06, 0.5, 0.06, 0x3b2d6b, 0, 0.25, 0, false);
        this.part(this.vane, 0.26, 0.2, 0.08, HAY, 0, 0.56, 0);
        this.part(this.vane, 0.1, 0.12, 0.08, RED, 0.14, 0.66, 0, false);
        this.part(this.vane, 0.12, 0.18, 0.06, 0xff9a1f, -0.16, 0.62, 0, false);
        // Balas de paja junto a la puerta
        for (const [x, z, h] of [[-1.55, 0.7, 0], [-1.55, 0.7, 0.36], [1.55, 0.85, 0]]) {
            this.part(this.root, 0.5, 0.36, 0.42, HAY, x, 0.18 + h, z);
            this.part(this.root, 0.52, 0.06, 0.08, WOOD, x, 0.18 + h, z + 0.1, false);
        }
    }

    update(dt) {
        this.t += dt;
        // Respira (se estira y aplasta un poquito) y la veleta gira despacio
        const s = Math.sin(this.t * 2.2);
        this.body.scale.set(1 - s * 0.012, 1 + s * 0.02, 1 - s * 0.012);
        if (this.hop > 0) {
            // Dos botes con aplastamiento de gelatina al caer
            this.hop = Math.max(0, this.hop - dt * 1.2);
            const k = this.hop * 2 % 1;
            this.body.position.y = Math.sin(k * Math.PI) * 0.35 * this.hop;
            const sq = 1 + Math.sin(this.hop * 25) * 0.08 * this.hop;
            this.body.scale.set(sq, 2 - sq, sq);
        }
        this.vane.rotation.y = Math.sin(this.t * 0.5) * 1.6 + this.t * 0.2;
        this.updateBlink(dt, this.eyeGroup);
        this.updateFx(dt);
    }

    // Saltito de alegría (al volver con la cosecha)
    cheer() {
        this.hop = 1;
    }
}
