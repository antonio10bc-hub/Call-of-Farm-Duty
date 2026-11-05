import * as THREE from 'three';
import { box } from '../render/materials.js';
import { Turret } from '../render/structures.js';
import { TURRETS } from '../content/farm.js';

const SPARKS = [0xffffff, 0xffe03a, 0xff9a1f];
const rand = (a, b) => a + Math.random() * (b - a);

// Torretas automáticas en el campo de tiro (si el campo las tiene): una en cada torre, en lo alto
// de un mástil por fuera de la plataforma (por encima del tirador, sin taparle la vista). Cada
// una elige una mata al azar, la acribilla con una ráfaga y la recoge con la última bala. La de
// la torre en la que estás no dispara (la tienes encima). Lo que recogen no suma a las rachas
// (sniper.harvest con auto).
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
            const m = new Turret(this.sn.theme.outline, { mast: TURRETS.mast });
            m.root.scale.setScalar(1.2);
            m.root.position.set(tw.x + (dx / d) * 1.05, tw.floor, tw.z + (dz / d) * 1.05);
            m.yaw = Math.atan2(-dx, -dz);
            this.root.add(m.root);
            return { m, i, cool: rand(0.3, 1) + i * 0.25, target: null, wait: 0, shots: 0, next: 0 };
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

    // Una bala: fogonazo, trazada hasta cerca de la mata (las ráfagas no van todas al mismo
    // sitio) y un poco de polvo y paja donde da
    shot(t, s) {
        const sn = this.sn;
        t.m.fire();
        const from = t.m.muzzle.getWorldPosition(new THREE.Vector3());
        const to = new THREE.Vector3(s.x + rand(-0.35, 0.35), Math.max(0.05, s.y + rand(-0.3, 0.2)), s.z + rand(-0.35, 0.35));
        const mesh = new THREE.Mesh(box(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
        mesh.position.copy(from).lerp(to, 0.5);
        mesh.lookAt(to);
        mesh.scale.set(0.045, 0.045, from.distanceTo(to));
        this.root.add(mesh);
        this.beams.push({ mesh, life: 0.05 });
        sn.particles.burst(from.x, from.y, from.z, 4, SPARKS, { speed: 1.4, up: 0.6, size: 0.05, ttl: 0.12, grav: 0 });
        sn.particles.burst(to.x, to.y, to.z, 5, [0xffe9a0, 0xd9b77a, sn.theme.dust], { speed: 1.4, up: 1.6, size: 0.06, ttl: 0.35 });
        sn.hooks.sfx.play('turret');
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
                t.m.aimAt(t.target.x, t.target.z, t.m.root.position.y + (TURRETS.mast + 0.68) * 1.2 - t.target.y);
                t.wait = TURRETS.aim * 3;
                t.shots = TURRETS.burst;
                t.next = 0;
            }
            if (!t.target || (!t.m.aimed && (t.wait -= dt) > 0)) continue;
            // Ráfaga: una bala cada rate s; la última recoge la mata (si sigue ahí)
            const s = t.target;
            if (!s.alive) {
                t.target = null;
                t.cool = 0.2;
                continue;
            }
            if ((t.next -= dt) > 0) continue;
            t.next = TURRETS.rate;
            this.shot(t, s);
            if (--t.shots > 0) continue;
            t.target = null;
            t.cool = TURRETS.cool * rand(0.8, 1.2);
            sn.harvest([s], true);
        }
        this.beams = this.beams.filter((b) => {
            if ((b.life -= dt) > 0) return true;
            this.dropBeam(b);
            return false;
        });
    }
}
