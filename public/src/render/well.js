import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

// El pozo de los deseos: el típico pozo de piedra gris (dos hileras de piedras en corro, con su
// musgo), un tejadillo de madera sobre dos postes, la manivela con su cuerda y el cubo, y dentro
// el agua, que brilla. Alrededor, monedas que no entraron, flores y un cartel. wish(color): una
// moneda cae dando vueltas al agua, salpica y sube una columna de luz del color de lo que ha salido
const STONE = [0x9a948a, 0x8a847a, 0xa8a298, 0x7a746a], WOOD = 0x8a5a2a, WOOD2 = 0x6a4020, ROOF = 0x6a3a2a, MOSS = 0x5a8a3a;
const ease = (k) => k * k * (3 - 2 * k);
const WATER = new THREE.Color(0x3ab8e8), WHITE = new THREE.Color(0xffffff);

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
        // La columna de luz del deseo (el rayo: un núcleo blanco dentro), los anillos de la carga y
        // la moneda que cae
        const add = (c, o = 0) => this.own(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.beamMat = add(0xffffff);
        this.beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), this.beamMat);
        this.coreMat = add(0xffffff);
        this.beam.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), this.coreMat));
        this.beam.visible = false;
        r.add(this.beam);
        this.ringMat = add(0xffffff);
        // El aura: una caja de luz del color alrededor del pozo (crece con la carga)
        this.auraMat = add(0xffffff);
        this.aura = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3.4), this.auraMat);
        this.aura.position.y = 1.1;
        this.aura.visible = false;
        r.add(this.aura);
        this.rings = [0, 1, 2].map(() => {
            const g = new THREE.Group();
            for (let k = 0; k < 4; k++) {
                const bar = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.2, 0.22), this.ringMat);
                bar.position.set(Math.cos((k * Math.PI) / 2) * 1.45, 0, Math.sin((k * Math.PI) / 2) * 1.45);
                bar.rotation.y = -(k * Math.PI) / 2 + Math.PI / 2;
                g.add(bar);
            }
            g.visible = false;
            r.add(g);
            return g;
        });
        this.coin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.05), this.own(new THREE.MeshBasicMaterial({ color: 0xffd23f })));
        this.coin.visible = false;
        r.add(this.coin);
        // La pieza que sale disparada (un cartel con su foto, siempre de cara a la cámara)
        this.prize = new THREE.Sprite(this.own(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })));
        this.prize.visible = false;
        r.add(this.prize);
        this.bake([r], [water, this.crank, this.rope, this.bucket, this.beam, this.coin, this.prize, this.aura, ...this.rings]);
        this.t = -1;
        this.color = new THREE.Color(0xffffff);
    }

    // ¡Un deseo! color: el de la rareza de lo que ha salido; art: la foto de la pieza (data URL).
    // onSplash: cuando la moneda llega al agua. speed: más rápido (en las pruebas).
    // Tiempos (s): 0-1 la moneda; 1-2.8 la carga (el agua y los anillos se encienden del color);
    // 2.8-3.6 el rayo, con la pieza delante; hasta 4.2 se apaga
    wish(color, onSplash, art = null, speed = 1) {
        this.t = 0;
        this.speed = speed;
        this.color.setHex(color);
        this.onSplash = onSplash;
        this.splashed = false;
        this.prize.visible = false;
        if (art) {
            const tex = new THREE.TextureLoader().load(art);
            tex.magFilter = tex.minFilter = THREE.NearestFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
            if (this.prize.material.map) this.prize.material.map.dispose();
            this.prize.material.map = tex;
            this.prize.material.needsUpdate = true;
        }
        this.hasPrize = !!art;
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
        this.t += dt * this.speed;
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
        // La carga (1..2.8 s): el agua late cada vez más deprisa hacia el color; tres anillos suben
        // del agua girando a saltos (de 8 en 8 pasos por vuelta) y se aprietan
        const kc = Math.min(1, Math.max(0, (t - 1) / 1.8));
        const beat = 0.5 + 0.5 * Math.sin(t * (6 + kc * 30));
        this.waterMat.color.copy(WATER).lerp(this.color, kc).lerp(WHITE, kc * beat * 0.6);
        this.ringMat.color.copy(this.color).lerp(WHITE, beat * 0.4);
        this.ringMat.opacity = kc > 0 && t < 2.9 ? 0.4 + kc * 0.6 : 0;
        this.auraMat.color.copy(this.color);
        this.auraMat.opacity = t < 2.9 ? kc * (0.25 + beat * 0.25) : 0.5 * Math.max(0, 1 - (t - 2.9) / 1.2);
        this.aura.visible = this.auraMat.opacity > 0.01;
        this.aura.scale.set(1 + kc * 0.15 * beat, 1 + kc * 0.6, 1 + kc * 0.15 * beat);
        this.rings.forEach((g, i) => {
            g.visible = this.ringMat.opacity > 0;
            const ph = (kc * (1.4 + i * 0.5) + i / 3) % 1;
            g.position.y = 0.6 + ph * (1.2 + kc * 2.4);
            g.scale.setScalar(1.05 - ph * 0.35 * kc);
            g.rotation.y = Math.floor(t * (4 + kc * 12) + i * 3) * (Math.PI / 8);
        });
        this.root.position.y = kc > 0 && kc < 1 ? (Math.random() - 0.5) * 0.06 * kc : 0; // (tiembla)
        // El rayo (2.8..3.6 s, y se apaga hasta 4.2): sube en un instante, con la pieza delante
        const kb = Math.min(1, Math.max(0, (t - 2.8) / 0.35)), fade = 1 - Math.min(1, Math.max(0, (t - 3.6) / 0.6));
        this.beam.visible = t > 2.8 && fade > 0;
        this.beam.scale.set(1 + (1 - kb) * 0.6, 0.1 + ease(kb) * 60, 1 + (1 - kb) * 0.6);
        this.beam.position.y = 0.6 + this.beam.scale.y / 2;
        this.beamMat.color.copy(this.color);
        this.beamMat.opacity = 0.7 * fade;
        this.coreMat.opacity = 0.9 * fade;
        if (t > 2.8) this.waterMat.color.copy(this.color).lerp(WHITE, 0.5 * fade).lerp(WATER, 1 - fade);
        this.prize.visible = this.hasPrize && t > 2.75 && t < 3.9;
        if (this.prize.visible) {
            const kp = Math.min(1, (t - 2.75) / 1.1);
            this.prize.position.set(0, 1 + kp * kp * 64 + kp * 6, 0);
            const sz = 2.4 + Math.sin(Math.min(1, kp * 3) * Math.PI) * 0.8;
            this.prize.scale.set(sz, sz, 1);
            this.prize.material.rotation = Math.sin(t * 20) * 0.2;
        }
        if (t > 4.2) {
            this.t = -1;
            this.root.position.y = 0;
            this.beam.visible = this.prize.visible = this.aura.visible = false;
        }
        this.updateFx(dt);
    }
}
