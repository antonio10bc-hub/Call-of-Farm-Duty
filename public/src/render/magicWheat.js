import * as THREE from 'three';
import { VoxelModel } from './VoxelModel.js';

const _c = new THREE.Color();
const _p = new THREE.Vector3();

// El trigo mágico del prólogo: una mata de espigas de todos los colores que van cambiando, con un
// halo que late y un anillo de luz en la base. Flota y se mece. hit(origin, dir): si un rayo le da
// (para el francotirador), la distancia; si no, null.
export class MagicWheat extends VoxelModel {
    constructor(outlineColor) {
        super(outlineColor);
        this.body = new THREE.Group();
        this.root.add(this.body);
        this.stalks = [];
        const n = 13;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + (i % 2) * 0.4, r = i === 0 ? 0 : 0.12 + (i % 3) * 0.07;
            const g = new THREE.Group();
            g.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
            g.rotation.set(Math.cos(a) * r * 0.9, 0, -Math.sin(a) * r * 0.9);
            const h = 1.0 + ((i * 7) % 5) * 0.08;
            const stem = new THREE.MeshBasicMaterial({ color: 0xffffff }), ear = new THREE.MeshBasicMaterial({ color: 0xffffff });
            this.own(stem);
            this.own(ear);
            const s = this.part(g, 0.06, h, 0.06, stem, 0, h / 2, 0, false);
            const e = this.part(g, 0.14, 0.34, 0.14, ear, 0, h + 0.14, 0);
            for (const [dx, dy] of [[-0.09, 0.05], [0.09, -0.05], [-0.09, -0.08], [0.09, 0.09]]) this.part(e, 0.07, 0.1, 0.07, ear, dx, dy, 0, false);
            this.body.add(g);
            this.stalks.push({ g, stem, ear, hue: i / n, ph: i * 0.7, s });
        }
        // Atadura dorada y halo (caja vista por dentro, que late y cambia de color)
        this.part(this.body, 0.36, 0.1, 0.36, 0xffd23f, 0, 0.45, 0);
        this.haloMat = this.own(new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.halo = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.haloMat);
        this.halo.position.y = 0.75;
        this.body.add(this.halo);
        this.ringMat = this.own(new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.6, depthWrite: false }));
        this.ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 12, 1), this.ringMat);
        this.ring.rotation.x = -Math.PI / 2;
        this.root.add(this.ring);
        this.base = 0;     // altura sobre la que flota
        this.float = true;
        this.gone = 0;     // 0..1: deshaciéndose
    }

    // Centro del trigo en el mundo (para el bocadillo, las chispas y el blanco)
    center(out = new THREE.Vector3()) {
        return this.root.localToWorld(out.set(0, 0.8, 0));
    }

    hit(origin, dir) {
        if (!this.root.visible || this.gone > 0) return null;
        const c = this.center(_p), r = 0.75 * this.root.scale.x;
        const ox = origin.x - c.x, oy = origin.y - c.y, oz = origin.z - c.z;
        const b = ox * dir.x + oy * dir.y + oz * dir.z, q = ox * ox + oy * oy + oz * oz - r * r, d = b * b - q;
        if (d < 0) return null;
        const t = -b - Math.sqrt(d);
        return t > 0 ? t : null;
    }

    update(dt, time) {
        this.t += dt;
        for (const s of this.stalks) {
            _c.setHSL((s.hue + time * 0.15) % 1, 0.9, 0.62);
            s.stem.color.copy(_c).offsetHSL(0, -0.2, -0.12);
            s.ear.color.copy(_c);
            s.g.rotation.y = Math.sin(time * 1.5 + s.ph) * 0.15;
        }
        this.haloMat.color.setHSL((time * 0.2) % 1, 1, 0.75);
        const pulse = 1 + Math.sin(time * 4) * 0.08;
        this.halo.scale.set(1.4 * pulse, 1.9 * pulse, 1.4 * pulse);
        this.ring.scale.setScalar(1 + Math.sin(time * 3) * 0.12);
        if (this.float) this.body.position.y = this.base + Math.sin(time * 1.8) * 0.12;
        this.body.rotation.y += dt * 0.4;
        if (this.gone > 0) {
            // Se deshace: crece, gira y se encoge hasta desaparecer
            this.gone = Math.min(1, this.gone + dt * 0.9);
            const k = this.gone, s = k < 0.3 ? 1 + k : Math.max(0.0001, (1 - k) * 1.9);
            this.body.scale.setScalar(s);
            this.body.rotation.y += dt * 12 * k;
            this.ring.visible = k < 0.4;
            if (k >= 1) this.root.visible = false;
        }
        this.updateFx(dt);
    }
}
