import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from './materials.js';

// Base de los modelos voxel (mismo patrón que TankModel de Tank-less): cajas con su casco de
// contorno y unos efectos compartidos por todas las piezas (fx.fade: aparecer/desaparecer con
// trama; fx.flash: destello blanco al recibir un golpe).
export class VoxelModel {
    constructor(outlineColor) {
        this.fx = { fade: { value: 1 }, flash: { value: 0 } };
        this.materials = [];
        this.mats = new Map();
        this.outlineMat = this.own(outline(outlineColor, this.fx));
        this.outlineColor = outlineColor;
        this.root = new THREE.Group();
        this.t = Math.random() * 10;
        this.blink = 1 + Math.random() * 3;
    }

    own(m) {
        this.materials.push(m);
        return m;
    }

    mat(color) {
        let m = this.mats.get(color);
        if (!m) this.mats.set(color, (m = this.own(toon(color, this.fx))));
        return m;
    }

    // Una pieza: caja de color + (opcional) su casco de contorno un poco más grande
    part(parent, w, h, d, color, x, y, z, outlined = true) {
        const m = new THREE.Mesh(box(w, h, d), typeof color === 'number' ? this.mat(color) : color);
        m.position.set(x, y, z);
        if (outlined) {
            const o = new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), this.outlineMat);
            m.add(o);
        }
        parent.add(m);
        return m;
    }

    // Ojitos: dos cubos blancos con pupila oscura. Devuelve el grupo (se escala en y al parpadear).
    eyes(parent, x, y, z, gap = 0.12, size = 1) {
        const g = new THREE.Group();
        g.position.set(x, y, z);
        parent.add(g);
        for (const sx of [-gap, gap]) {
            this.part(g, 0.11 * size, 0.12 * size, 0.03, 0xffffff, sx, 0, 0, false);
            this.part(g, 0.05 * size, 0.07 * size, 0.02, this.outlineColor, sx + 0.015 * size, -0.01 * size, 0.02, false);
        }
        return g;
    }

    // Parpadeo aleatorio: ojos cerrados un instante cada pocos segundos
    updateBlink(dt, eyes) {
        this.blink -= dt;
        if (this.blink < -0.12) this.blink = 1.5 + Math.random() * 3.5;
        eyes.scale.y = this.blink < 0 ? 0.15 : 1;
    }

    hit() {
        this.fx.flash.value = 1;
    }

    updateFx(dt) {
        this.fx.flash.value = Math.max(0, this.fx.flash.value - dt * 6);
    }

    dispose() {
        for (const m of this.materials) m.dispose();
    }
}
