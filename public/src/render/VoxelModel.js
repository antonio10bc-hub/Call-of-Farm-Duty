import * as THREE from 'three';
import { box, toon, outline, OUTLINE } from './materials.js';

// Base de los modelos voxel: cajas con su casco de contorno y unos efectos compartidos por
// todas las piezas (fx.fade: aparecer/desaparecer con trama; fx.flash: destello blanco).
export class VoxelModel {
    constructor(outlineColor) {
        this.fx = { fade: { value: 1 }, flash: { value: 0 } };
        this.materials = [];
        this.mats = new Map();
        this.outlineMat = this.own(outline(outlineColor, this.fx));
        this.outlineColor = outlineColor;
        this.root = new THREE.Group();
        this.t = Math.random() * 10;
        this.pop = 0;
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
        if (outlined) m.add(new THREE.Mesh(box(w + OUTLINE * 2, h + OUTLINE * 2, d + OUTLINE * 2), this.outlineMat));
        parent.add(m);
        return m;
    }

    // Al tocarlo en el mapa: destello y un bote de gelatina
    select() {
        this.fx.flash.value = 0.55;
        this.pop = 1;
    }

    hit() {
        this.fx.flash.value = 1;
    }

    updateFx(dt) {
        this.fx.flash.value = Math.max(0, this.fx.flash.value - dt * 4);
        if (this.pop > 0) {
            this.pop = Math.max(0, this.pop - dt * 2.5);
            const s = Math.sin(this.pop * Math.PI * 3) * 0.08 * this.pop;
            this.root.scale.set(1 + s, 1 - s, 1 + s);
        }
    }

    dispose() {
        for (const m of this.materials) m.dispose();
    }
}
