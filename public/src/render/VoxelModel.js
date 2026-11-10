import * as THREE from 'three';
import { box, toon, outline, OUTLINE, bakeGroup } from './materials.js';

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

    // Junta las piezas fijas de cada grupo de units en una malla por material (muchas menos
    // llamadas de dibujo). keep: lo que se mueve, parpadea o cambia por separado (se queda tal
    // cual, con lo de dentro); cada grupo de units, por su lado (los que se muestran u ocultan)
    bake(units, keep = []) {
        const stop = new Set([...units, ...keep].filter(Boolean));
        for (const u of units) if (u) bakeGroup(u, (o) => stop.has(o));
    }

    // Al tocarlo en el mapa: destello y un bote de gelatina
    // (el bote parte del tamaño que tenga el modelo: los hay a otra escala, como la torreta o los
    // edificios de los prados)
    select() {
        this.fx.flash.value = 0.55;
        if (!(this.pop > 0)) this.popBase = this.root.scale.x;
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
            const b = this.popBase || 1;
            this.root.scale.set(b * (1 + s), b * (1 - s), b * (1 + s));
        }
    }

    dispose() {
        for (const m of this.materials) m.dispose();
    }
}
