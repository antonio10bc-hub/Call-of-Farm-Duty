import * as THREE from 'three';
import { box } from '../render/materials.js';
import { Turret, Mast } from '../render/structures.js';
import { TURRETS } from '../content/farm.js';

const SPARKS = [0xffffff, 0xffe03a, 0xff9a1f];
const rand = (a, b) => a + Math.random() * (b - a);
const S = 1.2; // tamaño de la torreta y los mástiles

// Torreta automática en el campo de tiro (si el campo la tiene): un mástil en cada torre, por
// fuera de la plataforma y por encima del tirador (sin taparle la vista), y una sola torreta que
// va de uno a otro como haría un jugador (nunca al de tu torre: si llegas a la suya, se va).
// Elige una mata al azar, la acribilla con una ráfaga y la recoge con la última bala. Lo que
// recoge no suma a las rachas (sniper.harvest con auto).
export class Turrets {
    constructor(sniper) {
        this.sn = sniper;
        this.root = new THREE.Group();
        sniper.scene.add(this.root);
        this.masts = [];
        this.turret = null;
        this.beams = [];
    }

    set(on) {
        this.clear();
        if (!on) return;
        const f = this.sn.field;
        this.masts = f.towers.map((tw) => {
            const dx = tw.x - f.cx, dz = tw.z - f.cz, d = Math.hypot(dx, dz);
            const m = new Mast(this.sn.theme.outline, TURRETS.mast);
            m.root.scale.setScalar(S);
            m.root.position.set(tw.x + (dx / d) * 1.05, tw.floor, tw.z + (dz / d) * 1.05);
            this.root.add(m.root);
            return m;
        });
        const t = (this.turret = new Turret(this.sn.theme.outline));
        t.root.scale.setScalar(S);
        t.corner = (this.sn.corner + 2) % this.masts.length; // la de enfrente
        t.root.position.copy(this.top(t.corner));
        t.yaw = Math.atan2(f.cx - t.root.position.x, f.cz - t.root.position.z);
        t.cool = rand(0.3, 0.8);
        t.hopT = TURRETS.hop;
        t.target = null;
        this.root.add(t.root);
    }

    // Lo alto del mástil i (donde se planta la torreta)
    top(i) {
        const m = this.masts[i];
        return m.root.position.clone().setY(m.root.position.y + m.top * S);
    }

    clear() {
        for (const m of this.masts) {
            this.root.remove(m.root);
            m.dispose();
        }
        if (this.turret) {
            this.root.remove(this.turret.root);
            this.turret.dispose();
        }
        for (const b of this.beams) this.dropBeam(b);
        this.masts = [];
        this.turret = null;
        this.beams = [];
    }

    dropBeam(b) {
        this.root.remove(b.mesh);
        b.mesh.material.dispose();
    }

    // Al mástil de al lado, a su izquierda o a su derecha (como el tirador entre torres: nunca en
    // diagonal) y nunca al de tu torre
    hop() {
        const t = this.turret, n = this.masts.length;
        const free = [(t.corner + 1) % n, (t.corner + n - 1) % n].filter((i) => i !== this.sn.corner);
        t.corner = free[(Math.random() * free.length) | 0];
        const p = this.top(t.corner);
        t.hopTo(p.x, p.y, p.z, 1.1);
        t.target = null;
        t.hopT = TURRETS.hop * rand(0.8, 1.2);
    }

    // Una bala: fogonazo, trazada hasta cerca de la mata (las ráfagas no van todas al mismo
    // sitio) y un poco de polvo y paja donde da
    shot(t, s) {
        const sn = this.sn;
        t.fire();
        const from = t.muzzle.getWorldPosition(new THREE.Vector3());
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
        const sn = this.sn, f = sn.field, t = this.turret;
        this.beams = this.beams.filter((b) => {
            if ((b.life -= dt) > 0) return true;
            this.dropBeam(b);
            return false;
        });
        if (!t) return;
        t.update(dt);
        if (t.hopping) return;
        // Si llegas a su torre, se aparta; y cada poco cambia de torre por su cuenta
        if (t.corner === sn.corner || ((t.hopT -= dt) <= 0 && !t.target)) return this.hop();
        if (sn.unlocking || sn.ending >= 0 || !!sn.ks.predator) {
            t.target = null;
            return;
        }
        if (!t.target && (t.cool -= dt) <= 0) {
            const free = f.targets.filter((s) => f.hittable(s));
            if (!free.length) return;
            t.target = free[(Math.random() * free.length) | 0];
            t.aimAt(t.target.x, t.target.z, t.root.position.y + 0.8 * S - t.target.y);
            t.wait = TURRETS.aim * 3;
            t.shots = TURRETS.burst;
            t.next = 0;
        }
        if (!t.target || (!t.aimed && (t.wait -= dt) > 0)) return;
        // Ráfaga: una bala cada rate s; la última recoge la mata (si sigue ahí)
        const s = t.target;
        if (!s.alive) {
            t.target = null;
            t.cool = 0.2;
            return;
        }
        if ((t.next -= dt) > 0) return;
        t.next = TURRETS.rate;
        this.shot(t, s);
        if (--t.shots > 0) return;
        t.target = null;
        t.cool = TURRETS.cool * rand(0.8, 1.2);
        sn.harvest([s], true);
    }
}
