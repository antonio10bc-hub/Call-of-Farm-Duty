import * as THREE from 'three';
import { box } from '../render/materials.js';
import { Turret } from '../render/structures.js';
import { TURRETS } from '../content/farm.js';

const SPARKS = [0xffffff, 0xffe03a, 0xff9a1f];
const rand = (a, b) => a + Math.random() * (b - a);

// Torretas automáticas en el campo de tiro (si el campo las tiene): una en cada torre, en el
// borde de fuera de la plataforma. Cada una, cada poco, apunta a una mata al azar y la recoge de
// un disparo. La de la torre en la que estás no dispara (la tienes detrás). Lo que recogen no
// suma a las rachas (sniper.harvest con auto).
export class Turrets {
    constructor(sniper) {
        this.sn = sniper;
        this.root = new THREE.Group();
        sniper.scene.add(this.root);
        this.list = [];
        this.beams = [];
    }

    set(on) {
        this.clear();
        if (!on) return;
        const f = this.sn.field;
        this.list = f.towers.map((tw, i) => {
            const dx = tw.x - f.cx, dz = tw.z - f.cz, d = Math.hypot(dx, dz);
            const m = new Turret(this.sn.theme.outline);
            m.root.scale.setScalar(1.3);
            m.root.position.set(tw.x + (dx / d) * 0.55, tw.floor + 0.08, tw.z + (dz / d) * 0.55);
            m.yaw = Math.atan2(-dx, -dz);
            this.root.add(m.root);
            return { m, i, cool: rand(0.6, 1.6) + i * 0.3, target: null, wait: 0 };
        });
    }

    clear() {
        for (const t of this.list) {
            this.root.remove(t.m.root);
            t.m.dispose();
        }
        for (const b of this.beams) this.dropBeam(b);
        this.list = [];
        this.beams = [];
    }

    dropBeam(b) {
        this.root.remove(b.mesh);
        b.mesh.material.dispose();
    }

    update(dt) {
        const sn = this.sn, f = sn.field;
        const busy = sn.unlocking || sn.ending >= 0 || !!sn.ks.predator;
        for (const t of this.list) {
            t.m.update(dt);
            if (busy || t.i === sn.corner) {
                t.target = null;
                continue;
            }
            // Buscar mata: una viva y en el suelo que no tenga ya otra torreta encima
            if (!t.target && (t.cool -= dt) <= 0) {
                const taken = new Set(this.list.map((o) => o.target));
                const free = f.targets.filter((s) => s.alive && s.landed && !taken.has(s));
                if (!free.length) continue;
                t.target = free[(Math.random() * free.length) | 0];
                t.m.aimAt(t.target.x, t.target.z, t.m.root.position.y - t.target.y);
                t.wait = TURRETS.aim * 3;
            }
            if (!t.target || (!t.m.aimed && (t.wait -= dt) > 0)) continue;
            // ¡Pum! Trazada, chispas y la mata recogida (si sigue ahí)
            const s = t.target;
            t.target = null;
            t.cool = TURRETS.shoot * rand(0.8, 1.2);
            if (!s.alive) continue;
            t.m.fire();
            const from = t.m.muzzle.getWorldPosition(new THREE.Vector3()), to = new THREE.Vector3(s.x, s.y, s.z);
            const mesh = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
            mesh.position.copy(from).lerp(to, 0.5);
            mesh.lookAt(to);
            mesh.scale.set(0.05, 0.05, from.distanceTo(to));
            this.root.add(mesh);
            this.beams.push({ mesh, life: 0.07 });
            sn.particles.burst(from.x, from.y, from.z, 8, SPARKS, { speed: 1.4, up: 0.6, size: 0.05, ttl: 0.15, grav: 0 });
            sn.hooks.sfx.play('shotEnemy');
            sn.harvest([s], true);
        }
        this.beams = this.beams.filter((b) => {
            if ((b.life -= dt) > 0) return true;
            this.dropBeam(b);
            return false;
        });
    }
}
