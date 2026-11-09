import * as THREE from 'three';

// Cielo de verdad (no un color plano): una cúpula enorme con el degradado a franjas (como
// pintado a píxel) del horizonte a lo alto. Mezcla tres cielos: el de día, el de noche y el del
// atardecer/amanecer (naranja en el horizonte, rosa y morado arriba, con el sol grande y bajo).
// update(k, d): k lo de noche que es (0..1) y d lo de atardecer (0..1).
const DAY = [0xd8f2ff, 0xb4e2ff, 0x7cc4f6];
const NIGHT = [0x3a4880, 0x26326c, 0x121a46]; // (más clarita: de noche también se ve)
const DUSK = [0xffc46a, 0xf07a5a, 0x3a3a8a];
const STEPS = 7; // franjas del degradado
const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color();

function grad(stops, t, out) {
    const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
    return out.setHex(stops[i]).lerp(_c.setHex(stops[i + 1]), x - i);
}

export class Sky {
    constructor(radius = 380) {
        this.r = radius;
        this.root = new THREE.Group();
        const geo = new THREE.SphereGeometry(radius, 24, 16);
        const pos = geo.attributes.position;
        this.t = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
            const h = Math.max(0, pos.getY(i) / radius);           // 0 en el horizonte, 1 arriba
            this.t[i] = Math.round(Math.min(1, Math.pow(h, 0.6)) * STEPS) / STEPS;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3));
        this.dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
        this.dome.renderOrder = -10;
        this.root.add(this.dome);
        // El sol del atardecer: un cuadrado grande, bajo, con dos halos
        this.sun = new THREE.Group();
        const dir = new THREE.Vector3(0, 0.08, -1).normalize().multiplyScalar(radius * 0.9); // (en el centro, al frente)
        this.sun.position.copy(dir);
        this.sun.lookAt(0, 0, 0);
        for (const [s, c, o] of [[34, 0xffe08a, 1], [52, 0xffb060, 0.45], [78, 0xff8a50, 0.2]]) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, fog: false }));
            m.position.z = -s * 0.02;
            m.renderOrder = -9;
            this.sun.add(m);
        }
        this.root.add(this.sun);
        this.k = -1;
        this.d = -1;
        this.horizon = new THREE.Color();
    }

    update(k, d) {
        if (Math.abs(k - this.k) < 0.002 && Math.abs(d - this.d) < 0.002) return;
        this.k = k;
        this.d = d;
        const col = this.dome.geometry.attributes.color;
        for (let i = 0; i < this.t.length; i++) {
            const t = this.t[i];
            grad(DAY, t, _a).lerp(grad(NIGHT, t, _b), k).lerp(grad(DUSK, t, _b), d);
            col.setXYZ(i, _a.r, _a.g, _a.b);
        }
        col.needsUpdate = true;
        grad(DAY, 0, this.horizon).lerp(grad(NIGHT, 0, _b), k).lerp(grad(DUSK, 0, _b), d);
        // El sol se va poniendo según cae la noche: baja hasta esconderse tras las montañas
        this.sun.visible = d > 0.05;
        this.sun.position.set(0, (0.22 - 0.34 * k) * this.r, -this.r * 0.9);
        this.sun.lookAt(0, 0, 0);
        this.sun.children.forEach((m, i) => (m.material.opacity = [1, 0.45, 0.2][i] * Math.min(1, d * 1.5)));
    }
}
