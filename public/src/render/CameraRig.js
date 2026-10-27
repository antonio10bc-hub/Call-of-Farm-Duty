import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';

const DEG = Math.PI / 180;

// Cámara cenital inclinada estilo Archero: encaja el ancho del arena y sigue al foco.
export class CameraRig {
    constructor(cfg) {
        this.cfg = cfg;
        this.camera = new THREE.PerspectiveCamera(cfg.fov, 1, 0.5, 400);
        this.aspect = 1;
        this.cols = 10;
        this.rows = 10;
        this.x = 0;
        this.z = 0;
        this.fx = 0;
        this.fz = 0;
        this.zoom = 1;
        this.zoomTarget = 1;
        this.yaw = 0;
        this.yawTarget = 0;
        this.trauma = 0;
    }

    setBounds(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.fit();
    }

    resize(aspect) {
        this.aspect = aspect;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.fit();
    }

    fit() {
        const { fov, pitch, sideMargin, minRows } = this.cfg;
        const tanV = Math.tan((fov * DEG) / 2);
        const tanH = tanV * this.aspect;
        const sinP = Math.sin(pitch * DEG);
        const byWidth = (this.cols / 2 + sideMargin) / tanH;
        const byRows = ((minRows / 2) * sinP) / tanV;
        this.dist = Math.max(byWidth, byRows);
        this.halfDepth = (this.dist * tanV) / sinP;
        this.halfWidth = this.dist * tanH;
    }

    focus(x, z) {
        this.fx = x;
        this.fz = z;
    }

    snap() {
        this.x = this.clampX(this.fx);
        this.z = this.clampZ(this.fz);
        this.zoom = this.zoomTarget;
        this.yaw = this.yawTarget;
    }

    // Los límites encogen con el zoom: de cerca se puede centrar algo pegado al borde.
    clampX(x) {
        if (this.free) return x; // escenas: la cámara puede centrar cualquier punto
        const hw = this.halfWidth * this.zoom;
        const lo = hw - 1, hi = this.cols - hw + 1;
        return lo > hi ? this.cols / 2 : clamp(x, lo, hi);
    }

    clampZ(z) {
        if (this.free) return z;
        const hd = this.halfDepth * this.zoom;
        const lo = hd - 1.2, hi = this.rows - hd + 0.4;
        return lo > hi ? this.rows / 2 : clamp(z, lo, hi);
    }

    shake(amount) {
        this.trauma = Math.min(1, this.trauma + amount);
    }

    update(dt) {
        const k = this.cfg.follow;
        this.x = damp(this.x, this.clampX(this.fx), k, dt);
        this.z = damp(this.z, this.clampZ(this.fz), k, dt);
        this.zoom = damp(this.zoom, this.zoomTarget, 4, dt);
        this.yaw = damp(this.yaw, this.yawTarget, 4, dt);

        const s = this.trauma * this.trauma * 0.4;
        const sx = (Math.random() * 2 - 1) * s, sz = (Math.random() * 2 - 1) * s;
        this.trauma = Math.max(0, this.trauma - dt * 2.2);

        const p = this.cfg.pitch * DEG;
        const d = this.dist * this.zoom;
        const tx = this.x + sx, tz = this.z + sz;
        this.camera.position.set(
            tx + Math.sin(this.yaw) * Math.cos(p) * d,
            Math.sin(p) * d,
            tz + Math.cos(this.yaw) * Math.cos(p) * d
        );
        this.camera.lookAt(tx, 0, tz);
    }
}
