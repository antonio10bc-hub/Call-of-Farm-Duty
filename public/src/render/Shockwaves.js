import * as THREE from 'three';

// Anillos expansivos a ras de suelo (explosiones, aterrizajes).
export class Shockwaves {
    constructor(scene, max = 8) {
        this.items = [];
        const geo = new THREE.RingGeometry(0.8, 1, 12, 1);
        for (let i = 0; i < max; i++) {
            const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            scene.add(mesh);
            this.items.push({ mesh, life: 0, ttl: 1, radius: 1 });
        }
    }

    spawn(x, z, color, radius = 2.5, ttl = 0.45) {
        const it = this.items.find((w) => !w.mesh.visible) || this.items[0];
        it.life = 0;
        it.ttl = ttl;
        it.radius = radius;
        it.mesh.material.color.setHex(color);
        it.mesh.position.set(x, 0.03, z);
        it.mesh.visible = true;
    }

    update(dt) {
        for (const it of this.items) {
            if (!it.mesh.visible) continue;
            it.life += dt;
            const t = it.life / it.ttl;
            if (t >= 1) {
                it.mesh.visible = false;
                continue;
            }
            it.mesh.scale.setScalar(0.2 + (1 - (1 - t) * (1 - t)) * it.radius);
            it.mesh.material.opacity = 1 - t;
        }
    }

    clear() {
        for (const it of this.items) it.mesh.visible = false;
    }
}
