import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

let _shadowGeo = null;
const shadowGeo = () => _shadowGeo || (_shadowGeo = new THREE.CircleGeometry(0.42, 12));

// Haz de trigo con carita: el blanco del francotirador. Cae del cielo, respira, se balancea
// y mira hacia la torreta.
export class SheafModel extends VoxelModel {
    constructor(colors, outlineColor) {
        super(outlineColor);
        const b = (this.body = new THREE.Group());
        this.root.add(b);
        // Tallos: un bloque ancho abajo que se estrecha en la atadura y se abre arriba
        this.part(b, 0.5, 0.34, 0.5, colors.dark, 0, 0.17, 0);
        this.part(b, 0.42, 0.3, 0.42, colors.body, 0, 0.47, 0);
        this.part(b, 0.46, 0.09, 0.46, colors.band, 0, 0.5, 0, false);
        this.top = new THREE.Group();
        this.top.position.y = 0.62;
        b.add(this.top);
        this.part(this.top, 0.56, 0.22, 0.56, colors.body, 0, 0.11, 0);
        // Espigas que asoman por arriba
        for (const [x, z, h] of [[-0.18, -0.1, 0.22], [0.16, -0.14, 0.28], [0, 0.12, 0.3], [-0.1, 0.16, 0.18], [0.2, 0.12, 0.2]]) {
            const e = this.part(this.top, 0.11, h, 0.11, colors.ear, x, 0.22 + h / 2, z, false);
            e.rotation.set(z * 1.4, 0, -x * 1.6);
        }
        this.eyeGroup = this.eyes(b, 0, 0.38, 0.22, 0.1, 1.1);
        this.height = 1.1;
        // Sombra: círculo negro plano que encoge cuando el haz está en el aire
        this.shadow = new THREE.Mesh(shadowGeo(), this.own(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })));
        this.shadow.rotation.x = -Math.PI / 2;
        this.root.add(this.shadow);
    }

    // y: altura del haz sobre el suelo
    placeShadow(y) {
        this.shadow.position.y = -y + 0.02;
        this.shadow.scale.setScalar(1 / (1 + y * 0.15));
    }

    update(dt, time) {
        this.t += dt;
        const s = Math.sin(this.t * 2.6);
        this.body.scale.set(1 - s * 0.03, 1 + s * 0.05, 1 - s * 0.03);
        this.top.rotation.z = Math.sin(time * 1.7 + this.root.position.x) * 0.12;
        this.updateBlink(dt, this.eyeGroup);
        this.updateFx(dt);
    }
}
