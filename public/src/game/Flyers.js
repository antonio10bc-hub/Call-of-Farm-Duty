import * as THREE from 'three';
import { Ufo } from '../render/structures.js';
import { UFO } from '../content/ufo.js';

const F = UFO.flyer;
const SPARKS = [0xffffff, 0xffe03a, 0x7dff4a, 0x9fdcff];
const _v = new THREE.Vector3();
const rand = (a, b) => a + Math.random() * (b - a);

// Ovnis pequeños en el campo de tiro: de vez en cuando cruza uno el cielo, bamboleándose. Si se
// le da, cae en barrena echando chispas y, al tocar el suelo, suelta monedas alienígenas
// (hooks.onUfoCoin). Su caja de impacto es una esfera (radius).
export class Flyers {
    constructor(sniper) {
        this.sn = sniper;
        this.root = new THREE.Group();
        sniper.scene.add(this.root);
        this.list = [];
        this.reset();
    }

    // Fuera de la escena y sus materiales liberados
    drop(fl) {
        this.root.remove(fl.model.root);
        for (const m of fl.model.materials) m.dispose();
    }

    reset() {
        for (const f of this.list) this.drop(f);
        this.list = [];
        this.next = rand(F.min, F.max);
    }

    // Uno nuevo cruzando el campo por encima, en una dirección al azar
    spawn() {
        const f = this.sn.field, a = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const half = f.radius + 25, y = rand(F.height[0], F.height[1]);
        const model = new Ufo(this.sn.theme.outline, true);
        model.root.scale.setScalar(0.35);
        this.root.add(model.root);
        const side = (Math.random() - 0.5) * f.radius;
        const fl = {
            model, dir, y, len: half * 2, dist: 0, ph: Math.random() * 6, falling: false, vy: 0, spin: 0,
            x0: f.cx - dir.x * half + dir.z * side, z0: f.cz - dir.z * half - dir.x * side,
        };
        this.list.push(fl);
        this.place(fl, 0);
        return fl;
    }

    place(fl, time) {
        const p = fl.model.root.position;
        p.set(fl.x0 + fl.dir.x * fl.dist, fl.y + Math.sin(time * 2 + fl.ph) * 0.4, fl.z0 + fl.dir.z * fl.dist);
    }

    // El más cercano de los que vuelan en la línea de tiro: { flyer, t } o null
    hit(origin, dir) {
        let best = null;
        for (const fl of this.list) {
            if (fl.falling) continue;
            const c = fl.model.root.position;
            _v.subVectors(c, origin);
            const tca = _v.dot(dir);
            if (tca < 0) continue;
            const d2 = _v.lengthSq() - tca * tca;
            if (d2 > F.radius * F.radius) continue;
            const t = tca - Math.sqrt(F.radius * F.radius - d2);
            if (!best || t < best.t) best = { flyer: fl, t };
        }
        return best;
    }

    // Derribado: chispazo, humo y a caer dando vueltas
    shoot(fl) {
        const p = fl.model.root.position, sn = this.sn;
        fl.falling = true;
        fl.vy = 2;
        fl.spin = 9;
        sn.particles.burst(p.x, p.y, p.z, 40, SPARKS, { speed: 4, up: 3, size: 0.12, ttl: 0.7 });
        sn.hooks.sfx.play('crateHit');
        sn.hooks.sfx.play('shieldGet');
    }

    update(dt, time) {
        const sn = this.sn;
        if (!sn.unlocking && sn.ending < 0 && (this.next -= dt) <= 0) {
            this.next = rand(F.min, F.max);
            this.spawn();
            sn.hooks.sfx.play('radar');
        }
        this.list = this.list.filter((fl) => {
            const r = fl.model.root;
            fl.model.update(dt, time);
            if (!fl.falling) {
                fl.dist += F.speed * dt;
                this.place(fl, time);
                r.rotation.set(Math.sin(time * 1.6 + fl.ph) * 0.15, time * 3, Math.cos(time * 1.3 + fl.ph) * 0.15);
                if (fl.dist < fl.len) return true;
                this.drop(fl);
                return false;
            }
            // Cayendo en barrena, con humo y chispas
            fl.vy -= 14 * dt;
            r.position.y += fl.vy * dt;
            r.position.x += fl.dir.x * F.speed * 0.5 * dt;
            r.position.z += fl.dir.z * F.speed * 0.5 * dt;
            r.rotation.x += fl.spin * dt;
            r.rotation.z += fl.spin * 0.6 * dt;
            if (Math.random() < 0.6) sn.particles.spawn(r.position.x, r.position.y, r.position.z, 0, 0.5, 0, 0.18 + Math.random() * 0.12, 0.8, Math.random() < 0.3 ? 0xffe03a : 0x5a5048, -0.5);
            if (r.position.y > 0.3) return true;
            // En el suelo: pum y la moneda
            sn.particles.burst(r.position.x, 0.3, r.position.z, 50, [0xffffff, 0xffe03a, 0xff9a1f, 0x7dff4a], { speed: 5, up: 5, size: 0.2, ttl: 0.8 });
            sn.waves.spawn(r.position.x, r.position.z, 0x7dff4a, 2.4, 0.5);
            sn.hooks.sfx.play('boom');
            _v.copy(r.position).project(sn.camera);
            if (sn.hooks.onUfoCoin) sn.hooks.onUfoCoin(F.coins, _v.x, _v.y);
            this.drop(fl);
            return false;
        });
    }
}
