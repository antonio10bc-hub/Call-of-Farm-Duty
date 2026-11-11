import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

// El pozo de los deseos: el típico pozo de piedra gris (dos hileras de piedras en corro, con su
// musgo), un tejadillo de madera sobre dos postes, la manivela con su cuerda y el cubo, y dentro
// el agua, que brilla. Alrededor, monedas que no entraron, flores y un cartel. wish(color): una
// moneda cae dando vueltas al agua, salpica y sube una columna de luz del color de lo que ha salido
const STONE = [0x9a948a, 0x8a847a, 0xa8a298, 0x7a746a], WOOD = 0x8a5a2a, WOOD2 = 0x6a4020, ROOF = 0x6a3a2a, MOSS = 0x5a8a3a;
const ease = (k) => k * k * (3 - 2 * k);

export class WishingWell extends VoxelModel {
    constructor(outline) {
        super(outline);
        const r = this.root;
        // El corro de piedras: dos hileras, la de arriba desplazada
        for (let row = 0; row < 2; row++) for (let k = 0; k < 12; k++) {
            const a = ((k + row * 0.5) / 12) * Math.PI * 2;
            const st = this.part(r, 0.62, 0.42, 0.42, STONE[(k + row) % 4], Math.cos(a) * 1.25, 0.21 + row * 0.42 + (k % 2) * 0.01, Math.sin(a) * 1.25);
            st.rotation.y = -a + Math.PI / 2;
            if ((k + row) % 5 === 0) this.part(r, 0.4, 0.06, 0.3, MOSS, Math.cos(a) * 1.25, 0.45 + row * 0.42, Math.sin(a) * 1.25, false).rotation.y = -a;
        }
        // El borde de arriba
        for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            this.part(r, 0.56, 0.12, 0.48, 0xb8b2a8, Math.cos(a) * 1.25, 0.9, Math.sin(a) * 1.25).rotation.y = -a + Math.PI / 2;
        }
        // El agua: brilla (y más cuando se pide un deseo)
        this.waterMat = this.own(new THREE.MeshBasicMaterial({ color: 0x3ab8e8 }));
        const water = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 1.7), this.waterMat);
        water.position.y = 0.55;
        r.add(water);
        // Postes, tejadillo a dos aguas, manivela, cuerda y cubo
        for (const s of [-1, 1]) this.part(r, 0.16, 2.4, 0.16, WOOD2, s * 1.05, 1.2, 0);
        for (let i = 0; i < 4; i++) {
            for (const s of [-1, 1]) {
                const t = this.part(r, 2.8, 0.1, 0.62 - i * 0.02, i % 2 ? ROOF : 0x7a4632, 0, 2.5 + i * 0.16, s * (0.32 + i * 0.25));
                t.rotation.x = s * 0.5;
            }
        }
        this.part(r, 2.9, 0.12, 0.12, WOOD2, 0, 3.12, 0);
        this.crank = new THREE.Group();
        this.crank.position.set(0, 1.95, 0);
        r.add(this.crank);
        this.part(this.crank, 2.3, 0.14, 0.14, WOOD, 0, 0, 0);
        this.part(r, 0.08, 0.4, 0.08, 0x5a5a62, 1.3, 1.85, 0.2);
        this.rope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.04), this.own(new THREE.MeshBasicMaterial({ color: 0xd8c8a0 })));
        r.add(this.rope);
        this.bucket = new THREE.Group();
        r.add(this.bucket);
        this.part(this.bucket, 0.36, 0.32, 0.36, WOOD, 0, 0, 0);
        this.part(this.bucket, 0.38, 0.05, 0.38, 0x5a5a62, 0, 0.1, 0, false);
        this.part(this.bucket, 0.04, 0.24, 0.3, 0x5a5a62, 0, 0.26, 0, false);
        // Lo de alrededor: monedas que no entraron, flores y el cartel
        for (const [x, z, ry] of [[1.8, 0.6, 0.3], [-1.6, 1.4, 1.1], [0.4, 1.9, 0.7], [-1.9, -0.8, 2]]) this.part(r, 0.18, 0.04, 0.18, 0xffd23f, x, 0.02 + x * 0.001, z, false).rotation.y = ry;
        for (const [x, z, c] of [[2.1, -0.9, 0xff7ae0], [-2.2, 0.3, 0xffe03a], [1.4, 2.0, 0x5af0ff], [-0.9, -2.1, 0xff7ae0]]) {
            this.part(r, 0.05, 0.36, 0.05, 0x3a8a3a, x, 0.18, z, false);
            this.part(r, 0.16, 0.12, 0.16, c, x, 0.4, z, false);
        }
        const P = { x: 0.9, z: 2.3 };
        this.part(r, 0.12, 1.1, 0.12, WOOD2, P.x, 0.55, P.z);
        this.part(r, 1.3, 0.42, 0.08, 0xc8955a, P.x, 1.15, P.z + 0.06);
        for (let i = 0; i < 5; i++) this.part(r, 0.14, 0.18, 0.03, 0x2a1a0e, P.x - 0.4 + i * 0.2, 1.15, P.z + 0.115, false);
        // La columna de luz del deseo y la moneda que cae
        this.beamMat = this.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
        this.beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), this.beamMat);
        this.beam.visible = false;
        r.add(this.beam);
        this.coin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.05), this.own(new THREE.MeshBasicMaterial({ color: 0xffd23f })));
        this.coin.visible = false;
        r.add(this.coin);
        this.bake([r], [water, this.crank, this.rope, this.bucket, this.beam, this.coin]);
        this.t = -1;
        this.color = new THREE.Color(0xffffff);
    }

    // ¡Un deseo! (color: el de la rareza de lo que ha salido). onSplash: cuando la moneda llega al agua
    wish(color, onSplash) {
        this.t = 0;
        this.color.setHex(color);
        this.onSplash = onSplash;
        this.splashed = false;
    }

    get busy() {
        return this.t >= 0;
    }

    update(dt, time) {
        // El cubo sube y baja un poco, colgado de la cuerda
        const by = 1.25 + Math.sin(time * 0.8) * 0.12;
        this.bucket.position.set(0, by, 0);
        this.rope.scale.y = 1.95 - by - 0.15;
        this.rope.position.set(0, (1.95 + by + 0.15) / 2, 0);
        this.crank.rotation.x = Math.sin(time * 0.8) * 0.4;
        const glow = 0.5 + Math.sin(time * 2) * 0.08;
        if (this.t < 0) {
            this.waterMat.color.setRGB(0.23 * glow * 2, 0.72 * glow * 1.4, 0.91);
            this.updateFx(dt);
            return;
        }
        this.t += dt;
        const t = this.t;
        // La moneda: sube desde delante, da vueltas y cae al agua (0..1 s)
        const k = Math.min(1, t / 1);
        this.coin.visible = k < 1;
        this.coin.position.set(0, 0.6 + Math.sin(k * Math.PI) * 3.2, 2.4 * (1 - k));
        this.coin.rotation.set(t * 14, t * 9, 0);
        if (k >= 1 && !this.splashed) {
            this.splashed = true;
            if (this.onSplash) this.onSplash();
        }
        // El agua se enciende del color y sube la columna de luz (1..3 s)
        const kb = Math.min(1, Math.max(0, (t - 1) / 2));
        this.beam.visible = kb > 0 && kb < 1;
        this.beam.scale.set(1, 1 + ease(kb) * 14, 1);
        this.beam.position.y = 0.6 + this.beam.scale.y / 2;
        this.beamMat.color.copy(this.color);
        this.beamMat.opacity = 0.5 * Math.sin(kb * Math.PI);
        this.waterMat.color.copy(this.color).lerp(new THREE.Color(0x3ab8e8), Math.min(1, kb * 1.2));
        if (t > 3.2) this.t = -1;
        this.updateFx(dt);
    }
}
