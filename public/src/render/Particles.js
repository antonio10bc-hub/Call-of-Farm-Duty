import * as THREE from 'three';
import { box } from './materials.js';

const FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'ttl', 'size', 'grav', 'rot', 'spin', 'r', 'g', 'b'];
const _d = new THREE.Object3D();
const _c = new THREE.Color();

// Cubitos voxel instanciados. Sin asignaciones por frame: arrays planos + swap-remove.
export class Particles {
    constructor(scene, max = 700) {
        this.max = max;
        this.n = 0;
        for (const f of FIELDS) this[f] = new Float32Array(max);
        this.mesh = new THREE.InstancedMesh(box(1, 1, 1), new THREE.MeshBasicMaterial(), max);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.count = 0;
        scene.add(this.mesh);
    }

    spawn(x, y, z, vx, vy, vz, size, ttl, color, grav = 14) {
        if (this.n >= this.max) return;
        const i = this.n++;
        this.x[i] = x; this.y[i] = y; this.z[i] = z;
        this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
        this.life[i] = 0; this.ttl[i] = ttl; this.size[i] = size; this.grav[i] = grav;
        this.rot[i] = Math.random() * 6; this.spin[i] = (Math.random() * 2 - 1) * 12;
        _c.setHex(color);
        this.r[i] = _c.r; this.g[i] = _c.g; this.b[i] = _c.b;
    }

    // Explosión radial. colors: array de hex.
    burst(x, y, z, count, colors, { speed = 3, up = 2, size = 0.12, ttl = 0.5, grav = 14 } = {}) {
        for (let k = 0; k < count; k++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.4 + Math.random() * 0.6);
            this.spawn(
                x, y, z,
                Math.sin(a) * s, up * (0.5 + Math.random()), Math.cos(a) * s,
                size * (0.6 + Math.random() * 0.8), ttl * (0.6 + Math.random() * 0.6),
                colors[(Math.random() * colors.length) | 0], grav
            );
        }
    }

    remove(i) {
        const last = --this.n;
        if (i === last) return;
        for (const f of FIELDS) this[f][i] = this[f][last];
    }

    update(dt) {
        if (dt <= 0) return;
        for (let i = 0; i < this.n; i++) {
            this.life[i] += dt;
            if (this.life[i] >= this.ttl[i]) {
                this.remove(i--);
                continue;
            }
            this.vy[i] -= this.grav[i] * dt;
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
            this.z[i] += this.vz[i] * dt;
            this.rot[i] += this.spin[i] * dt;
            const floor = this.size[i] * 0.5;
            if (this.y[i] < floor && this.vy[i] < 0) {
                this.y[i] = floor;
                this.vy[i] *= -0.35;
                this.vx[i] *= 0.6;
                this.vz[i] *= 0.6;
                this.spin[i] *= 0.5;
            }
        }
    }

    sync() {
        const colors = this.mesh.instanceColor.array;
        for (let i = 0; i < this.n; i++) {
            const t = this.life[i] / this.ttl[i];
            _d.position.set(this.x[i], this.y[i], this.z[i]);
            _d.rotation.set(this.rot[i], this.rot[i] * 0.7, 0);
            _d.scale.setScalar(this.size[i] * (1 - t * t));
            _d.updateMatrix();
            this.mesh.setMatrixAt(i, _d.matrix);
            colors[i * 3] = this.r[i];
            colors[i * 3 + 1] = this.g[i];
            colors[i * 3 + 2] = this.b[i];
        }
        this.mesh.count = this.n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor.needsUpdate = true;
    }

    clear() {
        this.n = 0;
        this.mesh.count = 0;
    }
}
