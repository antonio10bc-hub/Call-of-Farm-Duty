import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';
import { damp } from '../core/math.js';

const WOOD = 0xd98a44, WOOD_DARK = 0x9a5a2a, METAL = 0x6a5ab8, METAL_DARK = 0x3b2d6b, BRASS = 0xffd23f;

// Rifle de francotirador voxel en primera persona: va pegado a la cámara, abajo a la derecha.
// Retrocede y se aplasta al disparar, se balancea al saltar de esquina y abre el cerrojo.
export class RifleModel extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        this.rest = new THREE.Vector3(0.24, -0.2, -0.6);
        this.root.scale.setScalar(0.38);
        this.root.position.copy(this.rest);
        const g = (this.gun = new THREE.Group());
        this.root.add(g);
        // Culata y empuñadura
        this.part(g, 0.13, 0.15, 0.36, WOOD, 0, -0.03, 0.26);
        this.part(g, 0.11, 0.08, 0.18, WOOD_DARK, 0, -0.13, 0.36);
        // Cajón de los mecanismos y guardamonte
        this.part(g, 0.12, 0.12, 0.3, METAL, 0, 0, -0.02);
        this.part(g, 0.05, 0.08, 0.1, METAL_DARK, 0, -0.1, 0.04, false);
        // Guardamanos de madera y cañón
        this.part(g, 0.11, 0.09, 0.42, WOOD, 0, -0.02, -0.36);
        this.part(g, 0.06, 0.06, 0.7, METAL_DARK, 0, 0.03, -0.62);
        this.part(g, 0.09, 0.09, 0.08, METAL, 0, 0.03, -0.96);
        // Mira telescópica con anillos dorados
        this.part(g, 0.09, 0.09, 0.44, METAL_DARK, 0, 0.13, -0.08);
        for (const z of [-0.32, 0.16]) this.part(g, 0.12, 0.12, 0.07, BRASS, 0, 0.13, z);
        for (const z of [-0.16, 0.04]) this.part(g, 0.04, 0.06, 0.04, METAL, 0, 0.08, z, false);
        // Cerrojo con su palanca
        this.bolt = this.part(g, 0.14, 0.04, 0.04, BRASS, 0.08, 0.04, 0.06, false);
        // Punta del cañón (de aquí salen las chispas)
        this.muzzle = new THREE.Object3D();
        this.muzzle.position.set(0, 0.03, -1.02);
        g.add(this.muzzle);

        this.kick = 0;
        this.boltT = 0;
        this.swayX = 0;
        this.swayY = 0;
    }

    fire() {
        this.kick = 1;
        this.boltT = 0;
    }

    // dx, dy: cuánto se ha girado la vista este frame (el rifle se queda un poco atrás)
    update(dt, dx = 0, dy = 0, bob = 0) {
        this.kick = Math.max(0, this.kick - dt * 5);
        this.boltT += dt;
        this.swayX = damp(this.swayX, -dx * 6, 10, dt);
        this.swayY = damp(this.swayY, dy * 6, 10, dt);
        const k = this.kick * this.kick;
        this.root.position.set(this.rest.x + this.swayX * 0.1, this.rest.y + this.swayY * 0.1 + bob, this.rest.z + k * 0.1);
        this.root.rotation.set(k * 0.35 + 0.04, this.swayX * 0.2 + 0.32, 0.06);
        // Squash & stretch del disparo
        this.gun.scale.set(1 + k * 0.12, 1 + k * 0.12, 1 - k * 0.18);
        // Cerrojo: atrás y adelante tras cada disparo
        const b = this.boltT > 0.25 && this.boltT < 0.65 ? Math.sin(((this.boltT - 0.25) / 0.4) * Math.PI) : 0;
        this.bolt.position.z = 0.06 + b * 0.12;
        this.bolt.rotation.x = b * -0.8;
        this.root.rotation.z = -b * 0.15;
        this.updateFx(dt);
    }
}
